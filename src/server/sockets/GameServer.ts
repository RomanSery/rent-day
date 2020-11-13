import ioserver, { Socket } from "socket.io";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg } from "../../core/types/messages";

export class GameServer {
  public static readonly PORT: number = 8080;

  private io: SocketIO.Server;
  private port: string | number;

  constructor() {
    this.port = process.env.PORT || GameServer.PORT;

    const options = {
      pingTimeout: 5000,
    };
    this.io = ioserver(this.port, options);
  }

  public listen(): void {
    console.log("listen called");

    this.io.on(GameEvent.CONNECT, (socket: Socket) => {
      console.log("Connected client on port %s.", this.port);

      socket.on(GameEvent.JOINED_GAME, (m: JoinedGameMsg) => {
        console.log("[server](JoinedGameMsg recieved): %s", JSON.stringify(m));
        this.io.emit(GameEvent.JOINED_GAME, m);
      });

      socket.on(GameEvent.DISCONNECT, () => {
        console.log("Client disconnected");
      });
    });
  }
}
