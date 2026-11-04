import { Router } from "express";
import multer from "multer";
import { Types } from "mongoose";
import { PhotoUpload } from "../models/PhotoUpload";
import { LISTING_LIMITS } from "../models/Listing";
import { photoStorage } from "../services/cloudinary";
import { cleanUpload, PHOTO_EXPIRY_MS, PHOTO_MAX_BYTES, validatePhoto } from "../services/listingPhotos";

// Mounted behind listingsRouter's requireUser; no disk storage and no public delete route.
export const listingPhotosRouter = Router();
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: LISTING_LIMITS.photos, fields: 0, parts: 6 },
}).array("photos", LISTING_LIMITS.photos);

listingPhotosRouter.post("/", (req, res, next) => {
  if (!req.is("multipart/form-data")) {
    res.status(400).json({ error: "Send multipart/form-data with files in the photos field." });
    return;
  }
  multipart(req, res, (error: unknown) => {
    if (error) {
      let message = "Malformed multipart upload. Use only the photos file field.";
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") message = "Each photo must be at most 5 MB.";
        if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") message = "Upload at most five files using the photos field.";
      }
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}, async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    res.status(400).json({ error: "Upload at least one photo." });
    return;
  }
  const buffers: Buffer[] = [];
  try {
    for (const file of files) buffers.push(await validatePhoto(file));
  } catch {
    res.status(400).json({ error: "Photos must be valid, non-animated JPEG, PNG, or WebP images with matching MIME types, at most 20 megapixels and 5 MB after normalization." });
    return;
  }
  const id = new Types.ObjectId();
  const expiresAt = new Date(Date.now() + PHOTO_EXPIRY_MS);
  // IDs are server-generated, scoped to this batch, and recorded before uploading.
  const upload = await PhotoUpload.create({
    _id: id, owner: req.userId!, state: "uploading", expiresAt,
    photos: buffers.map((_, index) => ({ publicId: `campus-marketplace/listings/${id}/${index}` })),
  });
  try {
    for (let i = 0; i < buffers.length; i++) {
      const result = await photoStorage.upload(buffers[i], upload.photos[i].publicId);
      upload.photos[i].url = result.url;
    }
    const saved = await PhotoUpload.updateOne({ _id: id, state: "uploading", expiresAt: { $gt: new Date() } }, {
      $set: { state: "ready", photos: upload.photos.map((photo) => ({ publicId: photo.publicId, url: photo.url })) },
    });
    if (!saved.modifiedCount) throw new Error("Upload expired before completion.");
  } catch {
    // Include the failed request's ID: a timeout can occur after the asset was stored.
    // Keep a durable retry record even when Cloudinary's deletion also fails.
    try {
      await PhotoUpload.updateOne({ _id: id }, { $set: { state: "cleanup" } });
      await cleanUpload(String(id));
    } catch { /* An uploading record also expires; the cleanup command retries later. */ }
    res.status(502).json({ error: "Photo upload failed. Please try again." });
    return;
  }
  res.status(201).json({
    photoUploadId: String(id),
    expiresAt: expiresAt.toISOString(),
    photos: upload.photos.map((photo) => ({ url: photo.url, publicId: photo.publicId })),
  });
});
