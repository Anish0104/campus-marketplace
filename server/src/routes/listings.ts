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

// Scope every write by owner and current status in the database itself. A
// concurrent removal cannot be undone by an edit or a mark-sold request.
const editableFields = ["title", "description", "price", "category", "condition"];
for (const action of ["edit", "sold", "remove"] as const) {
  const method = action === "remove" ? "delete" : "patch";
  const path = action === "sold" ? "/:id/sold" : "/:id";
  listingsRouter[method](path, requireUser, async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
      res.status(400).json({ error: "Listing id must be a valid MongoDB ObjectId." }); return;
    }
    const body = req.body ?? {};
    if (typeof body !== "object" || Array.isArray(body) ||
        (action === "edit" && !Object.keys(body).length) ||
        Object.keys(body).some((field) => action !== "edit" || !editableFields.includes(field))) {
      res.status(400).json({ error: action === "edit"
        ? "Provide only title, description, price, category or condition to edit."
        : "This action does not accept any fields." }); return;
    }
    if (action === "edit") {
      const error = listingValidationError(body, true);
      if (error) { res.status(400).json({ error }); return; }
    }
    const owner = { _id: req.params.id, seller: req.userId! };
    const listing = await Listing.findOneAndUpdate({
      ...owner, status: action === "sold" ? "active" : { $in: ["active", "sold"] },
    }, { $set: action === "edit" ? body : { status: action === "sold" ? "sold" : "removed" } },
    { returnDocument: "after", runValidators: true });
    if (listing) { res.json(listing); return; }
    // Repeating a terminal action is a successful no-op for its owner, without
    // touching timestamps. Never reveal another seller's management records.
    if (action !== "edit") {
      const unchanged = await Listing.findOne({ ...owner, status: action === "sold" ? "sold" : "removed" });
      if (unchanged) { res.json(unchanged); return; }
    }
    res.status(404).json({ error: "Listing not found or unavailable for this action." });
  });
}
