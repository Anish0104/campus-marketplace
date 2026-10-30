import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";

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

  return app;
}
