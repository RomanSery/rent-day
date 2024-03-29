import { Auction, AuctionDocument } from "../../core/schema/AuctionSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Bidder } from "../../core/types/Bidder";
import { Player } from "../../core/types/Player";
import { PlayerState } from "../../core/enums/PlayerState";
import { PropertyProcessor } from "./PropertyProcessor";
import { SquareConfigDataMap } from "../../core/config/SquareData";
import { SquareType } from "../../core/enums/SquareType";
import { SquareGameData } from "../../core/types/SquareGameData";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { GameStatus } from "../../core/enums/GameStatus";
import { ChatMsg } from "../../core/types/ChatMsg";
import { dollarFormatterServer } from "./helpers";
import { auctionTimeLimit, turnTimeLimit } from "../../core/constants";
import { addSeconds, formatISO, isFuture, parseISO } from "date-fns";

export class AuctionProcessor {
  private bid: number;
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private auction?: AuctionDocument | null;

  constructor(
    bid: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.bid = bid;
    this.gameId = gameId;
    this.userId = userId;
  }

  private async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.auction = await Auction.findById(this.game.auctionId);
    }
  }

  public async placeBid(): Promise<string> {
    await this.init();

    if (this.game == null) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (this.game.auctionId == null) {
      return "no active auction";
    }

    const playerToBid = this.game.players.find(
      (p) => p._id && new mongoose.Types.ObjectId(p._id).equals(this.userId)
    );
    if (playerToBid == null) {
      return "player not found!";
    }
    if (playerToBid.state === PlayerState.BANKRUPT) {
      return playerToBid.name + " is bankrupt";
    }

    if (this.auction == null) {
      return "auction not found";
    }
    if (this.auction.finished) {
      return "auction is finished";
    }

    const myBid = this.auction.bidders.find(
      (b) => b._id && new mongoose.Types.ObjectId(b._id).equals(this.userId)
    );
    if (myBid == null) {
      return "player bid not found!";
    }
    if (myBid.bid) {
      return "player already placed bid";
    }

    if (this.bid < 0) {
      return "bid cant be less than 0";
    }
    if (this.bid > 0 && this.bid > playerToBid.money) {
      return "bid cant be more than what you have";
    }

    myBid.bid = this.bid;
    myBid.submittedBid = true;
    if (this.isAuctionDone()) {
      this.determineWinner();

      if (this.game) {
        this.game.auctionId = null;
        this.game.auctionSquareId = null;
        this.game.save();
      }
    }

    this.auction.save();
    return "";
  }

  public async autoBid(): Promise<string> {
    await this.init();

    if (this.game == null) {
      return "game not found";
    }
    if (this.game.status !== GameStatus.ACTIVE) {
      return "Game is not active";
    }
    if (this.game.auctionId == null) {
      return "no active auction";
    }
    if (this.auction == null) {
      return "auction not found";
    }
    if (this.auction.finished) {
      return "auction is finished";
    }

    if (!this.auction.endsAt) {
      return "";
    }

    const endsAt = parseISO(this.auction.endsAt);
    if (isFuture(endsAt)) {
      return "";
    }

    this.auction.bidders.forEach((b: Bidder, key: number) => {
      if (!b.submittedBid) {
        b.bid = 0;
        b.submittedBid = true;
        b.autoBid = true;
      }
    });

    this.determineWinner();

    if (this.game) {
      this.game.auctionId = null;
      this.game.auctionSquareId = null;

      const now = new Date();
      const actBy = addSeconds(now, turnTimeLimit);
      this.game.nextPlayerActBy = formatISO(actBy);

      this.game.save();
    }

    this.auction.save();
    return "";
  }

  private isAuctionDone(): boolean {
    return this.auction!.bidders.every((b) => b.bid != null);
  }

  private determineWinner(): void {
    if (!this.auction || !this.game) {
      return;
    }
    this.auction.finished = true;

    this.auction.bidders.sort((a, b) => (a.bid! > b.bid! ? -1 : 1));

    const winner = this.auction.bidders[0];
    if (this.isTie(winner.bid!)) {
      this.auction.isTie = true;
    } else {
      this.auction.winnerId = new mongoose.Types.ObjectId(winner._id);
      const processor = new PropertyProcessor(
        this.auction.squareId,
        this.gameId,
        this.userId
      );

      const priceToPay: number = this.getPriceToPay();
      processor.purchaseSquare(this.game, winner, priceToPay);

      const playerWinner = this.game.players.find(
        (p) =>
          p._id &&
          new mongoose.Types.ObjectId(p._id).equals(this.auction!.winnerId)
      );
      if (playerWinner && priceToPay) {
        playerWinner.money = Math.round(playerWinner.money - priceToPay);
        PlayerCostsCalculator.updatePlayerCosts(this.game, playerWinner);

        const squareTheme = this.game.theme.get(
          this.auction.squareId.toString()
        );
        if (squareTheme) {
          const newMsg: ChatMsg = {
            msg:
              "<b>" +
              playerWinner.name +
              "</b>" +
              " won the auction for " +
              squareTheme.name +
              " and payed " +
              dollarFormatterServer.format(priceToPay),
          };
          this.game.log.push(newMsg);
        }
      }
    }
  }

  private getPriceToPay(): number {
    const bids: Array<number> = [];
    this.auction!.bidders.forEach((b) => {
      if (!b.autoBid) {
        bids.push(b.bid!);
      }
    });

    bids.sort((a, b) => (a > b ? -1 : 1));
    if (bids.length === 1) {
      return bids[0];
    }
    return bids[1];
  }

  private isTie(winningBid: number): boolean {
    const count = this.auction!.bidders.filter((b) => b.bid === winningBid)
      .length;
    return count > 1;
  }

  public static async getAuction(
    auctionId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<AuctionDocument | null> {
    let found: AuctionDocument | null = await Auction.findById(
      auctionId,
      (err: mongoose.CallbackError, existingAuction: AuctionDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingAuction;
      }
    );

    if (found && !found.finished) {
      //for security purposes if auction is not finished, dont return real bid amounts
      found.bidders.forEach((b) => {
        if (!new mongoose.Types.ObjectId(b._id).equals(userId)) {
          b.bid = 0;
        }
      });
    }

    return found;
  }

  public static async createAuction(
    game: GameInstanceDocument,
    player: Player
  ): Promise<AuctionDocument> {
    const now = new Date();
    const actBy = addSeconds(now, auctionTimeLimit);

    const newAuction: AuctionDocument = new Auction({
      gameId: game.id,
      squareId: player.position,
      finished: false,
      bidders: AuctionProcessor.getBidders(game),
      endsAt: formatISO(actBy),
    });

    await newAuction.save();
    return newAuction;
  }

  private static getBidders(game: GameInstanceDocument): Array<Bidder> {
    const bidders: Array<Bidder> = [];

    game.players.forEach((p: Player, key: number) => {
      if (
        p.state === PlayerState.ACTIVE ||
        p.state === PlayerState.IN_ISOLATION
      ) {
        const newBidder: Bidder = {
          name: p.name,
          type: p.type,
          color: p.color,
          _id: p._id,
          submittedBid: false,
        };
        bidders.push(newBidder);
      }
    });

    return bidders;
  }

  public static shouldCreateAuction(
    game: GameInstanceDocument,
    squareId: number
  ): boolean {
    const squareConfig = SquareConfigDataMap.get(squareId);
    if (!squareConfig) {
      return false;
    }
    if (
      squareConfig.type !== SquareType.Property &&
      squareConfig.type !== SquareType.TrainStation &&
      squareConfig.type !== SquareType.Utility
    ) {
      return false;
    }

    const squareData: SquareGameData | undefined = game.squareState.find(
      (p: SquareGameData) => p.squareId === squareId
    );
    if (squareData == null) {
      return true;
    }
    if (squareData.owner == null) {
      return true;
    }

    return false;
  }
}
