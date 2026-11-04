import { apiFetch } from "./api";
import type { Conversation, Message } from "./types";

export const MESSAGE_MAX_LENGTH = 1000;

export const listConversations = (userId: string) =>
  apiFetch<Conversation[]>("/api/conversations", { userId });

/**
 * Opens the conversation with a seller about a listing, creating it if needed.
 * Listing pages call this from a "Message seller" button, then go to
 * `/messages?c=<conversation id>`.
 */
export const startConversation = (
  userId: string,
  listing: { listingId: string; sellerId: string; listingTitle: string }
) => apiFetch<Conversation>("/api/conversations", { method: "POST", body: listing, userId });

export const listMessages = (userId: string, conversationId: string) =>
  apiFetch<Message[]>(`/api/conversations/${conversationId}/messages`, { userId });

export const sendMessage = (userId: string, conversationId: string, body: string) =>
  apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { body },
    userId,
  });
