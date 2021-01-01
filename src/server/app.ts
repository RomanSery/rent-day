import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";

// Controllers (route handlers)
import * as passportConfig from "./config/passport";
import * as actions from "./controllers/actions";
import * as gameplay from "./controllers/gameplay";
import * as authController from "./controllers/authController";
import { GameServer } from "./sockets/GameServer";

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

app.post("/api/createAccount", authController.createAccount);
app.post("/api/login", authController.login);

app.get(
  "/api/findGames",
  passportConfig.isAuthenticated,
  actions.getGamesToJoin
);
app.post("/api/getGame", passportConfig.isAuthenticated, actions.getGame);
app.post("/api/getAuction", passportConfig.isAuthenticated, actions.getAuction);
app.post(
  "/api/getGameStatus",
  passportConfig.isAuthenticated,
  actions.getGameStatus
);
app.post("/api/joinGame", passportConfig.isAuthenticated, actions.joinGame);
app.post("/api/leaveGame", passportConfig.isAuthenticated, actions.leaveGame);
app.post("/api/createGame", passportConfig.isAuthenticated, actions.createGame);

app.post("/api/actions/roll", passportConfig.isAuthenticated, gameplay.roll);
app.post("/api/actions/bid", passportConfig.isAuthenticated, gameplay.bid);
app.post(
  "/api/actions/completeTurn",
  passportConfig.isAuthenticated,
  gameplay.completeTurn
);

const gameServer = new GameServer();
gameServer.listen();

export default app;
