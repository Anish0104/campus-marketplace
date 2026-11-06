import { apiFetch } from "./api";
import type { CreateListingInput, FeedListing, Listing, ListingPhotoUpload, ListingSummary } from "./types";

export const LISTING_LIMITS = { title: 120, description: 5000, category: 80, photos: 5, photoBytes: 5 * 1024 * 1024 };
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function uploadListingPhotos(files: File[]) {
  const body = new FormData();
  files.forEach((file) => body.append("photos", file));
  return apiFetch<ListingPhotoUpload>("/api/listings/photos", { method: "POST", body });
}

export function createListing(body: CreateListingInput) {
  return apiFetch<Listing>("/api/listings", { method: "POST", body });
}

export function getListing(id: string, signal?: AbortSignal) {
  return apiFetch<Listing>(`/api/listings/${encodeURIComponent(id)}`, { signal });
}

/** Feed/cards can reuse this without inventing a seller name. */
export function toListingSummary(listing: Listing | FeedListing): ListingSummary {
  return {
    id: listing._id, title: listing.title, price: listing.price,
    category: listing.category, condition: listing.condition,
    imageUrl: listing.photos[0], createdAt: listing.createdAt,
  };
}
