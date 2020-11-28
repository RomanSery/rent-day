import { Manager, Socket } from "socket.io-client";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg } from "../../core/types/messages";
import {
  getMyGameId,
  getMyPlayerId,
  getMyPlayerName,
  hasJoinedGame,
} from "../helpers";

interface GameClientSocket extends Socket {
  playerName?: string;
  playerId?: string;
  gameId?: string;
  latency?: number;
}

export class SocketService {
  private manager;
  public socket: GameClientSocket;

  constructor() {
    console.log("initiating socket service");

    this.manager = new Manager("ws://localhost:8080");
    this.socket = this.manager.socket("/");

    if (
      hasJoinedGame() &&
      getMyPlayerName() !== null &&
      getMyPlayerId() !== null
    ) {
      this.socket.emit(GameEvent.JOINED_GAME, {
        playerName: getMyPlayerName()!,
        playerId: getMyPlayerId()!,
        gameId: getMyGameId()!,
        allJoined: false,
      });
    } else if (getMyGameId() !== null) {
      this.socket.emit(GameEvent.JOIN_GAME_ROOM, getMyGameId());
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
