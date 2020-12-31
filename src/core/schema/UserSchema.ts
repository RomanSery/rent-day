import mongoose from "mongoose";

export type UserDocument = mongoose.Document & {
  username: string;
  password: string;
};

const userSchema = new mongoose.Schema(
  {
    username: String,
    password: String,
  },
  { timestamps: true }
);

export const UserInstance = mongoose.model<UserDocument>("users", userSchema);
