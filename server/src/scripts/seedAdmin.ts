import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/User";
import { seedAdmin } from "../seed/seedAdmin";

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI to the intended database.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    const existing = await User.findOne({ username: "admin" }).select("role");
    const reset = process.argv.includes("--reset-password");
    if (!process.argv.includes("--apply")) {
      console.log(existing ? (reset ? "Would reset admin password." : "Would preserve existing admin account.") : "Would create admin account.");
      console.log("Preview only. Pass --apply and supply ADMIN_PASSWORD through the local environment.");
      return;
    }
    if (!process.env.ADMIN_PASSWORD) throw new Error("Set ADMIN_PASSWORD before applying the seed.");
    await User.createIndexes();
    console.log(`Admin account ${await seedAdmin(process.env.ADMIN_PASSWORD, reset)}.`);
  } finally { await mongoose.disconnect(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Admin seed failed."); process.exitCode = 1; });
