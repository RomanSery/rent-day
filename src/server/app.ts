import express from "express";
import bodyParser from "body-parser";
import bluebird from "bluebird";
import mongoose from "mongoose";
import ioserver, { Socket } from "socket.io";
import ioclient from "socket.io-client";
import { MONGODB_URI } from "./util/secrets";

// Controllers (route handlers)
import * as actions from "./controllers/actions";
import * as gameplay from "./controllers/gameplay";

// Create Express server
const app = express();

// Connect to MongoDB
const mongoUrl: string = "mongodb://localhost:27017/monopoly"; //MONGODB_URI;
console.log(mongoUrl);

mongoose.Promise = bluebird;

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

app.get("/api/initTestGame", actions.initTestGame);
app.post("/api/getGame", actions.getGame);
app.post("/api/joinGame", actions.joinGame);
app.post("/api/actions/roll", gameplay.roll);

const options = {
  pingTimeout: 5000,
};
//const io = require("socket.io")(3000, options);
const io = ioserver(3000, options);

io.on("connection", (client) => {
  client.on("subscribeToTimer", (interval) => {
    console.log("client is subscribing to timer with interval ", interval);
    setInterval(() => {
      client.emit("timer", new Date());
    }, interval);
  });
});

//const port = 7777;
//io.listen(port);
//console.log("listening on port ", port);

export default app;
