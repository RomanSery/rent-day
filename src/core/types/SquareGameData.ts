import mongoose from "mongoose";
export interface SquareGameData {
  owner: mongoose.Types.ObjectId;
  color: string;
  numHouses: number;
  isMortgaged: boolean;
  purchasePrice: number;
}
