import mongoose, { Schema } from "mongoose";

export const SettingsSchema = new mongoose.Schema({
  initialMoney: { type: Number, required: true },
  numPlayers: { type: Number, required: true },
});
