import { Router } from "express";
import { Types, isValidObjectId } from "mongoose";
import { requireUser } from "../middleware/requireUser";
import { Listing, LISTING_CONDITIONS } from "../models/Listing";
import { PhotoUpload } from "../models/PhotoUpload";
import { listingPhotosRouter } from "./listingPhotos";
import { listingValidationError } from "../services/listingValidation";

export const listingsRouter = Router();
listingsRouter.use("/photos", requireUser, listingPhotosRouter);

listingsRouter.post("/", requireUser, async (req, res) => {
  const { title, description, price, category, condition, photos = [], photoUploadId } = req.body ?? {};
  const error = listingValidationError({ title, description, price, category, condition });
  if (error) { res.status(400).json({ error }); return; }
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
  const listing = await Listing.findOne({ _id: req.params.id, status: { $ne: "removed" } });
  if (!listing) {
    res.status(404).json({ error: "Listing not found." });
    return;
  }
  res.json(listing);
});
