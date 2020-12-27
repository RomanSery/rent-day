import mongoose, { Schema } from "mongoose";

export const BidderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  bid: { type: Number },
  color: { type: String, required: true },
  type: { type: Number, required: true },
});
