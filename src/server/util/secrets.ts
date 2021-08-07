/* eslint-disable @typescript-eslint/no-non-null-assertion */
import logger from "./logger";
import dotenv from "dotenv";

logger.debug("environment: " + process.env.NODE_ENV);

if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
  logger.debug("Using .env file to supply config environment variables");
  dotenv.config({
    path: "src/server/.env",
    debug: true,
  });
} else if (process.env.NODE_ENV && process.env.NODE_ENV === "production") {
  logger.debug("Using .env.production file to supply config environment variables");
  dotenv.config({
    path: "src/server/.env.production",
    debug: true,
  });
}

export const DB_CONN_STR: string = process.env.DB_CONN_STR!;
export const IS_DEV: boolean =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development";

if (!DB_CONN_STR) {
  logger.error(
    "No mongo connection string. Set DB_CONN_STR environment variable."
  );
  process.exit(1);
}
