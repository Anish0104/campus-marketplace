import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * Moderation flags (Kunal).
 *
 * A flag is one report by one user against one listing or one user. Admins work
 * the open flags in a queue and either dismiss them or action them (remove the
 * listing, suspend the user). Suspension itself lives on the User model, per the
 * contract in services/suspension.ts.
 */

// Keep these in sync with client/src/lib/types.ts.
export const FLAG_TARGET_TYPES = ["listing", "user"] as const;
export const FLAG_REASONS = ["scam", "prohibited", "offensive", "other"] as const;
export const FLAG_STATUSES = ["open", "dismissed", "actioned"] as const;

export type FlagTargetType = (typeof FLAG_TARGET_TYPES)[number];
export type FlagReason = (typeof FLAG_REASONS)[number];
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const FLAG_LIMITS = { note: 1000 };

// `targetType` decides which collection `target` points into, so refPath lets
// populate() resolve either one without a second lookup.
const TARGET_MODEL_BY_TYPE: Record<FlagTargetType, string> = { listing: "Listing", user: "User" };

const flagSchema = new Schema(
  {
    targetType: { type: String, required: true, enum: FLAG_TARGET_TYPES },
    target: { type: Schema.Types.ObjectId, required: true, refPath: "targetModel" },
    // Derived from targetType in a pre-validate hook; not accepted from callers.
    targetModel: { type: String, required: true, enum: Object.values(TARGET_MODEL_BY_TYPE) },
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, enum: FLAG_REASONS },
    // Free text the reporter adds. Optional: the reason alone is often enough.
    note: { type: String, trim: true, maxlength: FLAG_LIMITS.note, default: "" },
    status: { type: String, required: true, enum: FLAG_STATUSES, default: "open" },
    // Who closed the flag and how. Empty while the flag is open.
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// targetModel is bookkeeping for refPath, so derive it rather than trusting input.
flagSchema.pre("validate", function () {
  const targetType = this.targetType as FlagTargetType | undefined;
  if (targetType && targetType in TARGET_MODEL_BY_TYPE) this.targetModel = TARGET_MODEL_BY_TYPE[targetType];
});

// "Stop the same user flagging the same item twice": one report per reporter per
// target. A reporter may still flag a different listing, or the seller as well.
flagSchema.index({ targetType: 1, target: 1, reporter: 1 }, { unique: true });
// The admin queue: open flags, newest first.
flagSchema.index({ status: 1, createdAt: -1 });
// "Has this listing been reported?" on listing detail and in the removal flow.
flagSchema.index({ targetType: 1, target: 1, status: 1 });

export type FlagDoc = HydratedDocument<InferSchemaType<typeof flagSchema>>;
export const Flag = model("Flag", flagSchema);

/** True once an admin has dismissed or actioned the flag. */
export function isResolved(flag: FlagDoc) {
  return flag.status !== "open";
}
