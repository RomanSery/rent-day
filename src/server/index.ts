import errorHandler from "errorhandler";
import * as http from "http";
import { GameServer } from "./sockets/GameServer";

import app from "./app";

/**
 * Error Handler. Provides full stack - remove for production
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
const server: http.Server = app.listen(app.get("port"), () => {
  console.log(
    "  App is running at http://localhost:%d in %s mode",
    app.get("port"),
    app.get("env")
  );
  console.log("  Press CTRL-C to stop\n");
});

export const gameServer = new GameServer(server);
gameServer.listen();

export default server;
