import { Router } from "express";
import { requireUser } from "../middleware/requireUser";
import { Listing } from "../models/Listing";
import { buildFeedFilter, buildFeedSort, parseFeedQuery } from "../services/feedQuery";

/**
 * Feed, search and filters (Aryan). Mounted at /api/listings before the
 * listings router so "/categories" is not mistaken for a listing id.
 * requireUser is applied per route, not with router.use, so requests for
 * other listing routes pass straight through to the listings router.
 */
export const feedRouter = Router();

// The feed only needs what a listing card shows, so the description is left out.
const FEED_FIELDS = "title price category condition photos seller status createdAt updatedAt";

feedRouter.get("/", requireUser, async (req, res) => {
  const parsed = parseFeedQuery(req.query as Record<string, unknown>);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { query } = parsed;
  const filter = buildFeedFilter(query);
  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .select(FEED_FIELDS)
      .sort(buildFeedSort(query.sort))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Listing.countDocuments(filter),
  ]);
  res.json({
    listings,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  });
});

/** Categories that currently have active listings, for the filter menu. */
feedRouter.get("/categories", requireUser, async (_req, res) => {
  // Category is free text, so "Books" and "books" are grouped under one name.
  const groups = await Listing.aggregate<{ name: string; count: number }>([
    { $match: { status: "active" } },
    { $sort: { createdAt: 1 } }, // the first spelling used becomes the label
    { $group: { _id: { $toLower: "$category" }, name: { $first: "$category" }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, name: 1, count: 1 } },
  ]);
  res.json({ categories: groups });
});
