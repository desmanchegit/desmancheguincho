import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { registerRoutes } from "./routes/routes";
import { globalLimiter, routeLimiters } from "./rate-limit";

const app: Express = express();
app.set("trust proxy", "loopback");
const productionOrigins = new Set([
  "https://centraldosdesmanches.com.br",
  "https://www.centraldosdesmanches.com.br",
]);

function isAllowedDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const port = Number(url.port);

    return (
      url.origin === origin &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      Number.isInteger(port) &&
      port >= 1 &&
      port <= 65535
    );
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  return process.env.NODE_ENV === "production"
    ? productionOrigins.has(origin)
    : isAllowedDevelopmentOrigin(origin);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      // Requests from servers, health checks, and same-origin browser requests may not send Origin.
      if (!origin) return callback(null, true);

      // Returning false omits CORS headers without turning an unapproved Origin into a 500.
      return callback(null, isAllowedOrigin(origin));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    maxAge: 86400,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb", parameterLimit: 100 }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.use(globalLimiter);
app.use(routeLimiters);

app.use("/api", router);

await registerRoutes(app);

export default app;
