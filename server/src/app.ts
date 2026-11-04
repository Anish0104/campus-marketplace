import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { conversationsRouter } from "./routes/conversations";
import { feedRouter } from "./routes/feed";
import { listingsRouter } from "./routes/listings";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_URL ?? "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json());

  // Each feature adds its router here, e.g. app.use("/api/listings", listingsRouter);
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
