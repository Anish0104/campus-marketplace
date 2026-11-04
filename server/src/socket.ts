import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { isValidObjectId } from "mongoose";

/**
 * Real-time layer. Each connected user joins the room `user:<id>`, and the
 * API emits events to those rooms (see routes/conversations.ts).
 *
 * TEMPORARY until sign-in lands: the client passes its user id in
 * `auth.userId` when connecting. Swap this for the session check later.
 */
export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL ?? "http://localhost:3000" },
  });

  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId;
    if (!isValidObjectId(userId)) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.userId = String(userId);
    next();
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}
