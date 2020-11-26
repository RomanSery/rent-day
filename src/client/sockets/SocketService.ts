import { Manager, Socket } from "socket.io-client";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg } from "../../core/types/messages";
import { getMyPlayerId, getMyPlayerName, hasJoinedGame } from "../helpers";
//import { GameSocket } from "../../core/types/GameSocket";

interface GameClientSocket extends Socket {
  playerName?: string;
  playerId?: string;
  latency?: number;
}

export class SocketService {
  private manager;
  private socket: GameClientSocket;

  constructor() {
    console.log("initiating socket service");

    this.manager = new Manager("ws://localhost:8080");
    this.socket = this.manager.socket("/");

    if (
      hasJoinedGame() &&
      getMyPlayerName() !== null &&
      getMyPlayerId() !== null
    ) {
      this.socket.playerName = getMyPlayerName()!;
      this.socket.playerId = getMyPlayerId()!;
      this.socket.latency = 0;
      this.sendJoinedGame({
        playerName: getMyPlayerName()!,
        playerId: getMyPlayerId()!,
        allJoined: false,
      });
    }
  }

  // send a message for the server to broadcast
  public sendJoinedGame(message: JoinedGameMsg): void {
    console.log("emitting JoinedGameMsg: " + message);
    this.socket.emit(GameEvent.JOINED_GAME, message);
  }

  public listenForEvent(event: GameEvent, fn: Function): void {
    console.log("listenining for: " + event);
    this.socket.on(event, fn);
  }

  public sendPingToServer(): void {
    setInterval(() => {
      this.socket.volatile.emit(GameEvent.GET_LATENCY, Date.now());
    }, 10000);
  }

  // disconnect - used when unmounting
  public disconnect(): void {
    this.socket.disconnect();
  }
}
