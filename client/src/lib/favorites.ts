import { apiFetch } from "./api";
import type { SavedListing } from "./types";

/** Saved listings, newest saved first, each marked available, sold or unavailable. */
export async function getFavorites(signal?: AbortSignal) {
  const { favorites } = await apiFetch<{ favorites: SavedListing[] }>("/api/favorites", { signal });
  return favorites;
}

/** Just the saved listing ids, for heart buttons. */
export async function getFavoriteIds(signal?: AbortSignal) {
  const { ids } = await apiFetch<{ ids: string[] }>("/api/favorites/ids", { signal });
  return ids;
}

export function saveListing(listingId: string) {
  return apiFetch<{ listingId: string; saved: true }>(`/api/favorites/${encodeURIComponent(listingId)}`, { method: "PUT" });
}

export function unsaveListing(listingId: string) {
  return apiFetch<{ listingId: string; saved: false }>(`/api/favorites/${encodeURIComponent(listingId)}`, { method: "DELETE" });
}

/** Only real listing ids can be saved. Sample cards on /ui use ids like "m1". */
export const isListingId = (id: string) => /^[a-f\d]{24}$/i.test(id);
