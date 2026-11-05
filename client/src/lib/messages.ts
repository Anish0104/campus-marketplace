import { apiFetch } from "./api";
import type { Conversation, Message } from "./types";

export const MESSAGE_MAX_LENGTH = 1000;

export const listConversations = () =>
  apiFetch<Conversation[]>("/api/conversations");

/**
 * Opens the conversation with a seller about a listing, creating it if needed.
 * Listing pages call this from a "Message seller" button, then go to
 * `/messages?c=<conversation id>`.
 */
export const startConversation = (
  listing: { listingId: string; sellerId: string; listingTitle: string }
) => apiFetch<Conversation>("/api/conversations", { method: "POST", body: listing });

export const listMessages = (conversationId: string) =>
  apiFetch<Message[]>(`/api/conversations/${conversationId}/messages`);

export const sendMessage = (conversationId: string, body: string) =>
  apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { body },
  });
