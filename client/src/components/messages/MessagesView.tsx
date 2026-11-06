"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import ChatThread from "./ChatThread";
import ConversationList from "./ConversationList";
import MessageComposer from "./MessageComposer";
import { listConversations, listMessages, sendMessage, otherPersonName } from "@/lib/messages";
import { getSocket } from "@/lib/socket";
import type { Conversation, Message } from "@/lib/types";
import { tokens } from "@/theme/tokens";

// Puts a conversation at the top of the inbox, replacing any older copy.
function upsertConversation(list: Conversation[], c: Conversation) {
  return [c, ...list.filter((x) => x._id !== c._id)];
}

export default function MessagesView() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("c");

  // Results are tagged with whose inbox / which conversation they belong to,
  // so switching accounts or conversations never shows stale data.
  const [inbox, setInbox] = useState<{ userId: string; list: Conversation[] } | null>(null);
  const [thread, setThread] = useState<{ conversationId: string; list: Message[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conversations = user && inbox?.userId === user.id ? inbox.list : null;
  const messages = selectedId && thread?.conversationId === selectedId ? thread.list : [];

  const setConversations = useCallback(
    (update: (list: Conversation[]) => Conversation[]) =>
      setInbox((prev) => (prev ? { ...prev, list: update(prev.list) } : prev)),
    []
  );
  const addMessage = useCallback(
    (message: Message) =>
      setThread((prev) =>
        prev && prev.conversationId === message.conversation && !prev.list.some((m) => m._id === message._id)
          ? { ...prev, list: [...prev.list, message] }
          : prev
      ),
    []
  );

  const select = useCallback(
    (id: string | null) => router.replace(id ? `/messages?c=${id}` : "/messages", { scroll: false }),
    [router]
  );

  // Load the inbox whenever the signed-in user changes.
  useEffect(() => {
    if (!user) return;
    listConversations()
      .then((list) => setInbox({ userId: user.id, list }))
      .catch((e: Error) => {
        setInbox({ userId: user.id, list: [] });
        setError(e.message);
      });
  }, [user]);

  // Load the open conversation's messages.
  useEffect(() => {
    if (!user || !selectedId) return;
    listMessages(selectedId)
      .then((list) => setThread({ conversationId: selectedId, list }))
      .catch((e: Error) => setError(e.message));
  }, [user, selectedId]);

  // Live updates: new messages arrive over the socket for both people.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket(user.id);
    const onNew = ({ message, conversation }: { message: Message; conversation: Conversation }) => {
      setConversations((list) => upsertConversation(list, conversation));
      addMessage(message);
    };
    socket.on("message:new", onNew);
    return () => {
      socket.off("message:new", onNew);
    };
  }, [user, setConversations, addMessage]);

  async function handleSend(body: string) {
    if (!user || !selectedId) return;
    setError(null);
    try {
      addMessage(await sendMessage(selectedId, body));
    } catch (e) {
      setError((e as Error).message);
      throw e; // keep the text in the box so nothing is lost
    }
  }

  if (!user) {
    return <EmptyState title="Sign in to see your messages" />;
  }

  const selected = conversations?.find((c) => c._id === selectedId) ?? null;
  const otherName = selected ? otherPersonName(selected, user.id) : "";

  return (
    <>
      <PageHeader title="Messages" description="Agree on a price and a place to meet, without sharing your number." />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {conversations === null ? (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress aria-label="Loading conversations" />
        </Stack>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<ChatBubbleOutlineIcon />}
          title="No conversations yet"
          description="Message a seller from any listing and the conversation shows up here."
        />
      ) : (
        <Paper
          variant="outlined"
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "340px 1fr" },
            height: { xs: "calc(100dvh - 220px)", md: "calc(100dvh - 260px)" },
            minHeight: 440,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              borderRight: { md: `1px solid ${tokens.line}` },
              overflowY: "auto",
              display: { xs: selected ? "none" : "block", md: "block" },
            }}
          >
            <ConversationList
              conversations={conversations}
              currentUserId={user.id}
              selectedId={selectedId}
              onSelect={select}
            />
          </Box>

          <Stack sx={{ minHeight: 0, bgcolor: tokens.mist, display: { xs: selected ? "flex" : "none", md: "flex" } }}>
            {selected ? (
              <>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", px: 2, py: 1.5, bgcolor: tokens.paper, borderBottom: `1px solid ${tokens.line}` }}
                >
                  <IconButton
                    aria-label="Back to conversations"
                    onClick={() => select(null)}
                    sx={{ display: { md: "none" } }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <div>
                    <Typography variant="h5" component="h2">
                      {otherName}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      About {selected.listingTitle}
                    </Typography>
                  </div>
                </Stack>
                <ChatThread messages={messages} currentUserId={user.id} />
                <MessageComposer onSend={handleSend} />
              </>
            ) : (
              <Stack sx={{ flexGrow: 1, alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ color: "text.secondary" }}>Choose a conversation to read it.</Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}
    </>
  );
}
