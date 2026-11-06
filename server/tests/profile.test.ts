import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { Listing } from "../src/models/Listing";
import { User } from "../src/models/User";

// Own database so this suite never races other suites' cleanup hooks.
const TEST_DB = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
TEST_DB.pathname = `${TEST_DB.pathname}-profile`;
const app = createApp();
const viewer = new mongoose.Types.ObjectId().toString();
let dbReady = false;

before(async () => {
  try {
    await mongoose.connect(TEST_DB.toString(), { serverSelectionTimeoutMS: 2000 });
    dbReady = true;
  } catch { console.warn("Skipping profile database tests: MongoDB unavailable."); }
});
beforeEach(async () => {
  if (dbReady) await Promise.all([User.deleteMany({}), Listing.deleteMany({})]);
});
after(async () => {
  if (dbReady) await Promise.all([User.deleteMany({}), Listing.deleteMany({})]);
  await mongoose.disconnect();
});

const get = (id: string, as: string | null = viewer) => {
  const req = request(app).get(`/api/users/${id}`);
  return as ? req.set("x-user-id", as) : req;
};
const makeUser = (extra: object = {}) =>
  User.create({ netId: "ab123", name: "Alex Brown", email: "alex.brown@scarletmail.rutgers.edu", ...extra });
const makeListing = (seller: unknown, extra: object = {}) =>
  Listing.create({ title: "Lamp", description: "Works", price: 10, category: "Furniture", condition: "good", seller, ...extra });

describe("GET /api/users/:id", () => {
  it("requires sign-in", async () => {
    const res = await get(viewer, null);
    assert.equal(res.status, 401);
  });

  it("rejects an invalid id", async () => {
    const res = await get("not-an-id");
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, "string");
  });

  it("returns 404 for an unknown user", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await get(new mongoose.Types.ObjectId().toString());
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "User not found.");
  });

  it("returns public fields only, never the email or role", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const user = await makeUser({ role: "admin" });
    const res = await get(user.id);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ["id", "listings", "memberSince", "name", "netId"]);
    assert.equal(res.body.id, user.id);
    assert.equal(res.body.name, "Alex Brown");
    assert.equal(res.body.netId, "ab123");
    assert.equal(res.body.memberSince, user.createdAt.toISOString());
    const raw = JSON.stringify(res.body);
    for (const secret of ["email", "scarletmail", "role", "admin", "suspended", "passwordHash"]) {
      assert.ok(!raw.includes(secret), `response leaked "${secret}"`);
    }
  });

  it("lets a student view their own profile and handles a missing NetID", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const user = await User.create({ name: "No Net", email: "no.net@example.edu" });
    const res = await get(user.id, user.id);
    assert.equal(res.status, 200);
    assert.equal(res.body.netId, null);
  });

  it("lists only that user's active listings, newest first", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const user = await makeUser();
    const other = await makeUser({ netId: "cd456", email: "cd456@example.edu", name: "Casey Diaz" });
    const older = await makeListing(user._id, { title: "Older", createdAt: new Date("2026-10-01") });
    const newer = await makeListing(user._id, { title: "Newer", createdAt: new Date("2026-10-05") });
    await makeListing(user._id, { title: "Sold one", status: "sold" });
    await makeListing(user._id, { title: "Removed one", status: "removed" });
    await makeListing(other._id, { title: "Someone else's" });
    const res = await get(user.id);
    assert.deepEqual(res.body.listings.map((l: { _id: string }) => l._id), [newer.id, older.id]);
    assert.ok(res.body.listings.every((l: { status: string }) => l.status === "active"));
    assert.equal(res.body.listings[0].description, undefined, "cards do not need the description");
  });

  it("returns an empty list for a user with no active listings", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const user = await makeUser();
    const res = await get(user.id);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.listings, []);
  });

  it("hides a suspended user's listings but still returns the profile", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const user = await makeUser({ suspended: true });
    await makeListing(user._id);
    const res = await get(user.id);
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Alex Brown");
    assert.deepEqual(res.body.listings, []);
    assert.ok(!("suspended" in res.body));
  });
});
