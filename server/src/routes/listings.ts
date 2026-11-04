import { Router } from "express";
import { Types, isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/requireUser";
import { Listing, LISTING_CONDITIONS, LISTING_LIMITS } from "../models/Listing";
import { PhotoUpload } from "../models/PhotoUpload";
import { listingPhotosRouter } from "./listingPhotos";

export const listingsRouter = Router();
listingsRouter.use(requireUser);
listingsRouter.use("/photos", listingPhotosRouter);

listingsRouter.post("/", async (req, res) => {
  const { title, description, price, category, condition, photos = [], photoUploadId } = req.body ?? {};
  for (const [field, value, limit] of [
    ["title", title, LISTING_LIMITS.title],
    ["description", description, LISTING_LIMITS.description],
    ["category", category, LISTING_LIMITS.category],
  ] as const) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > limit) {
      res.status(400).json({ error: `${field} is required and must be at most ${limit} characters.` });
      return;
    }
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "price must be a finite number greater than or equal to 0." });
    return;
  }
  if (typeof condition !== "string" || !LISTING_CONDITIONS.some((value) => value === condition)) {
    res.status(400).json({ error: "condition must be new, like_new, good, or fair." });
    return;
  }
  // URLs alone are never evidence of ownership. The batch is the authority.
  if (!Array.isArray(photos) || photos.length !== 0) {
    res.status(400).json({ error: "Use photoUploadId to attach uploaded photos; photos must be empty or omitted." });
    return;
  }
  if (photoUploadId !== undefined && (typeof photoUploadId !== "string" || !isValidObjectId(photoUploadId))) {
    res.status(400).json({ error: "photoUploadId must be a valid upload reference." });
    return;
  }
  const listingId = new Types.ObjectId();
  const upload = photoUploadId === undefined ? null : await PhotoUpload.findOneAndUpdate({
    _id: photoUploadId, owner: req.userId!, state: "ready", expiresAt: { $gt: new Date() },
  }, { $set: { state: "attached", listing: listingId } }, { returnDocument: "after" });
  if (photoUploadId !== undefined && !upload) {
    res.status(400).json({ error: "Photo upload is unavailable, expired, already used, or not yours." });
    return;
  }
  let listing;
  try {
    listing = await Listing.create({
      _id: listingId, title, description, price, category,
      condition: condition as (typeof LISTING_CONDITIONS)[number],
      photos: upload ? upload.photos.map((photo) => photo.url!) : [],
      seller: req.userId!, status: "active",
    });
  } catch {
    // A database timeout may hide a successful write. Only release a claim after
    // confirming the listing is absent; otherwise retain it for reconciliation.
    if (upload) {
      try {
        if (!await Listing.exists({ _id: listingId })) {
          await PhotoUpload.updateOne({ _id: upload._id, listing: listingId, state: "attached" },
            { $set: { state: "ready" }, $unset: { listing: 1 } });
        }
      } catch { /* Retain the claim if database state cannot be confirmed. */ }
    }
    res.status(500).json({ error: "Listing could not be saved. Please try again." });
    return;
  }
  res.status(201).json(listing);
});

listingsRouter.get("/:id", async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ error: "Listing id must be a valid MongoDB ObjectId." });
    return;
  }
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  res.json(listing);
});
