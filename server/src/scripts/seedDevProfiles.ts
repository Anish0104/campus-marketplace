import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/User";

// Usage (from server/): npm run seed:profiles
// Creates User documents for the three test accounts in client/src/lib/devUsers.ts,
// using the same ids the sample listings use, so profile pages work locally.
// Safe to run again. Refuses to run with NODE_ENV=production.
const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/campus-marketplace";

export const DEV_PROFILES = [
  { _id: "000000000000000000000001", name: "Anish Shirodkar", netId: "as0001", email: "anish.dev@example.edu" },
  { _id: "000000000000000000000002", name: "Krisha Borana", netId: "kb0002", email: "krisha.dev@example.edu" },
  { _id: "000000000000000000000003", name: "Anuj Bohra", netId: "ab0003", email: "anuj.dev@example.edu" },
];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed test profiles in production.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    for (const profile of DEV_PROFILES) {
      await User.updateOne({ _id: profile._id }, { $setOnInsert: profile }, { upsert: true });
    }
    console.log(`Test profiles ready (${DEV_PROFILES.length}).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
