import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * Saved listings (Santanu). One document per student per listing they saved.
 * The listing itself is never copied here, so a saved listing always shows its
 * current price and status, and a sold or removed one shows as unavailable.
 */
const favoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
  },
  // createdAt is when it was saved. A favorite is never edited, so no updatedAt.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One save per student per listing. Saving twice is a no-op, not a second row.
favoriteSchema.index({ user: 1, listing: 1 }, { unique: true });
// "My saved listings", newest saved first.
favoriteSchema.index({ user: 1, createdAt: -1 });
// Who saved this listing, e.g. to notify them when it is sold or removed (Anand).
favoriteSchema.index({ listing: 1 });

export type FavoriteDoc = HydratedDocument<InferSchemaType<typeof favoriteSchema>>;
export const Favorite = model("Favorite", favoriteSchema);
