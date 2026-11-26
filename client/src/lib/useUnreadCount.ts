"use client";

import { useEffect, useState } from "react";
import { getUnreadCount } from "./messages";
import { getSocket } from "./socket";
import type { Message } from "./types";

/**
 * Live count of chats with unread messages, for the Messages badge.
 * Refreshes when a message arrives from someone else, when you read a chat
 * (in any tab), and when the window regains focus.
 */
export function useUnreadCount(userId: string | undefined) {
  const [state, setState] = useState<{ userId: string; count: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const refresh = () => {
      getUnreadCount()
        .then(({ count }) => {
          if (active) setState({ userId, count });
        })
        .catch(() => {}); // the badge is a nicety; never break the header over it
    };

    refresh();
    const socket = getSocket(userId);
    const onNew = ({ message }: { message: Message }) => {
      if (message.sender !== userId) refresh();
    };
    socket.on("message:new", onNew);
    socket.on("conversation:read", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      active = false;
      socket.off("message:new", onNew);
      socket.off("conversation:read", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);

  return userId && state?.userId === userId ? state.count : 0;
}
