import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { conversationsRouter } from "./routes/conversations";
import { feedRouter } from "./routes/feed";
import { listingsRouter } from "./routes/listings";

import { adminRouter } from "./routes/admin";
import { rulesRouter } from "./routes/rules";

export function createApp() {
  const app = express();
  const production = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET;
  const mongoUri = process.env.MONGODB_URI;
  if (production && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  if (production && !mongoUri) throw new Error("MONGODB_URI must be set in production.");
  if (production) app.set("trust proxy", 1);
  const sessionStore = production
    ? MongoStore.create({
        mongoUrl: mongoUri ?? "",
        collectionName: "sessions",
        ttl: 7 * 24 * 60 * 60,
      })
    : new session.MemoryStore();

  app.use(
    cors({
      origin: process.env.CLIENT_URL ?? "http://localhost:3000",
      credentials: true,
    })
  );
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.get("origin");
      const allowedOrigin = new URL(process.env.CLIENT_URL ?? "http://localhost:3000").origin;
      if (origin && origin !== allowedOrigin) {
        res.status(403).json({ error: "This request was blocked. Refresh the page and try again." });
        return;
      }
    }
    next();
  });
  const sessionMiddleware = session({
    name: "cm.sid",
    secret: sessionSecret ?? "local-development-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: production,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    },
  });
  app.use(sessionMiddleware);
  app.use(express.json());

  // Each feature adds its router here, e.g. app.use("/api/listings", listingsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/rules", rulesRouter);
  app.use("/api/health", healthRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/listings", feedRouter); // GET / and /categories; must come before /:id
  app.use("/api/listings", listingsRouter);

  // Last resort: turn unexpected errors into a JSON 500 instead of an HTML page.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  return app;
}
