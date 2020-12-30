import { Auction, AuctionDocument } from "../../core/schema/AuctionSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { GameContext } from "../../core/types/GameContext";
import { Bidder } from "../../core/types/Bidder";
import { SquareGameData } from "../../core/types/SquareGameData";

export class AuctionProcessor {
  private bid: number;
  private context: GameContext;
  private game?: GameInstanceDocument | null;
  private auction?: AuctionDocument | null;

  constructor(bid: number, context: GameContext) {
    this.bid = bid;
    this.context = context;
  }

  public async init(): Promise<void> {
    this.game = await GameInstance.findById(this.context.gameId);
    if (this.game) {
      this.auction = await Auction.findById(this.game.auctionId);
    }
  }

  public async placeBid(): Promise<void> {
    const myBid = this.auction!.bidders.find(
      (b) => b._id && b._id.toString() === this.context.playerId
    );
    if (myBid && this.auction) {
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
    }
  }

  private isAuctionDone(): boolean {
    return this.auction!.bidders.every((b) => b.bid != null);
  }

  private determineWinner(): void {
    if (!this.auction) {
      return;
    }
    this.auction.finished = true;

    this.auction.bidders.sort((a, b) => (a.bid! > b.bid! ? -1 : 1));

    const winner = this.auction.bidders[0];
    if (this.isTie(winner.bid!)) {
      this.auction.isTie = true;
    } else {
      this.auction.winnerId = new mongoose.Types.ObjectId(winner._id);
      this.purchaseSquare(winner);
    }
  }

  private isTie(winningBid: number): boolean {
    const count = this.auction!.bidders.filter((b) => b.bid == winningBid)
      .length;
    return count > 1;
  }

  private purchaseSquare(winner: Bidder): void {
    if (!this.game || !this.auction) {
      return;
    }
    const squareId = this.auction.squareId.toString();
    if (!this.game.squareState) {
      this.game.squareState = new Map<string, SquareGameData>();
    }

    this.game.squareState.set(squareId, {
      owner: winner._id!,
      numHouses: 0,
      isMortgaged: false,
      color: winner.color!,
      purchasePrice: winner.bid!,
    });
  }

  public async getErrMsg(): Promise<string> {
    if (this.game == null) {
      return "game not found";
    }
    if (this.game.auctionId == null) {
      return "no active auction";
    }

    const playerToBid = this.game.players.find(
      (p) => p._id && p._id.toString() === this.context.playerId
    );
    if (playerToBid == null) {
      return "player not found!";
    }

    if (this.auction == null) {
      return "auction not found";
    }
    if (this.auction.finished) {
      return "auction is finished";
    }

    const myBid = this.auction.bidders.find(
      (b) => b._id && b._id.toString() === this.context.playerId
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
    if (this.bid > playerToBid.money) {
      return "bid cant be more than what you have";
    }

    return "";
  }

  public async getAuction(
    auctionId: string,
    playerId: string
  ): Promise<AuctionDocument> {
    let found: AuctionDocument = await Auction.findById(
      auctionId,
      (err: mongoose.CallbackError, existingAuction: AuctionDocument) => {
        if (err) {
          return console.log(err);
        }
        return existingAuction;
      }
    );

    if (!found.finished) {
      //for security purposes if auction is not finished, dont return real bid amounts
      found.bidders.forEach((b) => {
        if (b._id != playerId) {
          b.bid = 0;
        }
      });
    }

    return found;
  }
}
