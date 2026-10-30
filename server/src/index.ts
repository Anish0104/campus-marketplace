import "dotenv/config";
import { createServer } from "http";
import { createApp } from "./app";
import { connectDB } from "./db";
import { initSocket } from "./socket";

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/campus-marketplace";

const app = createApp();
const httpServer = createServer(app);
initSocket(httpServer);

connectDB(MONGODB_URI).then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
