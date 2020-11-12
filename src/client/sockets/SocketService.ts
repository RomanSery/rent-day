import io from "socket.io-client";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg } from "../../core/types/messages";

export class SocketService {
  private socket: SocketIOClient.Socket = {} as SocketIOClient.Socket;

  constructor() {
    console.log("initiating socket service");
    this.socket = io("localhost:8080");
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

  // disconnect - used when unmounting
  public disconnect(): void {
    this.socket.disconnect();
  }
}
