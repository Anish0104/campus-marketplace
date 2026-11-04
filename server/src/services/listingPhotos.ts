import sharp from "sharp";
import { PhotoUpload } from "../models/PhotoUpload";
import { photoStorage } from "./cloudinary";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_PIXELS = 20_000_000;
export const PHOTO_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function validatePhoto(file: Express.Multer.File): Promise<Buffer> {
  const image = sharp(file.buffer, { failOn: "warning", limitInputPixels: PHOTO_MAX_PIXELS });
  const metadata = await image.metadata();
  const mime = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  if (!metadata.format || !(metadata.format in mime) ||
      file.mimetype !== mime[metadata.format as keyof typeof mime] || (metadata.pages ?? 1) > 1) {
    throw new Error("Invalid image format.");
  }
  // Decode all pixels and re-encode; headers alone do not establish valid content.
  // Remove metadata (including GPS), normalize orientation, and discard trailing data.
  const buffer = await image.rotate().webp({ quality: 90 }).toBuffer();
  if (buffer.length > PHOTO_MAX_BYTES) throw new Error("Normalized image is too large.");
  return buffer;
}

// Only accepts a database record already in cleanup state, never a client public ID.
export async function cleanUpload(id: string): Promise<boolean> {
  const upload = await PhotoUpload.findOne({ _id: id, state: "cleanup" });
  if (!upload) return false;
  // Sequential work bounds provider pressure; failures retain the record for retries.
  let complete = true;
  for (const photo of upload.photos) {
    try { await photoStorage.destroy(photo.publicId); }
    catch { complete = false; }
  }
  if (complete) await PhotoUpload.deleteOne({ _id: id, state: "cleanup" });
  return complete;
}

export async function cleanupExpiredUploads(now = new Date()) {
  // Conditional transitions ensure a ready batch cannot be claimed and deleted.
  await PhotoUpload.updateMany({
    state: { $in: ["uploading", "ready"] }, expiresAt: { $lte: now },
  }, { $set: { state: "cleanup" } });
  let cleaned = 0;
  let retained = 0;
  for await (const upload of PhotoUpload.find({ state: "cleanup" }).cursor()) {
    if (await cleanUpload(String(upload._id))) cleaned++;
    else retained++;
  }
  return { cleaned, retained };
}
