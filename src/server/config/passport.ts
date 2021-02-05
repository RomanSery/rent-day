import passport from "passport";
import passportLocal from "passport-local";
import { UserDocument, UserInstance } from "../../core/schema/UserSchema";
import bcrypt from "bcrypt-nodejs";
import mongoose from "mongoose";

export const initPassportConfig = () => {
  const LocalStrategy = passportLocal.Strategy;
  passport.use(
    "register",
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
        passReqToCallback: true,
        session: false,
      },
      (req, username, password, done) => {
        const email: string = req.body.email;
        const modifiedEmail = email.toLocaleLowerCase().trim();
        const modifiedUsername = username.toLocaleLowerCase().trim();

        try {
          UserInstance.findOne({
            $or: [
              { modifiedUsername: modifiedUsername },
              { email: modifiedEmail },
            ],
          }).exec(function (err: any, user: UserDocument) {
            if (user) {
              return done(null, false, {
                message: "Username/Email already taken",
              });
            }

            UserInstance.create({
              email: modifiedEmail,
              username: username.trim(),
              modifiedUsername: modifiedUsername,
              password: password,
              wins: 0,
              losses: 0,
              gamesPlayed: 0,
            }).then((user) => {
              return done(null, user);
            });
          });
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.use(
    "login",
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
        session: false,
      },
      (username, password, done) => {
        try {
          UserInstance.findOne({
            email: username.toLocaleLowerCase().trim(),
          }).then((user: UserDocument) => {
            if (user === null) {
              return done(null, false, { message: "bad username" });
            }

            bcrypt.compare(
              password,
              user.password,
              (err: mongoose.Error, isMatch: boolean) => {
                if (err) {
                  return done(err);
                }
                if (isMatch) {
                  return done(undefined, user);
                }
                return done(undefined, false, {
                  message: "Invalid email or password.",
                });
              }
            );
          });
        } catch (err) {
          done(err);
        }
      }
    )
  );
};
