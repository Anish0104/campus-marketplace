import type { SortOrder } from "mongoose";
import { LISTING_CONDITIONS, LISTING_LIMITS } from "../models/Listing";

export const FEED_SORTS = ["newest", "price_asc", "price_desc"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];
type Condition = (typeof LISTING_CONDITIONS)[number];

export const FEED_LIMITS = { pageSize: 20, maxPageSize: 50, maxPage: 1000, search: 100 };

/** A validated feed request. Every field is optional except paging and sort. */
export type FeedQuery = {
  q?: string;
  category?: string;
  conditions?: Condition[];
  minPrice?: number;
  maxPrice?: number;
  sort: FeedSort;
  page: number;
  limit: number;
};

export type FeedQueryResult = { ok: true; query: FeedQuery } | { ok: false; error: string };

type RawValue = unknown;

/** Express gives a string, an array for repeated keys, or undefined. Take a single string. */
function single(value: RawValue): string | undefined {
  if (Array.isArray(value)) return single(value[value.length - 1]);
  return typeof value === "string" ? value.trim() : undefined;
}

function wholeNumber(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

function price(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Turns `req.query` into a FeedQuery, or explains what is wrong.
 * Empty values ("?category=") are treated as "not set" so the client can
 * send its whole form without stripping blanks.
 */
export function parseFeedQuery(raw: Record<string, RawValue>): FeedQueryResult {
  const query: FeedQuery = { sort: "newest", page: 1, limit: FEED_LIMITS.pageSize };

  const q = single(raw.q);
  if (q) {
    if (q.length > FEED_LIMITS.search) return { ok: false, error: `q must be at most ${FEED_LIMITS.search} characters.` };
    query.q = q;
  }

  const category = single(raw.category);
  if (category) {
    if (category.length > LISTING_LIMITS.category) {
      return { ok: false, error: `category must be at most ${LISTING_LIMITS.category} characters.` };
    }
    query.category = category;
  }

  // Accept ?condition=good,fair and ?condition=good&condition=fair.
  const conditionValues = (Array.isArray(raw.condition) ? raw.condition : [raw.condition])
    .flatMap((value) => (typeof value === "string" ? value.split(",") : []))
    .map((value) => value.trim())
    .filter(Boolean);
  if (conditionValues.length) {
    const invalid = conditionValues.find((value) => !LISTING_CONDITIONS.some((c) => c === value));
    if (invalid !== undefined) return { ok: false, error: "condition must be new, like_new, good, or fair." };
    query.conditions = [...new Set(conditionValues)] as Condition[];
  }

  for (const key of ["minPrice", "maxPrice"] as const) {
    const value = single(raw[key]);
    if (!value) continue;
    const parsed = price(value);
    if (parsed === undefined) {
      return { ok: false, error: `${key} must be a number of dollars greater than or equal to 0.` };
    }
    query[key] = parsed;
  }
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    return { ok: false, error: "minPrice cannot be greater than maxPrice." };
  }

  const sort = single(raw.sort);
  if (sort) {
    if (!FEED_SORTS.some((s) => s === sort)) return { ok: false, error: "sort must be newest, price_asc, or price_desc." };
    query.sort = sort as FeedSort;
  }

  const page = single(raw.page);
  if (page) {
    const parsed = wholeNumber(page, 1, FEED_LIMITS.maxPage);
    if (parsed === undefined) return { ok: false, error: `page must be a whole number from 1 to ${FEED_LIMITS.maxPage}.` };
    query.page = parsed;
  }

  const limit = single(raw.limit);
  if (limit) {
    const parsed = wholeNumber(limit, 1, FEED_LIMITS.maxPageSize);
    if (parsed === undefined) {
      return { ok: false, error: `limit must be a whole number from 1 to ${FEED_LIMITS.maxPageSize}.` };
    }
    query.limit = parsed;
  }

  return { ok: true, query };
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * MongoDB's $search syntax treats quotes as phrases and a leading "-" as "exclude".
 * Students type plain words, so strip that syntax and search the words as given.
 */
export function toTextSearch(q: string) {
  return q.replace(/["\\]/g, " ").replace(/(^|\s)-+/g, "$1").replace(/\s+/g, " ").trim();
}

/** Only active listings ever appear in the feed. Sold and removed ones are excluded. */
export function buildFeedFilter(query: FeedQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = { status: "active" };
  const search = query.q ? toTextSearch(query.q) : "";
  if (search) filter.$text = { $search: search };
  // Category is free text, so match it whole but ignore case ("books" finds "Books").
  if (query.category) filter.category = { $regex: `^${escapeRegex(query.category)}$`, $options: "i" };
  if (query.conditions?.length) filter.condition = { $in: query.conditions };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
    };
  }
  return filter;
}

/** Every sort ends with createdAt and _id so pages never repeat or skip a listing. */
export function buildFeedSort(sort: FeedSort): Record<string, SortOrder> {
  if (sort === "price_asc") return { price: 1, createdAt: -1, _id: -1 };
  if (sort === "price_desc") return { price: -1, createdAt: -1, _id: -1 };
  return { createdAt: -1, _id: -1 };
}
