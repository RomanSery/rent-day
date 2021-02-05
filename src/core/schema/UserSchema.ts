import mongoose from "mongoose";
import bcrypt from "bcrypt-nodejs";

export type UserDocument = mongoose.Document & {
  email: string;
  username: string;
  modifiedUsername: string;
  password: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  currGameId?: string;
  currGameName?: string;
};

const userSchema = new mongoose.Schema(
  {
    email: String,
    username: String,
    modifiedUsername: String,
    password: String,
    wins: Number,
    losses: Number,
    gamesPlayed: Number,
    currGameId: String,
    currGameName: String,
  },
  { timestamps: true }
);

userSchema.pre("save", function save(next) {
  const user = this as UserDocument;
  if (!user.isModified("password")) {
    return next();
  }
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return next(err);
    }
    bcrypt.hash(user.password, salt, null, (err: mongoose.Error, hash) => {
      if (err) {
        return next(err);
      }
      user.password = hash;
      next();
    });
  });
});

export const UserInstance = mongoose.model<UserDocument>("users", userSchema);
