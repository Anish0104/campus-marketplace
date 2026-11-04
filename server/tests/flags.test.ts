import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Flag, isResolved, type FlagDoc } from "../src/models/Flag";
import { User } from "../src/models/User";
import { isSuspended } from "../src/services/suspension";

// Separate database per suite, matching the listings and feed convention, so
// parallel test-runner processes do not drop each other's data.
const TEST_DB = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
TEST_DB.pathname = `${TEST_DB.pathname}-flags`;

const reporter = new mongoose.Types.ObjectId();
const otherReporter = new mongoose.Types.ObjectId();
const listing = new mongoose.Types.ObjectId();

const openFlag = () => ({ targetType: "listing" as const, target: listing, reporter, reason: "scam" as const });

let dbReady = false;

before(async () => {
  try {
    await mongoose.connect(TEST_DB.toString(), { serverSelectionTimeoutMS: 2000 });
    // Unique indexes are only enforced once built; model creation is lazy.
    await Flag.init();
    await User.init();
    dbReady = true;
  } catch {
    console.warn("Skipping flag database tests: MongoDB unavailable.");
  }
});

beforeEach(async () => {
  if (dbReady) {
    await Flag.deleteMany({});
    await User.deleteMany({});
  }
});

after(async () => {
  if (dbReady) {
    await Flag.deleteMany({});
    await User.deleteMany({});
  }
  await mongoose.disconnect();
});

describe("Flag model", () => {
  it("stores the reported fields and defaults to an open, unresolved flag", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const flag = await Flag.create({ ...openFlag(), note: "  Asking for gift cards  " });

    assert.equal(flag.targetType, "listing");
    assert.ok(flag.target.equals(listing));
    assert.ok(flag.reporter.equals(reporter));
    assert.equal(flag.reason, "scam");
    assert.equal(flag.note, "Asking for gift cards", "note should be trimmed");
    assert.equal(flag.status, "open");
    assert.equal(flag.resolvedBy, null);
    assert.equal(flag.resolvedAt, null);
    assert.equal(isResolved(flag), false);
    assert.ok(!Number.isNaN(Date.parse(flag.createdAt.toISOString())));
  });

  it("defaults the note to empty when the reason alone is enough", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const flag = await Flag.create(openFlag());
    assert.equal(flag.note, "");
  });

  it("derives targetModel from targetType and ignores a caller-supplied value", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const listingFlag = await Flag.create(openFlag());
    assert.equal(listingFlag.targetModel, "Listing");

    const userFlag = await Flag.create({
      targetType: "user",
      target: new mongoose.Types.ObjectId(),
      reporter,
      reason: "offensive",
      // A caller trying to point the ref at the wrong collection must not win.
      targetModel: "Listing",
    });
    assert.equal(userFlag.targetModel, "User");
  });

  it("populates the reported user through refPath", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const reported = await User.create({ netId: "ab1234", name: "Reported Student", email: "ab1234@rutgers.edu" });
    const flag = await Flag.create({ targetType: "user", target: reported._id, reporter, reason: "offensive" });

    const loaded = await Flag.findById(flag._id).populate<{ target: { name: string } }>("target");
    assert.equal(loaded?.target.name, "Reported Student");
  });

  it("rejects an unknown reason, target type and status", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await assert.rejects(Flag.create({ ...openFlag(), reason: "annoying" }), /reason/);
    await assert.rejects(Flag.create({ ...openFlag(), targetType: "comment" }), /targetType/);
    await assert.rejects(Flag.create({ ...openFlag(), status: "escalated" }), /status/);
  });

  it("requires a target, a reporter and a reason", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await assert.rejects(Flag.create({ targetType: "listing", reporter, reason: "scam" }), /target/);
    await assert.rejects(Flag.create({ targetType: "listing", target: listing, reason: "scam" }), /reporter/);
    await assert.rejects(Flag.create({ targetType: "listing", target: listing, reporter }), /reason/);
  });

  it("rejects a note longer than the limit", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await assert.rejects(Flag.create({ ...openFlag(), note: "x".repeat(1001) }), /note/);
  });

  it("stops the same user flagging the same item twice", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await Flag.create(openFlag());
    await assert.rejects(Flag.create({ ...openFlag(), reason: "other" }), /duplicate key/i);
    assert.equal(await Flag.countDocuments({}), 1);
  });

  it("lets a different reporter flag the same item", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await Flag.create(openFlag());
    await Flag.create({ ...openFlag(), reporter: otherReporter });
    assert.equal(await Flag.countDocuments({ target: listing }), 2);
  });

  it("lets one reporter flag both a listing and its seller", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await Flag.create(openFlag());
    // Same id, different collection: the unique index is scoped by targetType.
    await Flag.create({ targetType: "user", target: listing, reporter, reason: "scam" });
    assert.equal(await Flag.countDocuments({ reporter }), 2);
  });

  it("returns the admin queue open first and newest first", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const older = await Flag.create(openFlag());
    const newer = await Flag.create({ ...openFlag(), reporter: otherReporter });
    await Flag.findByIdAndUpdate(older._id, { status: "dismissed" });

    const queue = await Flag.find({ status: "open" }).sort({ createdAt: -1 });
    assert.equal(queue.length, 1);
    assert.ok(queue[0]._id.equals(newer._id));
  });

  it("records who resolved a flag and when", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const admin = await User.create({ netId: "ad1", name: "Admin", email: "ad1@rutgers.edu", role: "admin" });
    const flag = await Flag.create(openFlag());

    const resolved = (await Flag.findByIdAndUpdate(
      flag._id,
      { status: "actioned", resolvedBy: admin._id, resolvedAt: new Date() },
      { returnDocument: "after" }
    )) as FlagDoc;

    assert.equal(resolved.status, "actioned");
    assert.ok(resolved.resolvedBy?.equals(admin._id));
    assert.ok(resolved.resolvedAt instanceof Date);
    assert.equal(isResolved(resolved), true);
  });
});

describe("User model suspension contract", () => {
  it("defaults new users to an active student account", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const user = await User.create({ netId: "CD5678", name: "New Student", email: "CD5678@Rutgers.edu" });
    assert.equal(user.role, "student");
    assert.equal(user.suspended, false);
    assert.equal(user.netId, "cd5678", "netId should be lowercased");
    assert.equal(user.email, "cd5678@rutgers.edu", "email should be lowercased");
  });

  it("agrees with services/suspension.ts in both states", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const user = await User.create({ netId: "ef9012", name: "Student", email: "ef9012@rutgers.edu" });
    assert.equal(await isSuspended(user._id), false);

    await User.findByIdAndUpdate(user._id, { suspended: true });
    assert.equal(await isSuspended(user._id), true, "suspending must block login and messaging");
  });

  it("rejects an unknown role and a duplicate netId", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await assert.rejects(
      User.create({ netId: "gh1", name: "X", email: "gh1@rutgers.edu", role: "moderator" }),
      /role/
    );
    await User.create({ netId: "ij2", name: "One", email: "one@rutgers.edu" });
    await assert.rejects(
      User.create({ netId: "ij2", name: "Two", email: "two@rutgers.edu" }),
      /duplicate key/i
    );
  });
});
