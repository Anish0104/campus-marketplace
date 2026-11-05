import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/User";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/campus-marketplace";
const apply = process.argv.includes("--apply");

async function main() {
  mongoose.set("autoIndex", false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const accounts = await User.find({ email: { $type: "string" } })
      .select("_id email")
      .lean();
    const seenEmails = new Map<string, string>();
    for (const account of accounts) {
      const normalizedEmail = account.email!.trim().toLowerCase();
      if (!normalizedEmail) continue;
      const previousId = seenEmails.get(normalizedEmail);
      if (previousId && previousId !== String(account._id)) {
        throw new Error(`Multiple existing accounts normalize to ${normalizedEmail}; resolve them manually before migrating.`);
      }
      seenEmails.set(normalizedEmail, String(account._id));
    }

    const indexes = await User.collection.indexes();
    const netIdIndex = indexes.find((index) =>
      Object.keys(index.key).length === 1 && index.key.netId === 1,
    );
    const emailIndex = indexes.find((index) =>
      Object.keys(index.key).length === 1 && index.key.email === 1,
    );
    const needsNetIdIndexReplacement = Boolean(netIdIndex && (!netIdIndex.unique || !netIdIndex.sparse));
    const needsEmailIndexReplacement = Boolean(emailIndex && (!emailIndex.unique || !emailIndex.sparse));
    const emailsToNormalize = accounts.filter((account) => {
      const normalizedEmail = account.email!.trim().toLowerCase();
      return normalizedEmail
        ? account.email !== normalizedEmail
        : true;
    });

    if (!apply) {
      console.log(`Would normalize ${emailsToNormalize.length} email(s), ${needsNetIdIndexReplacement ? "replace" : "keep"} the NetID index, and ${needsEmailIndexReplacement ? "replace" : "keep"} the email index.`);
      console.log("Back up the database, then rerun with --apply to make these changes.");
      return;
    }

    if (emailsToNormalize.length) {
      await User.bulkWrite(emailsToNormalize.map((account) => ({
        updateOne: {
          filter: { _id: account._id },
          update: account.email!.trim()
            ? { $set: { email: account.email!.trim().toLowerCase() } }
            : { $unset: { email: 1 } },
        },
      })));
    }

    if (needsNetIdIndexReplacement && netIdIndex?.name) {
      await User.collection.dropIndex(netIdIndex.name);
    }
    if (!netIdIndex || needsNetIdIndexReplacement) {
      await User.collection.createIndex({ netId: 1 }, { name: "netId_1", unique: true, sparse: true });
    }
    if (needsEmailIndexReplacement && emailIndex?.name) {
      await User.collection.dropIndex(emailIndex.name);
    }
    if (!emailIndex || needsEmailIndexReplacement) {
      await User.collection.createIndex({ email: 1 }, { name: "email_1", unique: true, sparse: true });
    }
    console.log(`Migrated user indexes and normalized ${emailsToNormalize.length} email(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
