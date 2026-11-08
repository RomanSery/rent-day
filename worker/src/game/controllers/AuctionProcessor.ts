import { Bidder } from "@core/types/Bidder";
import { Player } from "@core/types/Player";
import { PlayerState } from "@core/enums/PlayerState";
import { SquareConfigDataMap } from "@core/config/SquareData";
import { SquareType } from "@core/enums/SquareType";
import { SquareGameData } from "@core/types/SquareGameData";
import { GameStatus } from "@core/enums/GameStatus";
import { ChatMsg } from "@core/types/ChatMsg";
import { auctionTimeLimit, turnTimeLimit } from "@core/constants";
import { addSeconds, formatISO, isFuture, parseISO } from "date-fns";
import { AuctionDocument, GameInstanceDocument } from "../model";
import { GameContext } from "../GameContext";
import { newId } from "../ids";
import { PropertyProcessor } from "./PropertyProcessor";
import { PlayerCostsCalculator } from "./PlayerCostsCalculator";
import { areIdsEqual, dollarFormatterServer } from "./helpers";

export class AuctionProcessor {
  private ctx: GameContext;
  private bid: number;
  private userId: string;
  private game?: GameInstanceDocument | null;
  private auction?: AuctionDocument | null;

  constructor(ctx: GameContext, bid: number, userId: string) {
    this.ctx = ctx;
    this.bid = bid;
    this.userId = userId;
  }

  private async init(): Promise<void> {
    this.game = await this.ctx.store.getGame();
    if (this.game) {
      this.auction = await this.ctx.store.getAuction(this.game.auctionId);
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
      (p) => p._id && areIdsEqual(p._id, this.userId)
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
      (b) => b._id && areIdsEqual(b._id, this.userId)
    );
    if (myBid == null) {
      return "player bid not found!";
    }
    // a bid of 0 is a valid bid, so check the flag rather than the amount
    if (myBid.submittedBid || myBid.bid != null) {
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
        await this.ctx.store.saveGame(this.game);
      }
    }

    await this.ctx.store.saveAuction(this.auction);
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

    this.auction.bidders.forEach((b: Bidder) => {
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

      await this.ctx.store.saveGame(this.game);
    }

    await this.ctx.store.saveAuction(this.auction);
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
      this.auction.winnerId = winner._id;

      const priceToPay: number = this.getPriceToPay();
      PropertyProcessor.purchaseSquare(
        this.game,
        this.auction.squareId,
        winner,
        priceToPay
      );

      const playerWinner = this.game.players.find(
        (p) => p._id && areIdsEqual(p._id, this.auction!.winnerId)
      );
      if (playerWinner && priceToPay) {
        playerWinner.money = Math.round(playerWinner.money - priceToPay);
        PlayerCostsCalculator.updatePlayerCosts(this.game, playerWinner);

        const squareTheme = this.game.theme[this.auction.squareId.toString()];
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

  /**
   * Returns the auction as the given user may see it: while the auction is
   * still open, other players' bids are hidden.
   */
  public static async getAuction(
    ctx: GameContext,
    auctionId: string,
    userId: string
  ): Promise<AuctionDocument | null> {
    const found: AuctionDocument | null = await ctx.store.getAuction(auctionId);
    return AuctionProcessor.viewFor(found, userId);
  }

  public static viewFor(
    auction: AuctionDocument | null,
    userId: string
  ): AuctionDocument | null {
    if (!auction) {
      return null;
    }
    if (auction.finished) {
      return auction;
    }

    //for security purposes if auction is not finished, dont return real bid amounts
    return {
      ...auction,
      bidders: auction.bidders.map((b) =>
        areIdsEqual(b._id, userId) ? { ...b } : { ...b, bid: 0 }
      ),
    };
  }

  public static async createAuction(
    ctx: GameContext,
    game: GameInstanceDocument,
    player: Player
  ): Promise<AuctionDocument> {
    const now = new Date();
    const actBy = addSeconds(now, auctionTimeLimit);

    const newAuction: AuctionDocument = {
      _id: newId(),
      gameId: game._id,
      squareId: player.position,
      finished: false,
      isTie: false,
      winnerId: null,
      bidders: AuctionProcessor.getBidders(game),
      endsAt: formatISO(actBy),
      createdAt: formatISO(now),
    };

    await ctx.store.saveAuction(newAuction);
    return newAuction;
  }

  private static getBidders(game: GameInstanceDocument): Array<Bidder> {
    const bidders: Array<Bidder> = [];

    game.players.forEach((p: Player) => {
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
