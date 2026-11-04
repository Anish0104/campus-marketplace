import { apiFetch } from "./api";
import type { Condition, FeedCategory, FeedPage, FeedSort } from "./types";

/**
 * Feed filters as they live in the page URL, e.g.
 * /?q=calculus&category=Textbooks&condition=good,like_new&maxPrice=50&sort=price_asc&page=2
 * Keeping them in the URL means a search can be shared, refreshed and undone with Back.
 */
export type FeedFilters = {
  q: string;
  category: string;
  conditions: Condition[];
  minPrice: string;
  maxPrice: string;
  sort: FeedSort;
  page: number;
};

export const SORT_LABELS: Record<FeedSort, string> = {
  newest: "Newest first",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

const CONDITIONS: Condition[] = ["new", "like_new", "good", "fair"];
const SORTS = Object.keys(SORT_LABELS) as FeedSort[];
const PRICE = /^\d+(\.\d{1,2})?$/;

export const EMPTY_FILTERS: FeedFilters = { q: "", category: "", conditions: [], minPrice: "", maxPrice: "", sort: "newest", page: 1 };

/** Reads filters from the URL, quietly ignoring anything malformed so a bad link still shows a feed. */
export function readFilters(params: URLSearchParams): FeedFilters {
  const conditions = (params.get("condition") ?? "")
    .split(",")
    .filter((value): value is Condition => CONDITIONS.includes(value as Condition));
  const sort = params.get("sort") as FeedSort;
  const page = Number(params.get("page"));
  const price = (key: string) => {
    const value = params.get(key)?.trim() ?? "";
    return PRICE.test(value) ? value : "";
  };
  return {
    q: params.get("q")?.trim().slice(0, 100) ?? "",
    category: params.get("category")?.trim().slice(0, 80) ?? "",
    conditions: [...new Set(conditions)],
    minPrice: price("minPrice"),
    maxPrice: price("maxPrice"),
    sort: SORTS.includes(sort) ? sort : "newest",
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** The query string for both the page URL and the API. Defaults are left out to keep links short. */
export function filtersToQuery(filters: FeedFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.conditions.length) params.set("condition", filters.conditions.join(","));
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

/** True when anything narrows the feed. Sort and page alone don't count. */
export function hasActiveFilters(filters: FeedFilters) {
  return Boolean(filters.q.trim() || filters.category || filters.conditions.length || filters.minPrice || filters.maxPrice);
}

/** Whether a typed price is usable; blank means "no limit". */
export function isValidPrice(value: string) {
  return value === "" || PRICE.test(value.trim());
}

export function getFeed(userId: string, filters: FeedFilters, signal?: AbortSignal) {
  const query = filtersToQuery(filters);
  return apiFetch<FeedPage>(`/api/listings${query ? `?${query}` : ""}`, { userId, signal });
}

export async function getFeedCategories(userId: string, signal?: AbortSignal) {
  const { categories } = await apiFetch<{ categories: FeedCategory[] }>("/api/listings/categories", { userId, signal });
  return categories;
}
