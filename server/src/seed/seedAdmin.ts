import { User } from "../models/User";
import { hashPassword, validPassword } from "../services/password";

export async function seedAdmin(password: string, reset = false) {
  if (!validPassword(password)) throw new Error("Admin password must be at least 8 characters and no more than 72 bytes.");
  const existing = await User.findOne({ username: "admin" });
  if (existing && existing.role !== "admin") throw new Error("Username admin belongs to a non-admin account; refusing to promote it.");
  if (existing && !reset) return "preserved";
  const passwordHash = await hashPassword(password);
  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    return "reset";
  }
  // Unique username index prevents concurrent seeds from creating duplicates.
  await User.create({ username: "admin", name: "Marketplace Administrator", passwordHash, role: "admin" });
  return "created";
}
