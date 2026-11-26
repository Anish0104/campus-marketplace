"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { initials } from "@/lib/format";
import RelativeTime from "@/components/RelativeTime";
import { isUnread, otherPersonName } from "@/lib/messages";
import type { Conversation } from "@/lib/types";
import { tokens } from "@/theme/tokens";

// Text for screen readers only.
const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

type Props = {
  conversations: Conversation[];
  currentUserId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function ConversationList({ conversations, currentUserId, selectedId, onSelect }: Props) {
  return (
    <List disablePadding aria-label="Conversations">
      {conversations.map((c) => {
        const name = otherPersonName(c, currentUserId);
        const preview = c.lastMessage
          ? `${c.lastMessage.sender === currentUserId ? "You: " : ""}${c.lastMessage.body}`
          : "No messages yet";
        const selected = c._id === selectedId;
        const unread = isUnread(c, currentUserId) && !selected;

        return (
          <ListItemButton
            key={c._id}
            selected={selected}
            onClick={() => onSelect(c._id)}
            aria-current={selected ? "true" : undefined}
            sx={{
              gap: 1.5,
              py: 1.5,
              alignItems: "flex-start",
              borderBottom: `1px solid ${tokens.line}`,
              "&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible": {
                bgcolor: tokens.mist,
                boxShadow: `inset 3px 0 0 ${tokens.scarlet}`,
              },
              "&.Mui-focusVisible": { outline: `2px solid ${tokens.raritan}`, outlineOffset: -2 },
            }}
          >
            <Avatar sx={{ bgcolor: tokens.raritan, width: 40, height: 40, fontSize: "0.95rem" }}>
              {initials(name)}
            </Avatar>
            <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                <Typography sx={{ fontWeight: unread ? 800 : 650 }} noWrap>
                  {name}
                  {unread && (
                    <Box component="span" sx={visuallyHidden}>
                      , unread
                    </Box>
                  )}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexShrink: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: unread ? tokens.scarlet : "text.secondary", fontWeight: unread ? 700 : 400 }}
                  >
                    <RelativeTime iso={c.lastMessage?.sentAt ?? c.updatedAt} />
                  </Typography>
                  {unread && (
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: tokens.scarlet }}
                    />
                  )}
                </Stack>
              </Stack>
              <Typography variant="body2" sx={{ color: tokens.raritan, fontWeight: 600 }} noWrap>
                {c.listingTitle}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: unread ? tokens.ink : "text.secondary", fontWeight: unread ? 650 : 400 }}
                noWrap
              >
                {preview}
              </Typography>
            </Stack>
          </ListItemButton>
        );
      })}
    </List>
  );
}
