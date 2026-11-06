import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { Listing } from "../src/models/Listing";

// Same test database convention as messaging, but a separate database to avoid
// its dropDatabase hooks racing this suite in a different test-runner process.
const TEST_DB = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
TEST_DB.pathname = `${TEST_DB.pathname}-listings`;
const app = createApp();
const seller = new mongoose.Types.ObjectId().toString();
const other = new mongoose.Types.ObjectId().toString();
const valid = { title: " Textbook ", description: " Lightly used ", price: 25, category: " Books ", condition: "good", photos: [] };
let dbReady = false;
before(async () => {
  try {
    await mongoose.connect(TEST_DB.toString(), { serverSelectionTimeoutMS: 2000 });
    dbReady = true;
  } catch { console.warn("Skipping listing database tests: MongoDB unavailable."); }
});
beforeEach(async () => { if (dbReady) await Listing.deleteMany({}); });
after(async () => {
  if (dbReady) await Listing.deleteMany({});
  await mongoose.disconnect();
});
const create = (body: unknown = valid) => request(app).post("/api/listings").set("x-user-id", seller).send(body);

describe("listings", () => {
  it("creates and persists correct fields, seller and timestamps", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await create();
    assert.equal(res.status, 201);
    assert.equal(res.body.title, "Textbook");
    assert.equal(res.body.description, "Lightly used");
    assert.equal(res.body.category, "Books");
    assert.equal(res.body.price, 25);
    assert.equal(res.body.condition, "good");
    assert.deepEqual(res.body.photos, valid.photos);
    assert.equal(res.body.seller, seller);
    assert.ok(!Number.isNaN(Date.parse(res.body.createdAt)));
    assert.ok(!Number.isNaN(Date.parse(res.body.updatedAt)));
    const saved = await Listing.findById(res.body._id);
    assert.ok(saved);
    assert.equal(saved.seller.toString(), seller);
  });
  it("ignores body seller and status", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await create({ ...valid, seller: other, status: "sold" });
    assert.equal(res.status, 201);
    assert.equal(res.body.seller, seller);
    assert.equal(res.body.status, "active");
  });
  it("defaults status to active and accepts empty or omitted photos and zero price", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    for (const photos of [[], undefined]) {
      const res = await create({ ...valid, photos, price: 0 });
      assert.equal(res.status, 201);
      assert.equal(res.body.status, "active");
      assert.deepEqual(res.body.photos, []);
    }
    const doc = new Listing({ ...valid, seller });
    assert.equal(doc.status, "active");
  });
  const invalidCases: [string, object][] = [
    ["missing title", { title: undefined }],
    ["missing description", { description: undefined }],
    ["negative price", { price: -1 }],
    ["missing price", { price: undefined }],
    ["string price", { price: "25" }],
    ["invalid condition", { condition: "excellent" }],
    ["missing category", { category: undefined }],
    ["blank category", { category: "  " }],
    ["non-string category", { category: 5 }],
    ["blank title", { title: "  " }],
    ["non-string description", { description: {} }],
    ["long title", { title: "a".repeat(121) }],
    ["long description", { description: "a".repeat(5001) }],
    ["long category", { category: "a".repeat(81) }],
    ["more than five photos", { photos: Array(6).fill("https://example.com/photo.png") }],
    ["non-array photos", { photos: "https://example.com/photo.png" }],
    ["null photos", { photos: null }],
    ["non-string photo", { photos: [42] }],
    ["invalid URL", { photos: ["not-a-url"] }],
    ["non-HTTP URL", { photos: ["javascript:alert(1)"] }],
    ["long URL", { photos: ["https://example.com/" + "a".repeat(2048)] }],
  ];
  for (const [name, changes] of invalidCases) {
    it(`rejects ${name}`, async () => {
      const res = await create({ ...valid, ...changes });
      assert.equal(res.status, 400);
      assert.equal(typeof res.body.error, "string");
    });
  }
  it("requires authentication for creation", async () => {
    for (const header of [undefined, "invalid"]) {
      for (const method of ["post"] as const) {
        const req = request(app)[method]("/api/listings");
        if (header) req.set("x-user-id", header);
        const res = await req.send(valid);
        assert.equal(res.status, 401);
        assert.equal(typeof res.body.error, "string");
      }
    }
  });
  it("retrieves an existing listing with only the seller id", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const created = await create();
    assert.equal(created.status, 201);
    const res = await request(app).get(`/api/listings/${created.body._id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, created.body);
    assert.equal(res.body.seller, seller);
  });
  it("rejects an invalid listing id", async () => {
    const res = await request(app).get("/api/listings/invalid").set("x-user-id", seller);
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, "string");
  });
  it("returns 404 for a nonexistent listing", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await request(app).get(`/api/listings/${other}`).set("x-user-id", seller);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Listing not found.");
  });
});
