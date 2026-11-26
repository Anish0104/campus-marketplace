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

/** How many chats have a new message from the other person. Drives the Messages badge. */
export const getUnreadCount = () => apiFetch<{ count: number }>("/api/conversations/unread-count");

/** Marks a chat as read for the signed-in user. */
export const markConversationRead = (conversationId: string) =>
  apiFetch<{ conversationId: string; readAt: string }>(`/api/conversations/${conversationId}/read`, {
    method: "POST",
  });

/** True when the last message is from the other person and arrived after you last opened the chat. */
export function isUnread(c: Conversation, currentUserId: string) {
  if (!c.lastMessage?.sentAt || c.lastMessage.sender === currentUserId) return false;
  const lastRead = c.buyer === currentUserId ? c.buyerLastReadAt : c.sellerLastReadAt;
  return !lastRead || new Date(c.lastMessage.sentAt) > new Date(lastRead);
}

/** A copy of the chat with your read time set, used right after you open it. */
export function withReadAt(c: Conversation, currentUserId: string, readAt: string): Conversation {
  return c.buyer === currentUserId ? { ...c, buyerLastReadAt: readAt } : { ...c, sellerLastReadAt: readAt };
}
