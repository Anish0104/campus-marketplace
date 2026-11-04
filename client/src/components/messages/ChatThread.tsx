"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { clockTime } from "@/lib/format";
import type { Message } from "@/lib/types";
import { tokens } from "@/theme/tokens";

type Props = {
  messages: Message[];
  currentUserId: string;
};

/** Scrollable list of message bubbles. Stays pinned to the newest message. */
export default function ChatThread({ messages, currentUserId }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <Stack sx={{ flexGrow: 1, alignItems: "center", justifyContent: "center", p: 3 }}>
        <Typography sx={{ color: "text.secondary", textAlign: "center", maxWidth: "36ch" }}>
          Ask about the item, agree on a price, and pick a spot on campus to meet.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      role="log"
      aria-live="polite"
      spacing={1}
      sx={{ flexGrow: 1, overflowY: "auto", p: { xs: 2, sm: 3 } }}
    >
      {messages.map((m) => {
        const mine = m.sender === currentUserId;
        return (
          <Stack key={m._id} sx={{ alignItems: mine ? "flex-end" : "flex-start" }}>
            <Box
              sx={{
                maxWidth: "75%",
                px: 1.75,
                py: 1,
                borderRadius: 2.5,
                borderBottomRightRadius: mine ? 6 : undefined,
                borderBottomLeftRadius: mine ? undefined : 6,
                bgcolor: mine ? tokens.scarlet : tokens.paper,
                color: mine ? "#FFFFFF" : tokens.ink,
                border: mine ? "none" : `1px solid ${tokens.line}`,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {m.body}
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.25, px: 0.5 }}>
              {clockTime(m.createdAt)}
            </Typography>
          </Stack>
        );
      })}
      <div ref={endRef} />
    </Stack>
  );
}
