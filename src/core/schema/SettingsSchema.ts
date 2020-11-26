import mongoose, { Schema } from "mongoose";

export const SettingsSchema = new mongoose.Schema({
  initialMoney: { type: Number, required: true },
  maxPlayers: { type: Number, required: true },
});
