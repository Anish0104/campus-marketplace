import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";

export const USER_ROLES = ["student", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_LIMITS = { netId: 32, name: 120, email: 254 };

const userSchema = new Schema(
  {
    username: { type: String, trim: true, lowercase: true, maxlength: 32 },
    netId: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: USER_LIMITS.netId,
    },
    name: { type: String, required: true, trim: true, maxlength: USER_LIMITS.name },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: USER_LIMITS.email,
    },
    passwordHash: { type: String, select: false },
    role: { type: String, required: true, enum: USER_ROLES, default: "student" },
    suspended: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ netId: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model("User", userSchema);

export function isAdmin(user: Pick<UserDoc, "role">) {
  return user.role === "admin";
}
