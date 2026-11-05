import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/User";
import { SEEDED_USERS, seedUsers } from "../seed/seedUsers";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;

async function main() {
  if (!uri) {
    throw new Error("Set MONGODB_URI to the database you intend to use.");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const existingUsers = await User.find({ email: { $in: SEEDED_USERS.map((user) => user.email) } })
      .select("email")
      .lean();
    const existingEmails = new Set(existingUsers.map((user) => user.email));

    if (!apply) {
      for (const user of SEEDED_USERS) {
        console.log(`${existingEmails.has(user.email) ? "Would reset password for" : "Would create"} ${user.email}.`);
      }
      console.log("Preview only; pass --apply to write changes. Existing account roles and other fields are preserved.");
      return;
    }

    const password = process.env.SEED_USER_PASSWORD;
    if (!password) {
      throw new Error("Set SEED_USER_PASSWORD before applying the seed.");
    }
    const { created, updated } = await seedUsers(password);
    console.log(`Seeded requested accounts (${created} created, ${updated} passwords reset).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
