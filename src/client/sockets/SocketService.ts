import { Manager, Socket } from "socket.io-client";
import { PageType } from "../../core/enums/PageType";
import { GameEvent } from "../../core/types/GameEvent";
import {
  getMyGameId,
  getMyPlayerName,
  getMyUserId,
  hasJoinedGame,
} from "../helpers";

interface GameClientSocket extends Socket {
  playerName?: string;
  userId?: string;
  gameId?: string;
  latency?: number;
}

export class SocketService {
  private pageType: PageType;
  private manager: Manager;
  public socket: GameClientSocket;

  constructor(type: PageType) {
    console.log("initiating socket service");

    this.manager = new Manager("ws://localhost:8080");
    this.socket = this.manager.socket("/");
    this.pageType = type;

    if (this.pageType === PageType.Join) {
      if (
        hasJoinedGame() &&
        getMyPlayerName() !== null &&
        getMyUserId() !== null
      ) {
        this.socket.emit(GameEvent.JOINED_GAME, {
          playerName: getMyPlayerName()!,
          userId: getMyUserId()!,
          gameId: getMyGameId()!,
          allJoined: false,
        });
      }
    }

    if (getMyGameId() !== null) {
      this.socket.emit(
        GameEvent.JOIN_GAME_ROOM,
        getMyGameId(),
        getMyUserId(),
        getMyPlayerName()
      );
    }
  }

  public listenForEvent(event: GameEvent, fn: Function): void {
    this.socket.on(event, fn);
  }

  public sendPingToServer(): void {
    setInterval(() => {
      this.socket.volatile.emit(
        GameEvent.GET_LATENCY,
        Date.now(),
        getMyGameId()
      );
    }, 10000);
  }

  // disconnect - used when unmounting
  public disconnect(): void {
    this.socket.disconnect();
  }
}
