import passport from "passport";
import passportJwt from "passport-jwt";
import passportLocal from "passport-local";
import mongoose from "mongoose";
import { UserDocument, UserInstance } from "../../core/schema/UserSchema";
import { Request, Response, NextFunction } from "express";

const JwtStrategy = passportJwt.Strategy;
const ExtractJwt = passportJwt.ExtractJwt;

var opts: passportJwt.StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: "rent-day-game-secret",
  //issuer: "accounts.examplesoft.com",
  //audience: "yoursite.net",
};

passport.use(
  new JwtStrategy(opts, function (jwt_payload, done) {
    console.log("payload: " + jwt_payload);
    UserInstance.findOne(
      { id: jwt_payload.sub },
      function (err: mongoose.CallbackError, user: UserDocument) {
        if (err) {
          console.log(err);
          return done(err, false);
        }
        if (user) {
          console.log("user found in db in passport");
          return done(null, user);
        } else {
          console.log("user not found in db");
          return done(null, false);
        }
      }
    );
  })
);

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
      try {
        UserInstance.findOne({ username: username }).then(
          (user: UserDocument) => {
            if (user != null) {
              console.log("username already taken");
              return done(null, false, {
                message: "username already taken",
              });
            }

            UserInstance.create({
              username: username,
              password: password,
            }).then((user) => {
              console.log("user created");
              return done(null, user);
            });
          }
        );
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
        UserInstance.findOne({ username: username }).then(
          (user: UserDocument) => {
            if (user === null) {
              return done(null, false, { message: "bad username" });
            }

            if (password != user.password) {
              console.log("passwords do not match");
              return done(null, false, { message: "passwords do not match" });
            } else {
              console.log("user found & authenticated");
              return done(null, user);
            }
          }
        );
      } catch (err) {
        done(err);
      }
    }
  )
);

/**
 * Login Required middleware.
 */
export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("is auth: " + req.isAuthenticated());
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
};
