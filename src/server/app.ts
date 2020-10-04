import express from "express";
import bodyParser from "body-parser";
import bluebird from "bluebird";
import mongoose from "mongoose";
import { MONGODB_URI } from "./util/secrets";

// Controllers (route handlers)
import * as actionsController from "./controllers/actions";

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

/**
 * Primary app routes.
 */
app.get("/api/hello", actionsController.getLogin);
app.get("/api/initTestGame", actionsController.initTestGame);
app.post("/api/getGame", actionsController.getGame);

export default app;
