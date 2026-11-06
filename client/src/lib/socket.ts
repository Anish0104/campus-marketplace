import { io, type Socket } from "socket.io-client";
import { apiFetch, SOCKET_URL } from "./api";

let socket: Socket | null = null;
let socketUserId: string | null = null;

/** One shared connection per signed-in user. Reconnects when the user changes. */
export function getSocket(userId: string) {
  if (socket && socketUserId === userId) return socket;
  socket?.disconnect();
  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: (callback) => {
      void apiFetch<{ ticket: string }>("/api/auth/socket-ticket", { method: "POST" })
        .then(({ ticket }) => callback({ ticket }))
        .catch(() => callback({ ticket: "" }));
    },
  });
  socketUserId = userId;
  socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketUserId = null;
}
