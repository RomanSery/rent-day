import mongoose from "mongoose";

export const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  money: { type: Number, required: true },
  position: { type: Number, required: true },
  color: { type: String, required: true },
});
