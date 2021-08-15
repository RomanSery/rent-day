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
import * as passportConfig from "./config/passport";
import { IS_DEV, DB_CONN_STR } from "./util/secrets";
import { COOKIE_NAME, COOKIE_SECRET } from "./util/secretConstants";

// Create Express server
const app = express();

// Connect to MongoDB
const mongoUrl: string = DB_CONN_STR;

if (process.env.NODE_ENV === "development") {
  mongoose
  .connect(mongoUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true    
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
} else {

  mongoose
  .connect(mongoUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    ssl: true,
    sslValidate: false,
    authSource: 'admin'
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
}




// Express configuration
app.set("port", process.env.PORT || 5000);
app.set("trust proxy", 1);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());
app.use(passport.initialize());

passportConfig.initPassportConfig();

if (IS_DEV) {
  app.use(
    cookieSession({
      name: COOKIE_NAME,
      secret: COOKIE_SECRET,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    })
  );
} else {
  app.use(
    cookieSession({
      name: COOKIE_NAME,
      secret: COOKIE_SECRET,
      secure: true,
      httpOnly: true,
      domain: "coderdreams.com",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    })
  );
}

app.get("/api/health", authController.getHealth);

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
app.post("/api/resignGame", actions.resignGame);
app.post("/api/leaveGame", actions.leaveGame);
app.post("/api/createGame", actions.createGame);

app.post("/api/actions/roll", gameplay.roll);
app.post("/api/actions/travel", gameplay.travel);
app.post("/api/actions/bid", gameplay.bid);
app.post("/api/actions/pickLotto", gameplay.pickLotto);
app.post("/api/actions/completeTurn", gameplay.completeTurn);

app.post("/api/actions/timesUpAction", gameplay.timesUpAction);

app.post("/api/actions/mortgage", gameplay.mortage);
app.post("/api/actions/redeem", gameplay.redeem);
app.post("/api/actions/buildHouse", gameplay.buildHouse);
app.post("/api/actions/sellHouse", gameplay.sellHouse);
app.post("/api/actions/getOut", gameplay.getOut);

app.post("/api/actions/offerTrade", gameplay.offerTrade);
app.post("/api/actions/acceptTrade", gameplay.acceptTrade);
app.post("/api/actions/declineTrade", gameplay.declineTrade);

app.post("/api/actions/upgradeSkill", gameplay.upgradeSkill);

export default app;
