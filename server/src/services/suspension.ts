import mongoose from "mongoose";

/**
 * True when the user is suspended by an admin.
 * Contract with the User model (Krisha) and moderation (Kunal):
 * a suspended user has `suspended: true`. Until the User model exists,
 * nobody is suspended.
 */
export async function isSuspended(userId: unknown): Promise<boolean> {
  if (!mongoose.modelNames().includes("User")) return false;
  const user = await mongoose
    .model("User")
    .findById(userId)
    .select("suspended")
    .lean<{ suspended?: boolean }>();
  return user?.suspended === true;
}
