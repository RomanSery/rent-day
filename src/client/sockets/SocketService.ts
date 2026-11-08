import { PageType } from "../../core/enums/PageType";
import { GameEvent } from "../../core/types/GameEvent";
import { getMyPlayerName, getMyUserId, hasJoinedGame } from "../helpers";

type Listener = (...args: any[]) => void;

interface GameClientSocket {
  emit: (event: GameEvent, ...args: any[]) => void;
}

interface WireMessage {
  event: string;
  args: any[];
}

const MAX_RECONNECT_DELAY_MS = 15000;
const MAX_OUTBOX = 50;

/**
 * Where the game's WebSocket lives: the same origin as the page. In
 * production the Worker serves both; in development the Vite dev server
 * proxies /ws to `wrangler dev`. VITE_WS_URL overrides it if needed.
 */
const getWsBase = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return proto + "//" + window.location.host;
};

/**
 * Thin WebSocket client with the same surface the components used with
 * socket.io: `socket.emit(event, ...args)`, `listenForEvent(event, fn)` and
 * `disconnect()`. Messages are JSON `{ event, args }` in both directions.
 */
export class SocketService {
  private pageType: PageType;
  private gameId: string | null;

  private ws: WebSocket | null = null;
  private listeners: Map<string, Listener[]> = new Map();
  private outbox: string[] = [];
  private closedByUser = false;
  private hasConnectedOnce = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public socket: GameClientSocket;

  constructor(type: PageType, gameId: string | null) {
    this.pageType = type;
    this.gameId = gameId;
    this.socket = {
      emit: (event: GameEvent, ...args: any[]) => this.send(event, args),
    };

    if (!this.gameId) {
      console.log("socket service: no game id, not connecting");
    }
    // The connection is opened lazily on first use. Components construct
    // this service during render, and React (StrictMode in particular) may
    // throw a render away; an eagerly opened socket would then leak.
  }

  public listenForEvent(event: GameEvent, fn: Function): void {
    const existing = this.listeners.get(event) || [];
    existing.push(fn as Listener);
    this.listeners.set(event, existing);
    this.ensureConnected();
  }

  private ensureConnected(): void {
    if (!this.gameId || this.ws) {
      return;
    }
    this.closedByUser = false;
    console.log("initiating socket service for game " + this.gameId);
    this.connect();
  }

  // disconnect - used when unmounting
  public disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "client left");
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
  }

  private connect(): void {
    if (!this.gameId || this.closedByUser) {
      return;
    }

    const url =
      getWsBase() + "/ws?gameId=" + encodeURIComponent(this.gameId);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) {
        return;
      }
      this.reconnectAttempts = 0;
      this.announce();
      this.flushOutbox();
    };

    ws.onmessage = (ev: MessageEvent) => {
      this.dispatch(ev.data);
    };

    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
      }
      if (!this.closedByUser) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose follows and handles reconnecting
    };
  }

  /** Mirrors what the old socket.io client emitted right after connecting. */
  private announce(): void {
    if (!this.hasConnectedOnce) {
      this.hasConnectedOnce = true;

      if (
        this.pageType === PageType.Join &&
        hasJoinedGame() &&
        getMyPlayerName() !== null &&
        getMyUserId() !== null
      ) {
        this.sendNow(GameEvent.JOINED_GAME, [
          {
            playerName: getMyPlayerName()!,
            userId: getMyUserId()!,
            gameId: this.gameId,
            allJoined: false,
          },
        ]);
      }
    }

    this.sendNow(GameEvent.JOIN_GAME_ROOM, [
      this.gameId,
      getMyUserId(),
      getMyPlayerName(),
    ]);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(event: GameEvent, args: any[]): void {
    if (!this.gameId) {
      return;
    }
    this.ensureConnected();
    const payload = JSON.stringify({ event, args } as WireMessage);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      // queue until (re)connected
      this.outbox.push(payload);
      if (this.outbox.length > MAX_OUTBOX) {
        this.outbox.shift();
      }
    }
  }

  private sendNow(event: GameEvent, args: any[]): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, args } as WireMessage));
    }
  }

  private flushOutbox(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const queued = this.outbox;
    this.outbox = [];
    for (const payload of queued) {
      this.ws.send(payload);
    }
  }

  private dispatch(raw: unknown): void {
    if (typeof raw !== "string") {
      return;
    }
    let msg: WireMessage;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!msg || typeof msg.event !== "string") {
      return;
    }
    const args = Array.isArray(msg.args) ? msg.args : [];
    const fns = this.listeners.get(msg.event);
    if (fns) {
      for (const fn of fns) {
        try {
          fn(...args);
        } catch (e) {
          console.log("socket listener failed", msg.event, e);
        }
      }
    }
  }
}
