import ioserver from "socket.io";
import { GameEvent } from "./constants";
import { ChatMessage } from "./types";

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
    this.io.on(GameEvent.CONNECT, (socket: any) => {
      console.log("Connected client on port %s.", this.port);

      socket.on(GameEvent.MESSAGE, (m: ChatMessage) => {
        console.log("[server](message): %s", JSON.stringify(m));
        this.io.emit("message", m);
      });

      socket.on(GameEvent.DISCONNECT, () => {
        console.log("Client disconnected");
      });
    });
  }
}
