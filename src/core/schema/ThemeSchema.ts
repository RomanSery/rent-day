import mongoose from "mongoose";

export const ThemeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  money: { icon: String },
});
