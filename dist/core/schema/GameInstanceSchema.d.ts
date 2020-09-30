import mongoose from "mongoose";
export declare type GameInstanceDocument = mongoose.Document & {
    name: string;
};
export declare const GameInstance: mongoose.Model<GameInstanceDocument, {}>;
