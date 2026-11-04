import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Keep conditions in sync with client/src/lib/types.ts.
export const LISTING_CONDITIONS = ["new", "like_new", "good", "fair"] as const;
export const LISTING_LIMITS = { title: 120, description: 5000, category: 80, photos: 5, photoUrl: 2048 };

export function isPhotoUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > LISTING_LIMITS.photoUrl) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const listingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: LISTING_LIMITS.title },
    description: { type: String, required: true, trim: true, maxlength: LISTING_LIMITS.description },
    price: { type: Number, required: true, min: 0, validate: Number.isFinite },
    category: { type: String, required: true, trim: true, maxlength: LISTING_LIMITS.category },
    condition: { type: String, required: true, enum: LISTING_CONDITIONS },
    photos: {
      type: [String],
      default: [],
      validate: {
        validator: (photos: string[]) => photos.length <= LISTING_LIMITS.photos && photos.every(isPhotoUrl),
        message: "Provide at most five HTTP(S) photo URLs, each at most 2048 characters.",
      },
    },
    seller: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["active", "sold", "removed"], default: "active" },
  },
  { timestamps: true }
);

export type ListingDoc = HydratedDocument<InferSchemaType<typeof listingSchema>>;
export const Listing = model("Listing", listingSchema);
