import { after, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../src/app";
import { Listing } from "../src/models/Listing";
import { PhotoUpload } from "../src/models/PhotoUpload";
import { photoStorage } from "../src/services/cloudinary";
import { cleanupExpiredUploads, PHOTO_MAX_BYTES } from "../src/services/listingPhotos";

const database = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
database.pathname += "-photo-uploads";
const app = createApp();
const owner = new mongoose.Types.ObjectId().toString();
const other = new mongoose.Types.ObjectId().toString();
const listingBody = { title: "Book", description: "Used book", price: 10, category: "Books", condition: "good" };
let png: Buffer;
let jpeg: Buffer;
let webp: Buffer;
let dbReady = false;
let sent: string[];
let deleted: string[];

before(async () => {
  const pixels = { create: { width: 4, height: 4, channels: 3 as const, background: "red" } };
  png = await sharp(pixels).png().toBuffer();
  jpeg = await sharp(pixels).jpeg().toBuffer();
  webp = await sharp(pixels).webp().toBuffer();
  try {
    await mongoose.connect(database.toString(), { serverSelectionTimeoutMS: 2000 });
    dbReady = true;
  } catch { console.warn("Skipping photo database tests: MongoDB unavailable."); }
});
beforeEach(async () => {
  mock.restoreAll();
  sent = [];
  deleted = [];
  mock.method(photoStorage, "upload", async (buffer: Buffer, publicId: string) => {
    // Validate that the service receives normalized images, never user originals.
    assert.equal((await sharp(buffer).metadata()).format, "webp");
    sent.push(publicId);
    return { publicId, url: `https://res.cloudinary.com/test/image/upload/${publicId}.webp` };
  });
  mock.method(photoStorage, "destroy", async (publicId: string) => { deleted.push(publicId); });
  if (dbReady) await Promise.all([PhotoUpload.deleteMany({}), Listing.deleteMany({})]);
});
after(async () => {
  mock.restoreAll();
  if (dbReady) await Promise.all([PhotoUpload.deleteMany({}), Listing.deleteMany({})]);
  await mongoose.disconnect();
});
const upload = (user = owner) => request(app).post("/api/listings/photos").set("x-user-id", user);
const one = () => upload().attach("photos", png, { filename: "photo.png", contentType: "image/png" });
const create = (photoUploadId: string, user = owner, extra = {}) => request(app).post("/api/listings")
  .set("x-user-id", user).send({ ...listingBody, photoUploadId, ...extra });
const errorResponse = (res: { status: number; body: { error?: unknown } }, status = 400) => {
  assert.equal(res.status, status);
  assert.equal(typeof res.body.error, "string");
};

describe("listing photo uploads", () => {
  it("uploads a valid PNG and persists its owner and provider IDs", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await one();
    assert.equal(res.status, 201);
    assert.equal(res.body.photos.length, 1);
    assert.ok(res.body.photos[0].url.startsWith("https://"));
    assert.equal(res.body.photos[0].publicId, sent[0]);
    assert.ok(Date.parse(res.body.expiresAt) > Date.now());
    const saved = await PhotoUpload.findById(res.body.photoUploadId);
    assert.equal(saved?.owner.toString(), owner);
    assert.equal(saved?.state, "ready");
  });
  it("uploads JPEG, PNG and WebP together", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await one().attach("photos", jpeg, { filename: "photo.jpg", contentType: "image/jpeg" })
      .attach("photos", webp, { filename: "photo.webp", contentType: "image/webp" });
    assert.equal(res.status, 201);
    assert.equal(res.body.photos.length, 3);
    assert.equal(sent.length, 3);
  });
  it("accepts exactly five images", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const req = upload();
    for (let i = 0; i < 5; i++) req.attach("photos", png, { filename: `${i}.png`, contentType: "image/png" });
    assert.equal((await req).status, 201);
  });
  it("requires authentication before parsing uploads", async () => {
    errorResponse(await request(app).post("/api/listings/photos")
      .attach("photos", png, { filename: "photo.png", contentType: "image/png" }), 401);
    assert.equal(sent.length, 0);
  });
  it("rejects non-images", async () => {
    errorResponse(await upload().attach("photos", Buffer.from("text"), { filename: "note.txt", contentType: "text/plain" }));
    assert.equal(sent.length, 0);
  });
  it("rejects spoofed MIME types", async () => {
    errorResponse(await upload().attach("photos", Buffer.from("not an image"), { filename: "photo.png", contentType: "image/png" }));
    errorResponse(await upload().attach("photos", jpeg, { filename: "photo.png", contentType: "image/png" }));
    assert.equal(sent.length, 0);
  });
  it("rejects corrupt image data even with genuine magic bytes", async () => {
    errorResponse(await upload().attach("photos", png.subarray(0, 45), { filename: "photo.png", contentType: "image/png" }));
    assert.equal(sent.length, 0);
  });
  it("rejects SVG and GIF", async () => {
    errorResponse(await upload().attach("photos", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'), { filename: "photo.svg", contentType: "image/svg+xml" }));
    const gif = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).gif().toBuffer();
    errorResponse(await upload().attach("photos", gif, { filename: "photo.gif", contentType: "image/gif" }));
  });
  it("rejects more than 20 megapixels", async () => {
    const image = await sharp({ create: { width: 5000, height: 4001, channels: 3, background: "red" } }).png().toBuffer();
    errorResponse(await upload().attach("photos", image, { filename: "photo.png", contentType: "image/png" }));
    assert.equal(sent.length, 0);
  });
  it("rejects files over 5 MB", async () => {
    errorResponse(await upload().attach("photos", Buffer.alloc(PHOTO_MAX_BYTES + 1), { filename: "big.png", contentType: "image/png" }));
    assert.equal(sent.length, 0);
  });
  it("rejects more than five images before any external upload", async () => {
    const req = upload();
    for (let i = 0; i < 6; i++) req.attach("photos", png, { filename: `${i}.png`, contentType: "image/png" });
    errorResponse(await req);
    assert.equal(sent.length, 0);
  });
  it("rejects empty uploads", async () => {
    errorResponse(await upload().set("Content-Type", "multipart/form-data; boundary=empty").send("--empty--\r\n"));
  });
  it("rejects malformed multipart, wrong field names and non-multipart", async () => {
    errorResponse(await upload().set("Content-Type", "multipart/form-data").send("broken"));
    errorResponse(await upload().set("Content-Type", "multipart/form-data; boundary=test").send("--test\r\n"));
    errorResponse(await upload().attach("file", png, "photo.png"));
    errorResponse(await upload().field("unexpected", "value"));
    errorResponse(await upload().send({ photos: [] }));
  });
  it("validates every image before uploading any", async () => {
    errorResponse(await one().attach("photos", Buffer.from("invalid"), { filename: "bad.png", contentType: "image/png" }));
    assert.equal(sent.length, 0);
  });
  it("returns a sanitized 502 on Cloudinary errors", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    mock.method(photoStorage, "upload", async () => { throw new Error("sensitive provider details"); });
    const res = await one();
    errorResponse(res, 502);
    assert.equal(res.body.error, "Photo upload failed. Please try again.");
    assert.equal(deleted.length, 1);
    assert.equal(await PhotoUpload.countDocuments(), 0);
  });
  it("cleans partial uploads including the failed request's server-generated ID", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    let calls = 0;
    mock.method(photoStorage, "upload", async (_buffer: Buffer, publicId: string) => {
      if (++calls === 2) throw new Error("timeout");
      sent.push(publicId);
      return { publicId, url: `https://res.cloudinary.com/test/${publicId}.webp` };
    });
    const res = await one().attach("photos", png, { filename: "second.png", contentType: "image/png" });
    errorResponse(res, 502);
    assert.equal(sent.length, 1);
    assert.equal(deleted.length, 2);
    assert.ok(deleted.includes(sent[0]));
    assert.equal(await PhotoUpload.countDocuments(), 0);
  });
  it("retains failed cleanup records and retries them", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    mock.method(photoStorage, "upload", async () => { throw new Error("timeout"); });
    mock.method(photoStorage, "destroy", async () => { throw new Error("unavailable"); });
    errorResponse(await one(), 502);
    assert.equal(await PhotoUpload.countDocuments({ state: "cleanup" }), 1);
    mock.method(photoStorage, "destroy", async (publicId: string) => { deleted.push(publicId); });
    assert.deepEqual(await cleanupExpiredUploads(), { cleaned: 1, retained: 0 });
    assert.equal(await PhotoUpload.countDocuments(), 0);
  });
  it("attaches owned photos to a listing without trusting supplied URLs", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const uploaded = await one();
    const res = await create(uploaded.body.photoUploadId);
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.photos, uploaded.body.photos.map((photo: { url: string }) => photo.url));
    const batch = await PhotoUpload.findById(uploaded.body.photoUploadId);
    assert.equal(batch?.state, "attached");
    assert.equal(batch?.listing?.toString(), res.body._id);
    assert.equal(res.body.seller, owner);
    errorResponse(await create(uploaded.body.photoUploadId));
  });
  it("rejects arbitrary URLs, including another user's Cloudinary URLs", async (t) => {
    errorResponse(await request(app).post("/api/listings").set("x-user-id", owner)
      .send({ ...listingBody, photos: ["https://example.com/arbitrary.png"] }));
    if (!dbReady) return t.skip("remaining assertions need MongoDB");
    const uploaded = await one();
    errorResponse(await create(uploaded.body.photoUploadId, other));
    errorResponse(await request(app).post("/api/listings").set("x-user-id", other)
      .send({ ...listingBody, photos: [uploaded.body.photos[0].url] }));
    assert.equal((await PhotoUpload.findById(uploaded.body.photoUploadId))?.state, "ready");
    assert.equal(deleted.length, 0);
  });
  it("rejects invalid, unknown and expired upload references", async (t) => {
    errorResponse(await create("invalid"));
    if (!dbReady) return t.skip("remaining assertions need MongoDB");
    errorResponse(await create(new mongoose.Types.ObjectId().toString()));
    const uploaded = await one();
    await PhotoUpload.updateOne({ _id: uploaded.body.photoUploadId }, { $set: { expiresAt: new Date(0) } });
    errorResponse(await create(uploaded.body.photoUploadId));
  });
  it("allows only one listing to claim a batch under concurrent requests", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const uploaded = await one();
    const results = await Promise.all([create(uploaded.body.photoUploadId), create(uploaded.body.photoUploadId)]);
    assert.deepEqual(results.map((res) => res.status).sort(), [201, 400]);
    assert.equal(await Listing.countDocuments(), 1);
  });
  it("releases the reservation when listing persistence fails", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const uploaded = await one();
    mock.method(Listing, "create", async () => { throw new Error("database failure"); });
    errorResponse(await create(uploaded.body.photoUploadId), 500);
    assert.equal((await PhotoUpload.findById(uploaded.body.photoUploadId))?.state, "ready");
  });
  it("cleans expired abandoned batches, preserving live and attached uploads", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const abandoned = await one();
    const live = await one();
    const attached = await one();
    assert.equal((await create(attached.body.photoUploadId)).status, 201);
    await PhotoUpload.updateMany({ _id: { $in: [abandoned.body.photoUploadId, attached.body.photoUploadId] } }, { $set: { expiresAt: new Date(0) } });
    assert.deepEqual(await cleanupExpiredUploads(), { cleaned: 1, retained: 0 });
    assert.equal(await PhotoUpload.findById(abandoned.body.photoUploadId), null);
    assert.ok(await PhotoUpload.findById(live.body.photoUploadId));
    assert.ok(await PhotoUpload.findById(attached.body.photoUploadId));
    assert.deepEqual(deleted, [abandoned.body.photos[0].publicId]);
  });
});
