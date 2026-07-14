import "./config";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const host = process.env["HOST"] ||
  (process.env.NODE_ENV === "production" ? "127.0.0.1" : undefined);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const onListen = (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host: host ?? "default", port }, "Server listening");
};

if (host) {
  app.listen(port, host, onListen);
} else {
  app.listen(port, onListen);
}
