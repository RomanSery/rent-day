import mongoose from "mongoose";
import { Player } from "../types/Player";
import { SquareThemeData } from "../types/SquareThemeData";
export declare type GameInstanceDocument = mongoose.Document & {
    name: string;
    players: Player[];
    theme: Map<number, SquareThemeData>;
    nextPlayerToAct: mongoose.Types.ObjectId;
};
export declare const GameInstance: mongoose.Model<GameInstanceDocument, {}>;
