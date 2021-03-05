import { Server } from "socket.io";
import mongoose from "mongoose";
import { GameEvent } from "../../core/types/GameEvent";
import { JoinedGameMsg, LatencyInfoMsg } from "../../core/types/messages";
import { GameSocket } from "../../core/types/GameSocket";
import { DiceRollResult } from "../../core/types/DiceRollResult";
import { AuctionProcessor } from "../controllers/AuctionProcessor";
import { AuctionDocument } from "../../core/schema/AuctionSchema";
import { GameProcessor } from "../controllers/GameProcessor";
import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { LottoDocument } from "../../core/schema/LottoSchema";
import { LottoProcessor } from "../controllers/LottoProcessor";
import { TradeProcessor } from "../controllers/TradeProcessor";
import { TradeDocument } from "../../core/schema/TradeSchema";

export class GameServer {
  public static readonly DEFAULT_WS_PORT: number = 5000;

  private io: Server;
  private port: number;

  constructor() {
    if (process.env.WS_PORT) {
      this.port = parseInt(process.env.WS_PORT);
    } else {
      this.port = GameServer.DEFAULT_WS_PORT;
    }

    const options = {
      pingTimeout: 5000,
      pingInterval: 10000,
      cors: {
        origin: [
          "http://localhost:3000",
          "http://localhost:8000",
          "https://rentdaygame.coderdreams.com",
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
    };
    this.io = new Server(this.port, options);
    console.log("GameServer listening on port: " + this.port);
  }

  public listen(): void {
    this.io.on(GameEvent.CONNECT, (socket: GameSocket) => {
      this.joinedGame(socket);
      this.joinGameRoom(socket);
      this.leaveGame(socket);
      this.getLatency(socket);

      socket.on(GameEvent.DISCONNECT, (reason) => {
        socket
          .to(socket.gameId)
          .broadcast.emit(
            GameEvent.SHOW_SNACK_MSG,
            socket.playerName + " disconnected: " + reason
          );
      });

      this.updateGameState(socket);

      socket.on(GameEvent.ROLL_DICE, (gameId: string) => {
        this.io.in(gameId).emit(GameEvent.ANIMATE_DICE);
      });
      socket.on(
        GameEvent.STOP_ANIMATE_DICE,
        (gameId: string, diceRoll: DiceRollResult) => {
          this.io.in(gameId).emit(GameEvent.STOP_ANIMATE_DICE, diceRoll);
        }
      );

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
      const gameState: GameInstanceDocument | null = await GameProcessor.getGame(
        new mongoose.Types.ObjectId(gameId)
      );
      this.io.in(gameId).emit(GameEvent.UPDATE_GAME_STATE, gameState);
    });
  }

  private auctionEvents(socket: GameSocket): void {
    socket.on(
      GameEvent.AUCTION_BID,
      async (gameId: string, auctionId: string) => {
        const auction: AuctionDocument | null = await AuctionProcessor.getAuction(
          new mongoose.Types.ObjectId(auctionId),
          new mongoose.Types.ObjectId(socket.userId)
        );

        this.io.in(gameId).emit(GameEvent.AUCTION_UPDATE, auction);
      }
    );
  }

  private tradeEvents(socket: GameSocket): void {
    socket.on(GameEvent.SEND_TRADE_OFFER, async (tradeId: string) => {
      const tradeOffer: TradeDocument | null = await TradeProcessor.getTrade(
        new mongoose.Types.ObjectId(tradeId)
      );

      if (tradeOffer) {
        this.io
          .in(tradeOffer.gameId.toHexString())
          .emit(GameEvent.SEND_TRADE_OFFER, tradeOffer);
      }
    });

    socket.on(GameEvent.TRADE_OFFER_REVIEWED, async (tradeId: string) => {
      const tradeOffer: TradeDocument | null = await TradeProcessor.getTrade(
        new mongoose.Types.ObjectId(tradeId)
      );

      if (tradeOffer) {
        this.io
          .in(tradeOffer.gameId.toHexString())
          .emit(GameEvent.TRADE_OFFER_REVIEWED, tradeOffer);
      }
    });
  }

  private lottoEvents(socket: GameSocket): void {
    socket.on(
      GameEvent.LOTTO_UPDATE,
      async (gameId: string, lottoId: string) => {
        const lotto: LottoDocument | null = await LottoProcessor.getLotto(
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
        socket.playerName = playerName;
        socket.userId = userId;
        socket.gameId = gameId;
        socket.latency = 0;
        socket.join(gameId);

        socket
          .to(socket.gameId)
          .broadcast.emit(
            GameEvent.SHOW_SNACK_MSG,
            socket.playerName + " re-connected"
          );
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
