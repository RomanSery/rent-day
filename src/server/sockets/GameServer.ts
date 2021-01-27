import { Server } from "socket.io";
import mongoose from "mongoose";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg, LatencyInfoMsg } from "../../core/types/messages";
import { GameSocket } from "../../core/types/GameSocket";
import { AuctionProcessor } from "../controllers/AuctionProcessor";
import { AuctionDocument } from "../../core/schema/AuctionSchema";
import { GameProcessor } from "../controllers/GameProcessor";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { LottoDocument } from "../../core/schema/LottoSchema";
import { LottoProcessor } from "../controllers/LottoProcessor";
import { TradeProcessor } from "../controllers/TradeProcessor";
import { TradeDocument } from "../../core/schema/TradeSchema";

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

      this.joinedGame(socket);
      this.joinGameRoom(socket);
      this.leaveGame(socket);
      this.getLatency(socket);

      socket.on(GameEvent.DISCONNECT, (reason) => {
        console.log(
          "Player disconnected: %s reason: %s",
          socket.playerName,
          reason
        );
      });

      this.updateGameState(socket);

      socket.on(GameEvent.ROLL_DICE, (gameId: string) => {
        this.io.in(gameId).emit(GameEvent.ANIMATE_DICE);
      });

      this.auctionEvents(socket);
      this.tradeEvents(socket);
      this.lottoEvents(socket);

      socket.on(GameEvent.SHOW_SNACK_MSG, (gameId: string, msg: string) => {
        socket.to(gameId).broadcast.emit(GameEvent.SHOW_SNACK_MSG, msg);
      });
    });
  }

  private updateGameState(socket: GameSocket): void {
    socket.on(GameEvent.UPDATE_GAME_STATE, async (gameId: string) => {
      const gameState: GameInstanceDocument = await GameProcessor.getGame(
        new mongoose.Types.ObjectId(gameId)
      );
      this.io.in(gameId).emit(GameEvent.UPDATE_GAME_STATE, gameState);
    });
  }

  private auctionEvents(socket: GameSocket): void {
    socket.on(
      GameEvent.AUCTION_BID,
      async (gameId: string, auctionId: string) => {
        const auction: AuctionDocument = await AuctionProcessor.getAuction(
          new mongoose.Types.ObjectId(auctionId),
          new mongoose.Types.ObjectId(socket.userId)
        );

        this.io.in(gameId).emit(GameEvent.AUCTION_UPDATE, auction);
      }
    );
  }

  private tradeEvents(socket: GameSocket): void {
    socket.on(GameEvent.SEND_TRADE_OFFER, async (tradeId: string) => {
      const tradeOffer: TradeDocument = await TradeProcessor.getTrade(
        new mongoose.Types.ObjectId(tradeId)
      );

      this.io
        .in(tradeOffer.gameId.toHexString())
        .emit(GameEvent.SEND_TRADE_OFFER, tradeOffer);
    });
  }

  private lottoEvents(socket: GameSocket): void {
    socket.on(
      GameEvent.LOTTO_UPDATE,
      async (gameId: string, lottoId: string) => {
        const lotto: LottoDocument = await LottoProcessor.getLotto(
          new mongoose.Types.ObjectId(lottoId)
        );

        this.io.in(gameId).emit(GameEvent.LOTTO_UPDATE, lotto);
      }
    );
  }

  private getLatency(socket: GameSocket): void {
    socket.on(GameEvent.GET_LATENCY, (start, gameId: string) => {
      const latency = Date.now() - start;
      socket.latency = latency;

      const info: LatencyInfoMsg[] = [];
      this.io
        .of("/")
        .in(gameId)
        .sockets.forEach((s) => {
          const gameSocket = s as GameSocket;
          info.push({
            userId: gameSocket.userId,
            latency: gameSocket.latency,
          });
        });

      socket.to(gameId).broadcast.emit(GameEvent.GET_LATENCY, info);
    });
  }

  private joinedGame(socket: GameSocket): void {
    socket.on(GameEvent.JOINED_GAME, (m: JoinedGameMsg) => {
      socket.playerName = m.playerName;
      socket.userId = m.userId;
      socket.gameId = m.gameId;
      socket.latency = 0;

      socket.join(m.gameId);
      socket.to(m.gameId).broadcast.emit(GameEvent.JOINED_GAME, m);
    });
  }

  private joinGameRoom(socket: GameSocket): void {
    socket.on(
      GameEvent.JOIN_GAME_ROOM,
      (gameId: string, userId: string, playerName: string) => {
        console.log("joined game room %s", gameId);
        socket.playerName = playerName;
        socket.userId = userId;
        socket.gameId = gameId;
        socket.latency = 0;
        socket.join(gameId);
      }
    );
  }

  private leaveGame(socket: GameSocket): void {
    socket.on(GameEvent.LEAVE_GAME, (gameId: string) => {
      socket.leave(gameId);
      socket
        .to(gameId)
        .broadcast.emit(GameEvent.LEAVE_GAME, socket.playerName + " has left");
    });
  }
}
