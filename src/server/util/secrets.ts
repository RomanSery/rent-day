/* eslint-disable @typescript-eslint/no-non-null-assertion */
import logger from "./logger";
import dotenv from "dotenv";

logger.info("environment: %s", process.env.ENV);

if (process.env.ENV === "development") {
  logger.debug("Using .env file to supply config environment variables");
  dotenv.config({
    path: "src/server/.env",
    debug: true,
  });
}

export const ENVIRONMENT = process.env.NODE_ENV;
export const MONGO_URL: string = process.env.MONGO_URL!;

if (!MONGO_URL) {
  logger.error(
    "No mongo connection string. Set MONGO_URL environment variable."
  );
  process.exit(1);
}
