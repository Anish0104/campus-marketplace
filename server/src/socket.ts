import { Server as HttpServer } from "http";
import { Server } from "socket.io";

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL ?? "http://localhost:3000" },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
  });

  return io;
}
