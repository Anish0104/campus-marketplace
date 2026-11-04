import "dotenv/config";
import mongoose from "mongoose";
import { Listing } from "../models/Listing";
import { removeSampleListings, SAMPLE_COUNT, seedSampleListings } from "../seed/sampleListings";

// Usage (from server/):
//   npm run seed:listings            add or reset the sample listings
//   npm run seed:listings -- --remove  delete only the sample listings
// Refuses to run with NODE_ENV=production unless --force is passed.
const args = new Set(process.argv.slice(2));
const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/campus-marketplace";

async function main() {
  if (process.env.NODE_ENV === "production" && !args.has("--force")) {
    throw new Error("NODE_ENV is production. Pass --force if you really want sample listings in this database.");
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    if (args.has("--remove")) {
      const removed = await removeSampleListings();
      console.log(`Removed ${removed} sample listings.`);
      return;
    }
    await Listing.createIndexes(); // the feed needs its text index before searching
    const { inserted, reset } = await seedSampleListings();
    console.log(`Seeded ${SAMPLE_COUNT} sample listings (${inserted} new, ${reset} reset).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
