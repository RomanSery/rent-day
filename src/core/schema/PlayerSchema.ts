import mongoose, { Schema } from "mongoose";

export const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  money: { type: Number, required: true },
  position: { type: Number, required: true },
  color: { type: String, required: true },
  type: { type: Number, required: true },
  playerClass: { type: Number, required: true },
  state: { type: Number, required: true },

  negotiation: { type: Number, required: true },
  speed: { type: Number, required: true },
  intelligence: { type: Number, required: true },
});
