import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { Listing } from "../src/models/Listing";
import { User } from "../src/models/User";
import { PhotoUpload } from "../src/models/PhotoUpload";
import { Conversation } from "../src/models/Conversation";
import { Flag } from "../src/models/Flag";

const database = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
database.pathname += "-listing-management";
const app = createApp();
const owner = request.agent(app);
const other = request.agent(app);
const valid = { title: "Book", description: "Used book", price: 20, category: "Books", condition: "good" };
let ownerId: string;
let otherId: string;
let id: string;
const photos = ["https://example.com/book.webp"];
const path = () => `/api/listings/${id}`;

before(async () => {
  // Like roles.test.ts, fail rather than skip session security coverage.
  await mongoose.connect(database.toString(), { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await User.createIndexes();
  await Listing.createIndexes();
  for (const [agent, email] of [[owner, "listing-owner@rutgers.edu"], [other, "listing-other@rutgers.edu"]] as const) {
    const response = await agent.post("/api/auth/register").send({ email, name: "Listing tester", password: "listing-test-password" });
    assert.equal(response.status, 201);
    if (agent === owner) ownerId = response.body.id;
    else otherId = response.body.id;
  }
});
beforeEach(async () => {
  await Promise.all([Listing.deleteMany({}), PhotoUpload.deleteMany({}), Conversation.deleteMany({}), Flag.deleteMany({})]);
  id = (await Listing.create({ ...valid, photos, seller: ownerId })).id;
});
after(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe("seller listing management with cookie sessions", () => {
  it("edits all fields, trims strings, preserves ownership/photos/createdAt and returns the saved document", async () => {
    const original = (await owner.get(path())).body;
    const response = await owner.patch(path()).send({ title: " New title ", description: " New description ", price: 0, category: " Furniture ", condition: "fair" });
    assert.equal(response.status, 200);
    assert.equal(response.body.title, "New title");
    assert.equal(response.body.description, "New description");
    assert.equal(response.body.category, "Furniture");
    assert.equal(response.body.condition, "fair");
    assert.equal(response.body.price, 0);
    assert.equal(response.body.seller, ownerId);
    assert.equal(response.body.createdAt, original.createdAt);
    assert.deepEqual(response.body.photos, photos);
    assert.deepEqual((await owner.get(path())).body, response.body);
  });
  it("supports partial edits on active and sold records without replacing unrelated fields", async () => {
    await owner.patch(`${path()}/sold`);
    const response = await owner.patch(path()).send({ price: 12 });
    assert.equal(response.status, 200);
    assert.equal(response.body.title, valid.title);
    assert.equal(response.body.status, "sold");
    assert.equal(response.body.price, 12);
  });
  for (const [name, method, suffix] of [["edit", "patch", ""], ["sold", "patch", "/sold"], ["delete", "delete", ""]] as const) {
    it(`requires authentication for ${name}`, async () => {
      const response = await request(app)[method](`${path()}${suffix}`).send(name === "edit" ? { price: 1 } : {});
      assert.equal(response.status, 401);
      assert.equal((await Listing.findById(id))!.status, "active");
    });
    it(`rejects non-owner ${name}, even when the account is an admin`, async () => {
      await User.findByIdAndUpdate(otherId, { role: "admin" });
      const response = await other[method](`${path()}${suffix}`).send(name === "edit" ? { price: 1 } : {});
      assert.equal(response.status, 404);
      const unchanged = (await Listing.findById(id))!;
      assert.equal(unchanged.status, "active");
      assert.equal(unchanged.price, valid.price);
      await User.findByIdAndUpdate(otherId, { role: "student" });
    });
    it(`handles invalid and nonexistent IDs for ${name}`, async () => {
      for (const [identifier, expected] of [["invalid", 400], [new mongoose.Types.ObjectId().toString(), 404]] as const) {
        const response = await owner[method](`/api/listings/${identifier}${suffix}`).send(name === "edit" ? { price: 1 } : {});
        assert.equal(response.status, expected);
        assert.equal(typeof response.body.error, "string");
      }
    });
  }
  it("rejects invalid field values and malformed edit shapes without writing", async () => {
    const malformed = await owner.patch(path()).set("Content-Type", "application/json").send('{"title":');
    assert.equal(malformed.status, 400);
    assert.equal(typeof malformed.body.error, "string");
    const invalid = [{}, [], { title: " " }, { title: "x".repeat(121) }, { description: null }, { description: "x".repeat(5001) }, { price: -1 }, { price: "5" }, { price: null }, { category: {} }, { category: "x".repeat(81) }, { condition: "excellent" }];
    for (const body of invalid) {
      const response = await owner.patch(path()).send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(typeof response.body.error, "string");
    }
    assert.equal((await Listing.findById(id))!.title, valid.title);
  });
  it("rejects seller, status, identifiers, timestamps, photos, uploads and update operators", async () => {
    for (const field of ["seller", "status", "_id", "id", "createdAt", "updatedAt", "photos", "photoUploadId", "$set", "__v"]) {
      const response = await owner.patch(path()).send({ title: "Attempted change", [field]: field === "seller" ? otherId : "changed" });
      assert.equal(response.status, 400, field);
    }
    const saved = (await Listing.findById(id))!;
    assert.equal(saved.title, valid.title);
    assert.equal(String(saved.seller), ownerId);
    assert.equal(saved.status, "active");
    assert.deepEqual([...saved.photos], photos);
  });
  it("marks active as sold, removes it from feed/categories/profile, preserves detail and repeats as a no-op", async () => {
    assert.equal((await request(app).get("/api/listings")).body.total, 1);
    const sold = await owner.patch(`${path()}/sold`);
    assert.equal(sold.status, 200);
    assert.equal(sold.body.status, "sold");
    assert.deepEqual(sold.body.photos, photos);
    assert.equal((await request(app).get("/api/listings")).body.total, 0);
    assert.deepEqual((await request(app).get("/api/listings/categories")).body.categories, []);
    assert.deepEqual((await owner.get(`/api/users/${ownerId}`)).body.listings, []);
    assert.equal((await request(app).get(path())).status, 200);
    assert.deepEqual((await owner.patch(`${path()}/sold`)).body, sold.body);
  });
  it("soft deletes, hides detail/feed, retains attached photos, conversation and moderation references, and repeats safely", async () => {
    const conversation = await Conversation.create({ listing: id, listingTitle: valid.title, buyer: otherId, seller: ownerId });
    const flag = await Flag.create({ targetType: "listing", target: id, reporter: otherId, reason: "other" });
    const upload = await PhotoUpload.create({ owner: ownerId, listing: id, state: "attached", expiresAt: new Date(), photos: [{ publicId: "test/retained", url: photos[0] }] });
    const removed = await owner.delete(path());
    assert.equal(removed.status, 200);
    assert.equal(removed.body.status, "removed");
    assert.deepEqual(removed.body.photos, photos);
    assert.ok(await Listing.exists({ _id: id }));
    assert.ok(await Conversation.exists({ _id: conversation._id, listing: id }));
    assert.ok(await Flag.exists({ _id: flag._id, target: id }));
    assert.equal((await PhotoUpload.findById(upload._id))!.state, "attached");
    assert.equal((await request(app).get(path())).status, 404);
    assert.equal((await request(app).get("/api/listings")).body.total, 0);
    assert.deepEqual((await owner.delete(path())).body, removed.body);
    assert.equal((await other.delete(path())).status, 404);
    assert.equal((await other.post("/api/conversations").send({ listingId: id })).status, 200);
    assert.equal((await other.get(`/api/conversations/${conversation.id}/messages`)).status, 200);
  });
  it("deletes sold records but never edits or marks removed records sold", async () => {
    assert.equal((await owner.patch(`${path()}/sold`)).status, 200);
    assert.equal((await owner.delete(path())).status, 200);
    assert.equal((await owner.patch(path()).send({ price: 5 })).status, 404);
    assert.equal((await owner.patch(`${path()}/sold`)).status, 404);
    assert.equal((await Listing.findById(id))!.status, "removed");
  });
  it("keeps removal terminal when edit, sold and delete requests race", async () => {
    const responses = await Promise.all([owner.patch(path()).send({ title: "Race edit" }), owner.patch(`${path()}/sold`), owner.delete(path())]);
    assert.ok(responses.every((response) => [200, 404].includes(response.status)));
    assert.equal(responses[2].status, 200);
    assert.equal((await Listing.findById(id))!.status, "removed");
  });
  it("rejects unexpected action bodies and suspended sessions", async () => {
    assert.equal((await owner.patch(`${path()}/sold`).send({ seller: otherId })).status, 400);
    assert.equal((await owner.delete(path()).send({ status: "active" })).status, 400);
    await User.findByIdAndUpdate(otherId, { suspended: true });
    assert.equal((await other.patch(path()).send({ price: 1 })).status, 403);
    await User.findByIdAndUpdate(otherId, { suspended: false });
  });
});
