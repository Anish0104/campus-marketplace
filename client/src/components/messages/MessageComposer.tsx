"use client";

import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import SendIcon from "@mui/icons-material/Send";
import { MESSAGE_MAX_LENGTH } from "@/lib/messages";
import { tokens } from "@/theme/tokens";

type Props = {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
};

/** Text box at the bottom of a chat. Enter sends, Shift+Enter adds a new line. */
export default function MessageComposer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const trimmed = text.trim();
  const tooLong = trimmed.length > MESSAGE_MAX_LENGTH;
  const canSend = trimmed.length > 0 && !tooLong && !sending && !disabled;

  async function submit() {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <Stack
      component="form"
      direction="row"
      spacing={1}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      sx={{ p: 1.5, borderTop: `1px solid ${tokens.line}`, alignItems: "flex-end", bgcolor: tokens.paper }}
    >
      <TextField
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Write a message"
        slotProps={{ htmlInput: { "aria-label": "Message", maxLength: MESSAGE_MAX_LENGTH + 200 } }}
        multiline
        maxRows={4}
        fullWidth
        disabled={disabled}
        error={tooLong}
        helperText={
          trimmed.length > MESSAGE_MAX_LENGTH - 100
            ? `${trimmed.length} / ${MESSAGE_MAX_LENGTH} characters`
            : undefined
        }
      />
      <IconButton type="submit" color="primary" disabled={!canSend} aria-label="Send message" sx={{ mb: 0.25 }}>
        <SendIcon />
      </IconButton>
    </Stack>
  );
}
