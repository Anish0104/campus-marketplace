import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/requireUser";
import { Favorite } from "../models/Favorite";
import { Listing } from "../models/Listing";
import { User } from "../models/User";

/**
 * Favorites (Santanu): save, unsave and list your saved listings.
 * Every route acts on the signed-in student only; the user is always taken
 * from the session, never from the request.
 */
export const favoritesRouter = Router();
favoritesRouter.use(requireUser);

// Same fields the feed returns, so a saved listing renders as a ListingCard.
const CARD_FIELDS = "title price category condition photos seller status createdAt updatedAt";

export type SavedAvailability = "available" | "sold" | "unavailable";

/**
 * GET /api/favorites: my saved listings, newest saved first.
 * Each entry says whether the listing is still available. Sold listings keep
 * their card, since their page can still be opened. Removed listings, listings
 * that no longer exist, and listings of suspended sellers only keep a title.
 */
favoritesRouter.get("/", async (req, res) => {
  const favorites = await Favorite.find({ user: req.userId }).sort({ createdAt: -1, _id: -1 }).lean();
  const listings = await Listing.find({ _id: { $in: favorites.map((f) => f.listing) } }).select(CARD_FIELDS).lean();
  const byId = new Map(listings.map((listing) => [String(listing._id), listing]));
  const suspended = new Set(
    (await User.find({ _id: { $in: listings.map((l) => l.seller) }, suspended: true }).select("_id").lean())
      .map((user) => String(user._id))
  );

  res.json({
    favorites: favorites.map((favorite) => {
      const listing = byId.get(String(favorite.listing));
      const hidden = !listing || listing.status === "removed" || suspended.has(String(listing.seller));
      const availability: SavedAvailability = hidden ? "unavailable" : listing.status === "sold" ? "sold" : "available";
      return {
        listingId: String(favorite.listing),
        savedAt: favorite.createdAt,
        availability,
        title: listing?.title ?? null,
        listing: hidden ? null : listing,
      };
    }),
  });
});

/** GET /api/favorites/ids: just the ids, so heart buttons on any page know what is saved. */
favoritesRouter.get("/ids", async (req, res) => {
  const favorites = await Favorite.find({ user: req.userId }).select("listing").lean();
  res.json({ ids: favorites.map((favorite) => String(favorite.listing)) });
});

/**
 * PUT /api/favorites/:listingId: save a listing. Saving it again changes
 * nothing and still succeeds. Only active listings of other students can be saved.
 */
favoritesRouter.put("/:listingId", async (req, res) => {
  const { listingId } = req.params;
  if (!isValidObjectId(listingId)) {
    res.status(400).json({ error: "Listing id must be a valid MongoDB ObjectId." });
    return;
  }
  const listing = await Listing.findOne({ _id: listingId, status: { $ne: "removed" } }).select("seller status").lean();
  if (!listing) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  if (String(listing.seller) === req.userId) {
    res.status(400).json({ error: "You can't save your own listing." });
    return;
  }
  const existing = await Favorite.exists({ user: req.userId, listing: listingId });
  if (existing) {
    res.json({ listingId, saved: true });
    return;
  }
  if (listing.status !== "active") {
    res.status(409).json({ error: "This listing has been sold, so it can't be saved." });
    return;
  }
  try {
    await Favorite.create({ user: req.userId, listing: listingId });
  } catch (cause) {
    // Two saves at the same moment: the unique index keeps one row, and both succeed.
    if ((cause as { code?: number }).code !== 11000) throw cause;
  }
  res.status(201).json({ listingId, saved: true });
});

/** DELETE /api/favorites/:listingId: unsave. Works for any listing, including unavailable ones. */
favoritesRouter.delete("/:listingId", async (req, res) => {
  const { listingId } = req.params;
  if (!isValidObjectId(listingId)) {
    res.status(400).json({ error: "Listing id must be a valid MongoDB ObjectId." });
    return;
  }
  await Favorite.deleteOne({ user: req.userId, listing: listingId });
  res.json({ listingId, saved: false });
});
