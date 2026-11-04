// Shared shapes used across features. Keep these in sync with the API.

export type Condition = "new" | "like_new" | "good" | "fair";

/** What a listing card needs. Listings (Anuj) and the feed (Aryan) return this shape. */
export type ListingSummary = {
  id: string;
  title: string;
  price: number; // dollars; 0 means free
  condition: Condition;
  category: string;
  imageUrl?: string;
  sellerName?: string;
  createdAt: string; // ISO date
};

export type User = {
  id: string;
  name: string;
};

export type Conversation = {
  _id: string;
  listing: string;
  listingTitle: string;
  buyer: string;
  seller: string;
  lastMessage?: { body: string; sender: string; sentAt: string };
  updatedAt: string;
};

export type Message = {
  _id: string;
  conversation: string;
  sender: string;
  body: string;
  createdAt: string;
};
