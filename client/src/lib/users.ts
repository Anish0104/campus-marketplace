import { apiFetch } from "./api";
import type { PublicProfile } from "./types";

export function getProfile(id: string, signal?: AbortSignal) {
  return apiFetch<PublicProfile>(`/api/users/${encodeURIComponent(id)}`, { signal });
}

/** "November 2026". Fixed to UTC so the server render and the browser agree. */
export function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
