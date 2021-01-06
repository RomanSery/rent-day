import mongoose from "mongoose";
export interface User {
  readonly id: mongoose.Types.ObjectId;
  readonly username: string;
  readonly password: string;
}
