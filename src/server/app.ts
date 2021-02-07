import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";
import cookieSession from "cookie-session";

// Controllers (route handlers)
import * as actions from "./controllers/actions";
import * as gameplay from "./controllers/gameplay";
import * as authController from "./controllers/authController";
import { GameServer } from "./sockets/GameServer";
import * as passportConfig from "./config/passport";
import { COOKIE_NAME, COOKIE_SECRET } from "./util/secrets";

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

passportConfig.initPassportConfig();

app.use(
  cookieSession({
    name: COOKIE_NAME,
    secret: COOKIE_SECRET,
    //secure: true,
    httpOnly: true,
    //domain: "localhost",
    //sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);

app.post("/api/createAccount", authController.createAccount);
app.post("/api/login", authController.login);
app.post("/api/logout", authController.logout);
app.post("/api/current-session", authController.getCurrentSession);

app.post("/api/findGames", actions.getGamesToJoin);
app.post("/api/findPlayers", actions.getAllPlayers);
app.post("/api/getGame", actions.getGame);
app.post("/api/getAuction", actions.getAuction);
app.post("/api/getLotto", actions.getLotto);
app.post("/api/getGameStatus", actions.getGameStatus);
app.post("/api/joinGame", actions.joinGame);
app.post("/api/leaveGame", actions.leaveGame);
app.post("/api/createGame", actions.createGame);

app.post("/api/actions/roll", gameplay.roll);
app.post("/api/actions/bid", gameplay.bid);
app.post("/api/actions/pickLotto", gameplay.pickLotto);
app.post("/api/actions/completeTurn", gameplay.completeTurn);

app.post("/api/actions/mortgage", gameplay.mortage);
app.post("/api/actions/redeem", gameplay.redeem);
app.post("/api/actions/buildHouse", gameplay.buildHouse);
app.post("/api/actions/sellHouse", gameplay.sellHouse);
app.post("/api/actions/getOut", gameplay.getOut);

app.post("/api/actions/offerTrade", gameplay.offerTrade);
app.post("/api/actions/acceptTrade", gameplay.acceptTrade);
app.post("/api/actions/declineTrade", gameplay.declineTrade);

app.post("/api/actions/upgradeSkill", gameplay.upgradeSkill);

const gameServer = new GameServer();
gameServer.listen();

export default app;
