import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { Favorite } from "../src/models/Favorite";
import { Listing } from "../src/models/Listing";
import { User } from "../src/models/User";

// Own database, so this suite never races other suites' cleanup hooks.
const database = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
database.pathname += "-favorites";
const app = createApp();
// Real cookie sessions, like roles.test.ts: a buyer who saves, another buyer, and a seller.
const buyer = request.agent(app);
const otherBuyer = request.agent(app);
const seller = request.agent(app);
let buyerId: string;
let sellerId: string;
const card = { title: "Desk lamp", description: "Warm white bulb", price: 12, category: "Furniture", condition: "good" };
const makeListing = (extra: object = {}) => Listing.create({ ...card, seller: sellerId, ...extra });
const save = (agent: typeof buyer, id: string) => agent.put(`/api/favorites/${id}`);
const unsave = (agent: typeof buyer, id: string) => agent.delete(`/api/favorites/${id}`);

before(async () => {
  // Fail rather than skip: these tests cover who may read and change saved lists.
  await mongoose.connect(database.toString(), { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all([User.createIndexes(), Listing.createIndexes(), Favorite.createIndexes()]);
  for (const [agent, email] of [[buyer, "fav-buyer@rutgers.edu"], [otherBuyer, "fav-other@rutgers.edu"], [seller, "fav-seller@rutgers.edu"]] as const) {
    const response = await agent.post("/api/auth/register").send({ email, name: "Favorites tester", password: "favorites-test-password" });
    assert.equal(response.status, 201);
    if (agent === buyer) buyerId = response.body.id;
    if (agent === seller) sellerId = response.body.id;
  }
});
beforeEach(async () => {
  await Promise.all([Favorite.deleteMany({}), Listing.deleteMany({}), User.updateMany({}, { $set: { suspended: false } })]);
});
after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("favorites", () => {
  it("requires sign-in for every route", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    for (const res of [
      await request(app).get("/api/favorites"),
      await request(app).get("/api/favorites/ids"),
      await request(app).put(`/api/favorites/${id}`),
      await request(app).delete(`/api/favorites/${id}`),
    ]) {
      assert.equal(res.status, 401);
      assert.equal(typeof res.body.error, "string");
    }
  });

  it("saves a listing and shows it in the saved list and ids", async () => {
    const listing = await makeListing();
    const res = await save(buyer, listing.id);
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { listingId: listing.id, saved: true });

    const ids = await buyer.get("/api/favorites/ids");
    assert.deepEqual(ids.body, { ids: [listing.id] });

    const list = await buyer.get("/api/favorites");
    assert.equal(list.status, 200);
    assert.equal(list.body.favorites.length, 1);
    const [saved] = list.body.favorites;
    assert.equal(saved.listingId, listing.id);
    assert.equal(saved.availability, "available");
    assert.equal(saved.listing.title, "Desk lamp");
    assert.equal(saved.listing.description, undefined, "cards do not need the description");
    assert.ok(!Number.isNaN(Date.parse(saved.savedAt)));
  });

  it("ignores a duplicate save, including two saves at the same moment", async () => {
    const listing = await makeListing();
    assert.equal((await save(buyer, listing.id)).status, 201);
    const again = await save(buyer, listing.id);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, { listingId: listing.id, saved: true });
    assert.equal(await Favorite.countDocuments({ user: buyerId, listing: listing.id }), 1);

    const second = await makeListing({ title: "Mini fridge" });
    const results = await Promise.all([save(buyer, second.id), save(buyer, second.id), save(buyer, second.id)]);
    assert.ok(results.every((r) => r.status === 200 || r.status === 201));
    assert.equal(await Favorite.countDocuments({ user: buyerId, listing: second.id }), 1);
  });

  it("unsaves a listing, and unsaving again is a no-op", async () => {
    const listing = await makeListing();
    await save(buyer, listing.id);
    const res = await unsave(buyer, listing.id);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { listingId: listing.id, saved: false });
    assert.deepEqual((await buyer.get("/api/favorites/ids")).body, { ids: [] });
    assert.equal((await unsave(buyer, listing.id)).status, 200);
  });

  it("keeps each student's saved list separate", async () => {
    const mine = await makeListing({ title: "Mine" });
    const theirs = await makeListing({ title: "Theirs" });
    await save(buyer, mine.id);
    await save(otherBuyer, theirs.id);
    assert.deepEqual((await buyer.get("/api/favorites/ids")).body, { ids: [mine.id] });
    // Unsaving someone else's favorite only touches your own (empty) list.
    await unsave(buyer, theirs.id);
    assert.equal(await Favorite.countDocuments({ listing: theirs.id }), 1);
  });

  it("lists saved listings newest saved first", async () => {
    const first = await makeListing({ title: "First" });
    const second = await makeListing({ title: "Second" });
    await save(buyer, first.id);
    await Favorite.updateOne({ listing: first.id }, { $set: { createdAt: new Date("2026-11-01") } });
    await save(buyer, second.id);
    const list = await buyer.get("/api/favorites");
    assert.deepEqual(list.body.favorites.map((f: { listingId: string }) => f.listingId), [second.id, first.id]);
  });

  it("rejects invalid ids, unknown and removed listings, and your own listing", async () => {
    assert.equal((await save(buyer, "not-an-id")).status, 400);
    assert.equal((await unsave(buyer, "not-an-id")).status, 400);
    assert.equal((await save(buyer, new mongoose.Types.ObjectId().toString())).status, 404);
    const removed = await makeListing({ status: "removed" });
    assert.equal((await save(buyer, removed.id)).status, 404);
    const own = await makeListing();
    const res = await save(seller, own.id);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "You can't save your own listing.");
    assert.equal(await Favorite.countDocuments({}), 0);
  });

  it("does not newly save a sold listing", async () => {
    const sold = await makeListing({ status: "sold" });
    const res = await save(buyer, sold.id);
    assert.equal(res.status, 409);
    assert.equal(await Favorite.countDocuments({}), 0);
  });

  it("shows sold, removed, deleted and suspended-seller listings as unavailable", async () => {
    const sold = await makeListing({ title: "Sold one" });
    const removed = await makeListing({ title: "Removed one" });
    const deleted = await makeListing({ title: "Deleted one" });
    const active = await makeListing({ title: "Still here" });
    for (const listing of [sold, removed, deleted, active]) assert.equal((await save(buyer, listing.id)).status, 201);
    await Listing.updateOne({ _id: sold.id }, { $set: { status: "sold" } });
    await Listing.updateOne({ _id: removed.id }, { $set: { status: "removed" } });
    await Listing.deleteOne({ _id: deleted.id });

    const byId = async () => new Map(
      (await buyer.get("/api/favorites")).body.favorites.map((f: { listingId: string }) => [f.listingId, f])
    ) as Map<string, { availability: string; title: string | null; listing: { status: string } | null }>;
    let saved = await byId();
    assert.equal(saved.get(active.id)!.availability, "available");
    assert.equal(saved.get(sold.id)!.availability, "sold");
    assert.equal(saved.get(sold.id)!.listing!.status, "sold");
    assert.equal(saved.get(removed.id)!.availability, "unavailable");
    assert.equal(saved.get(removed.id)!.title, "Removed one");
    assert.equal(saved.get(removed.id)!.listing, null, "a removed listing's photos and price are not sent");
    assert.equal(saved.get(deleted.id)!.availability, "unavailable");
    assert.equal(saved.get(deleted.id)!.title, null);

    // A suspended seller's listings are hidden too.
    await User.updateOne({ _id: sellerId }, { $set: { suspended: true } });
    saved = await byId();
    assert.equal(saved.get(active.id)!.availability, "unavailable");
    assert.equal(saved.get(active.id)!.listing, null);

    // Unavailable listings can still be unsaved.
    assert.equal((await unsave(buyer, removed.id)).status, 200);
    assert.equal((await save(buyer, sold.id)).status, 200, "re-saving an already saved sold listing is a no-op");
    assert.equal(await Favorite.countDocuments({ user: buyerId }), 3);
  });
});
