import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";

// Controllers (route handlers)
import * as actions from "./controllers/actions";
import * as gameplay from "./controllers/gameplay";
import * as authController from "./controllers/authController";
import { GameServer } from "./sockets/GameServer";
import * as passportConfig from "./config/passport";

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

app.post("/api/createAccount", authController.createAccount);
app.post("/api/login", authController.login);

app.post("/api/findGames", actions.getGamesToJoin);
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
