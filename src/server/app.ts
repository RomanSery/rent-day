import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";
import passportJwt from "passport-jwt";
import passportLocal from "passport-local";

// Controllers (route handlers)
import * as actions from "./controllers/actions";
import * as gameplay from "./controllers/gameplay";
import * as authController from "./controllers/authController";
import { GameServer } from "./sockets/GameServer";
import { UserDocument, UserInstance } from "../core/schema/UserSchema";

// Create Express server
const app = express();

// Connect to MongoDB
const mongoUrl: string = "mongodb://localhost:27017/monopoly"; //MONGODB_URI;

mongoose
  .connect(mongoUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.log(
      `MongoDB connection error. Please make sure MongoDB is running. ${err}`
    );
    process.exit();
  });

// Express configuration
app.set("port", process.env.PORT || 4000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());
app.use(passport.initialize());

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

app.post("/api/createAccount", authController.createAccount);

app.get("/api/findGames", actions.getGamesToJoin);
app.post("/api/getGame", actions.getGame);
app.post("/api/getAuction", actions.getAuction);
app.post("/api/getGameStatus", actions.getGameStatus);
app.post("/api/joinGame", actions.joinGame);
app.post("/api/leaveGame", actions.leaveGame);
app.post("/api/createGame", actions.createGame);

app.post("/api/actions/roll", gameplay.roll);
app.post("/api/actions/bid", gameplay.bid);
app.post("/api/actions/completeTurn", gameplay.completeTurn);

const gameServer = new GameServer();
gameServer.listen();

export default app;
