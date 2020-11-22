import { Server, Socket } from "socket.io";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg } from "../../core/types/messages";

export class GameServer {
  public static readonly PORT: number = 8080;

  private io: Server;
  private port: number;

  constructor() {
    //this.port = process.env.PORT || GameServer.PORT;
    this.port = GameServer.PORT;

    const options = {
      pingTimeout: 5000,
      pingInterval: 10000,
      cors: {
        origin: ["http://localhost:3000", "http://localhost:8000"],
        methods: ["GET", "POST"],
        credentials: true,
      },
    };
    this.io = new Server(this.port, options);
  }

  public listen(): void {
    this.io.on(GameEvent.CONNECT, (socket: Socket) => {
      console.log("Connected client on port %s.", this.port);

      socket.on(GameEvent.JOINED_GAME, (m: JoinedGameMsg) => {
        console.log("[server](JoinedGameMsg recieved): %s", JSON.stringify(m));

        // @ts-ignore: dont know what to do here
        socket.playerName = m.playerName;
        // @ts-ignore: dont know what to do here
        socket.playerId = m.playerName;

        socket.broadcast.emit(GameEvent.JOINED_GAME, m);
      });

      socket.on(GameEvent.DISCONNECT, (reason) => {
        console.log(
          // @ts-ignore: dont know what to do here
          "Player disconnected: " + socket.playerName + " reason: " + reason
        );
      });
    });

    this.io.on("ping", (socket: Socket) => {
      console.log("server recieved ping");
    });
  }
}
