import { apiFetch } from "./api";
import type { Conversation, Message } from "./types";

export const MESSAGE_MAX_LENGTH = 1000;

export const listConversations = () =>
  apiFetch<Conversation[]>("/api/conversations");

/**
 * Opens the conversation with the seller of a listing, creating it if needed.
 * The server reads the seller and title from the listing itself.
 * Used by MessageSellerButton, which then goes to `/messages?c=<conversation id>`.
 */
export const startConversation = (listingId: string) =>
  apiFetch<Conversation>("/api/conversations", { method: "POST", body: { listingId } });

/** Name of the other person in a conversation. */
export function otherPersonName(c: Conversation, currentUserId: string) {
  return (c.buyer === currentUserId ? c.sellerName : c.buyerName) ?? "Rutgers student";
}

export const listMessages = (conversationId: string) =>
  apiFetch<Message[]>(`/api/conversations/${conversationId}/messages`);

export const sendMessage = (conversationId: string, body: string) =>
  apiFetch<Message>(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { body },
  });
