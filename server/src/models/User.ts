import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * Users and accounts (Krisha).
 *
 * PLACEHOLDER written on the `kunal` branch so moderation has something to
 * reference and test against. Krisha owns this model; if her version differs,
 * hers wins. Only the fields other features already depend on are defined here:
 *
 * - `suspended`, the contract in services/suspension.ts (Kunal suspends, Krisha
 *   blocks sign-in, Anish blocks messaging).
 * - `role`, which Krisha's requireAdmin and the admin flag queue both read.
 *
 * Sign-in, sessions and password/CAS handling are deliberately absent.
 */

export const USER_ROLES = ["student", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_LIMITS = { netId: 32, name: 120, email: 254 };

const userSchema = new Schema(
  {
    netId: { type: String, required: true, trim: true, lowercase: true, maxlength: USER_LIMITS.netId },
    name: { type: String, required: true, trim: true, maxlength: USER_LIMITS.name },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: USER_LIMITS.email },
    role: { type: String, required: true, enum: USER_ROLES, default: "student" },
    // Set by an admin from the flag queue. Blocks sign-in and messaging, and
    // hides the user's listings.
    suspended: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

userSchema.index({ netId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model("User", userSchema);

export function isAdmin(user: Pick<UserDoc, "role">) {
  return user.role === "admin";
}
