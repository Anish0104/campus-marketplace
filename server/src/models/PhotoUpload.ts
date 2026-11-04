import { Schema, model } from "mongoose";

// Persist public IDs before contacting Cloudinary so failed cleanup can be retried.
// No TTL index: deleting this record alone would leak the Cloudinary assets.
const photoUploadSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  state: { type: String, enum: ["uploading", "ready", "attached", "cleanup"], required: true },
  photos: [{
    _id: false,
    publicId: { type: String, required: true },
    url: { type: String },
  }],
  listing: { type: Schema.Types.ObjectId, ref: "Listing" },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
photoUploadSchema.index({ state: 1, expiresAt: 1 });
export const PhotoUpload = model("PhotoUpload", photoUploadSchema);
