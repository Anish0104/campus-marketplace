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
  /** Lets the card hide its Save button on your own listings. */
  sellerId?: string;
  createdAt: string; // ISO date
};

export type User = {
  id: string;
  name: string;
  netId?: string;
  username?: string;
  email?: string;
  role?: "student" | "admin";
};

export type Conversation = {
  _id: string;
  listing: string;
  listingTitle: string;
  buyer: string;
  seller: string;
  buyerName?: string;
  sellerName?: string;
  lastMessage?: { body: string; sender: string; sentAt: string };
  buyerLastReadAt?: string | null;
  sellerLastReadAt?: string | null;
  updatedAt: string;
};

export type Message = {
  _id: string;
  conversation: string;
  sender: string;
  body: string;
  createdAt: string;
};

/** Raw document returned by the listing API; seller is not populated. */
export type Listing = {
  _id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: Condition;
  photos: string[];
  seller: string;
  status: "active" | "sold" | "removed";
  createdAt: string;
  updatedAt: string;
};

/** A listing as the feed returns it: everything a card needs, without the description. */
export type FeedListing = Omit<Listing, "description">;

export type FeedSort = "newest" | "price_asc" | "price_desc";

/** One page of GET /api/listings. */
export type FeedPage = {
  listings: FeedListing[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** Public profile from GET /api/users/:id. Never includes email, role or suspension state. */
export type PublicProfile = {
  id: string;
  name: string;
  netId: string | null;
  memberSince: string; // ISO date
  listings: FeedListing[]; // active listings, newest first
};

/**
 * One entry of GET /api/favorites (Santanu).
 * - available: active, can be opened and bought.
 * - sold: its page still opens, but it is no longer for sale.
 * - unavailable: removed, deleted, or its seller is suspended. Only the title is kept.
 */
export type SavedListing = {
  listingId: string;
  savedAt: string;
  availability: "available" | "sold" | "unavailable";
  title: string | null;
  listing: FeedListing | null;
};

/** A category that has active listings, from GET /api/listings/categories. */
export type FeedCategory = { name: string; count: number };

export type CreateListingInput = {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: Condition;
  photoUploadId?: string;
};

export type ListingPhotoUpload = {
  photoUploadId: string;
  expiresAt: string;
  photos: { url: string; publicId: string }[];
};

export type EditListingInput = Partial<Pick<Listing, "title" | "description" | "price" | "category" | "condition">>;

export type ManagedUser = User & { _id: string; suspended: boolean };
export type MarketplaceRules = { content: string; updatedAt: string | null };

/** Moderation (Kunal). Keep in sync with server/src/models/Flag.ts. */
export const FLAG_REASONS = ["scam", "prohibited", "offensive", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
export type FlagTargetType = "listing" | "user";
export type FlagStatus = "open" | "dismissed" | "actioned";

/** The four reasons as shown on the Report dialog. */
export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  scam: "Scam or fraud",
  prohibited: "Prohibited item",
  offensive: "Offensive or abusive",
  other: "Something else",
};

/**
 * One report in the admin queue. `target` is populated with a preview of the
 * reported listing or user, and is null when that item no longer exists.
 */
export type QueuedFlag = {
  _id: string;
  targetType: FlagTargetType;
  target: { _id: string; title?: string; status?: string; name?: string; suspended?: boolean } | null;
  reporter: { _id: string; name: string } | null;
  reason: FlagReason;
  note: string;
  status: FlagStatus;
  createdAt: string;
};
