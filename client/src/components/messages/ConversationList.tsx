"use client";

import Avatar from "@mui/material/Avatar";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { initials } from "@/lib/format";
import RelativeTime from "@/components/RelativeTime";
import { userName } from "@/lib/devUsers";
import type { Conversation } from "@/lib/types";
import { tokens } from "@/theme/tokens";

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
        const otherId = c.buyer === currentUserId ? c.seller : c.buyer;
        const name = userName(otherId);
        const preview = c.lastMessage
          ? `${c.lastMessage.sender === currentUserId ? "You: " : ""}${c.lastMessage.body}`
          : "No messages yet";
        const selected = c._id === selectedId;

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
                <Typography sx={{ fontWeight: 650 }} noWrap>
                  {name}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", flexShrink: 0 }}>
                  <RelativeTime iso={c.lastMessage?.sentAt ?? c.updatedAt} />
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: tokens.raritan, fontWeight: 600 }} noWrap>
                {c.listingTitle}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
                {preview}
              </Typography>
            </Stack>
          </ListItemButton>
        );
      })}
    </List>
  );
}
