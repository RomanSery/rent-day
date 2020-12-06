import { Server } from "socket.io";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg, LatencyInfoMsg } from "../../core/types/messages";
import { GameSocket } from "../../core/types/GameSocket";

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
    this.io.on(GameEvent.CONNECT, (socket: GameSocket) => {
      console.log("Connected client on port %s", this.port);

      socket.on(GameEvent.JOINED_GAME, (m: JoinedGameMsg) => {
        socket.playerName = m.playerName;
        socket.playerId = m.playerId;
        socket.gameId = m.gameId;
        socket.latency = 0;

        socket.join(m.gameId);
        socket.to(m.gameId).broadcast.emit(GameEvent.JOINED_GAME, m);
      });

      socket.on(
        GameEvent.JOIN_GAME_ROOM,
        (gameId: string, playerId: string, playerName: string) => {
          console.log("joined game room %s", gameId);
          socket.playerName = playerName;
          socket.playerId = playerId;
          socket.gameId = gameId;
          socket.latency = 0;
          socket.join(gameId);
        }
      );

      socket.on(GameEvent.LEAVE_GAME, (gameId: string) => {
        socket.leave(gameId);
        socket
          .to(gameId)
          .broadcast.emit(
            GameEvent.LEAVE_GAME,
            socket.playerName + " has left"
          );
      });

      socket.on(GameEvent.DISCONNECT, (reason) => {
        console.log(
          "Player disconnected: %s reason: %s",
          socket.playerName,
          reason
        );
      });

      socket.on(GameEvent.GET_LATENCY, (start, gameId: string) => {
        const latency = Date.now() - start;
        socket.latency = latency;

        const info: LatencyInfoMsg[] = [];
        this.io
          .of("/")
          .in(gameId)
          .sockets.forEach((s) => {
            const gameSocket = <GameSocket>s;
            info.push({
              playerId: gameSocket.playerId,
              latency: gameSocket.latency,
            });
          });

        socket.to(gameId).broadcast.emit(GameEvent.GET_LATENCY, info);
      });

      socket.on(GameEvent.UPDATE_GAME_STATE, (gameId: string) => {
        this.io.in(gameId).emit(GameEvent.UPDATE_GAME_STATE);
      });
    });
  }
}
