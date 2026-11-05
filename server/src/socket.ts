import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { isValidObjectId } from "mongoose";
import { User } from "./models/User";
import { consumeSocketTicket } from "./services/socketTicket";

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL ?? "http://localhost:3000", credentials: true },
  });

  io.use((socket, next) => {
    const userId = consumeSocketTicket(socket.handshake.auth?.ticket);
    if (!userId || !isValidObjectId(userId)) {
      next(new Error("unauthorized"));
      return;
    }
    void User.findById(userId)
      .select("_id suspended")
      .then((user) => {
        if (!user || user.suspended) {
          next(new Error("unauthorized"));
          return;
        }
        socket.data.userId = user.id;
        next();
      })
      .catch((error: unknown) => {
        console.error("Socket authentication failed:", error instanceof Error ? error.message : error);
        next(new Error("Could not verify sign-in."));
      });
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}
