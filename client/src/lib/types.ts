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
