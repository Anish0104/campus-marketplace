import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

let socket: Socket | null = null;
let socketUserId: string | null = null;

/** One shared connection per signed-in user. Reconnects when the user changes. */
export function getSocket(userId: string) {
  if (socket && socketUserId === userId) return socket;
  socket?.disconnect();
  socket = io(API_URL, { auth: { userId } });
  socketUserId = userId;
  return socket;
}
