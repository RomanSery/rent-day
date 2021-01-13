import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";
import { Bidder } from "../../core/types/Bidder";
import { SquareGameData } from "../../core/types/SquareGameData";

export class PropertyProcessor {
  private squareId: number;
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private state: SquareGameData | undefined;

  constructor(
    squareId: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.squareId = squareId;
    this.gameId = gameId;
    this.userId = userId;
  }

  public async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.state = this.game.squareState.find(
        (p: SquareGameData) => p.squareId === this.squareId
      );
    }
  }

  public async mortgageProperty(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.state) {
      return "property not owned";
    }
    if (this.state.isMortgaged) {
      return "property already mortgaged";
    }

    const ownerId = new mongoose.Types.ObjectId(this.state.owner);
    if (!this.userId.equals(ownerId)) {
      return "you are not the owner";
    }

    this.state.isMortgaged = true;
    await this.game.save();
    console.log("square %s mortgaged", this.squareId);
    return "";
  }

  public async redeemProperty(): Promise<string> {
    await this.init();

    if (!this.game) {
      return "game not found";
    }
    if (!this.state) {
      return "property not owned";
    }
    if (!this.state.isMortgaged) {
      return "property not mortgaged";
    }

    const ownerId = new mongoose.Types.ObjectId(this.state.owner);
    if (!this.userId.equals(ownerId)) {
      return "you are not the owner";
    }

    this.state.isMortgaged = false;
    await this.game.save();
    return "";
  }

  public purchaseSquare(gameDoc: GameInstanceDocument, winner: Bidder): void {
    const squareData: SquareGameData = {
      squareId: this.squareId,
      owner: winner._id!,
      numHouses: 0,
      isMortgaged: false,
      color: winner.color!,
      purchasePrice: winner.bid!,
      mortgageValue: this.getMortgageValue(winner.bid!),
    };

    gameDoc.squareState.push(squareData);
  }

  private getMortgageValue(purchasePrice: number): number {
    return Math.round(purchasePrice * 0.3);
  }
}
