import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { Flag } from "../src/models/Flag";
import { Listing } from "../src/models/Listing";
import { User } from "../src/models/User";

// requireUser accepts x-user-id and x-test-user-role only when NODE_ENV is
// "test", so these headers stand in for real cookie sessions here.
process.env.NODE_ENV = "test";

const app = createApp();
const db = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
db.pathname += "-moderation";

const asStudent = (id: string) => ({ "x-user-id": id });
const asAdmin = (id: string) => ({ "x-user-id": id, "x-test-user-role": "admin" });

let reporter: string;
let seller: string;
let admin: string;
let otherStudent: string;
let listingId: string;

before(async () => {
  // Fail rather than silently skip: a suite that skips everything still exits 0.
  await mongoose.connect(db.toString(), { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all([Flag.init(), User.init(), Listing.init()]);
});

after(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Flag.deleteMany({}), Listing.deleteMany({}), User.deleteMany({})]);
  const [r, s, a, o] = await User.create([
    { name: "Reporter", username: "reporter" },
    { name: "Seller", username: "seller" },
    { name: "Admin", username: "admin", role: "admin" },
    { name: "Other", username: "other" },
  ]);
  reporter = r.id;
  seller = s.id;
  admin = a.id;
  otherStudent = o.id;
  const listing = await Listing.create({
    title: "Graphing calculator", description: "Barely used", price: 40,
    category: "Electronics", condition: "good", seller, status: "active",
  });
  listingId = listing.id;
});

const report = (body: unknown, headers: Record<string, string>) =>
  request(app).post("/api/flags").set(headers).send(body);

const validReport = () => ({ targetType: "listing", target: listingId, reason: "scam", note: "Wants gift cards" });

describe("POST /api/flags", () => {
  it("creates an open flag owned by the signed-in reporter", async () => {
    const res = await report(validReport(), asStudent(reporter));
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "open");

    const saved = await Flag.findById(res.body.id);
    assert.ok(saved);
    assert.equal(saved.targetType, "listing");
    assert.ok(saved.target.equals(listingId));
    assert.ok(saved.reporter.equals(reporter), "reporter comes from the session");
    assert.equal(saved.reason, "scam");
    assert.equal(saved.note, "Wants gift cards");
    assert.equal(saved.targetModel, "Listing");
  });

  it("reports a user as well as a listing", async () => {
    const res = await report({ targetType: "user", target: seller, reason: "offensive" }, asStudent(reporter));
    assert.equal(res.status, 201);
    assert.equal((await Flag.findById(res.body.id))!.targetModel, "User");
  });

  it("ignores a reporter supplied in the body", async () => {
    const res = await report({ ...validReport(), reporter: otherStudent }, asStudent(reporter));
    assert.equal(res.status, 201);
    assert.ok((await Flag.findById(res.body.id))!.reporter.equals(reporter));
  });

  it("refuses a signed-out request", async () => {
    const res = await request(app).post("/api/flags").send(validReport());
    assert.equal(res.status, 401);
    assert.equal(await Flag.countDocuments({}), 0);
  });

  it("stops the same user reporting the same item twice", async () => {
    assert.equal((await report(validReport(), asStudent(reporter))).status, 201);
    const second = await report({ ...validReport(), reason: "other" }, asStudent(reporter));
    assert.equal(second.status, 409);
    assert.match(second.body.error, /already reported/i);
    assert.equal(await Flag.countDocuments({}), 1, "the duplicate must not be stored");
  });

  it("still lets a different student report the same item", async () => {
    await report(validReport(), asStudent(reporter));
    assert.equal((await report(validReport(), asStudent(otherStudent))).status, 201);
    assert.equal(await Flag.countDocuments({ target: listingId }), 2);
  });

  it("refuses reporting your own listing or your own account", async () => {
    assert.equal((await report(validReport(), asStudent(seller))).status, 400);
    const self = await report({ targetType: "user", target: reporter, reason: "other" }, asStudent(reporter));
    assert.equal(self.status, 400);
    assert.equal(await Flag.countDocuments({}), 0);
  });

  it("rejects an unknown reason, target type, id and oversized note", async () => {
    const bad = [
      { ...validReport(), reason: "annoying" },
      { ...validReport(), targetType: "comment" },
      { ...validReport(), target: "not-an-id" },
      { ...validReport(), note: "x".repeat(1001) },
    ];
    for (const body of bad) assert.equal((await report(body, asStudent(reporter))).status, 400);
    assert.equal(await Flag.countDocuments({}), 0);
  });

  it("returns 404 for a target that does not exist", async () => {
    const missing = new mongoose.Types.ObjectId().toString();
    assert.equal((await report({ ...validReport(), target: missing }, asStudent(reporter))).status, 404);
  });
});

describe("GET /api/admin/flags", () => {
  it("refuses a student and a signed-out visitor", async () => {
    assert.equal((await request(app).get("/api/admin/flags").set(asStudent(reporter))).status, 403);
    assert.equal((await request(app).get("/api/admin/flags")).status, 401);
  });

  it("returns open flags newest first with the target populated", async () => {
    await report(validReport(), asStudent(reporter));
    await report(validReport(), asStudent(otherStudent));
    const res = await request(app).get("/api/admin/flags").set(asAdmin(admin));

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    const [newest, oldest] = res.body.flags;
    assert.ok(Date.parse(newest.createdAt) >= Date.parse(oldest.createdAt));
    assert.equal(newest.target.title, "Graphing calculator", "target is populated for the preview");
    assert.equal(newest.reporter.name, "Other");
  });

  it("filters by status and rejects an unknown one", async () => {
    const created = await report(validReport(), asStudent(reporter));
    await request(app).patch(`/api/admin/flags/${created.body.id}`).set(asAdmin(admin)).send({ action: "dismiss" });

    const open = await request(app).get("/api/admin/flags").set(asAdmin(admin));
    assert.equal(open.body.total, 0, "a resolved flag leaves the open queue");
    const dismissed = await request(app).get("/api/admin/flags?status=dismissed").set(asAdmin(admin));
    assert.equal(dismissed.body.total, 1);
    assert.equal((await request(app).get("/api/admin/flags?status=nonsense").set(asAdmin(admin))).status, 400);
  });
});

describe("PATCH /api/admin/flags/:id", () => {
  const openFlag = async () => (await report(validReport(), asStudent(reporter))).body.id as string;
  const act = (id: string, action: string, headers = asAdmin(admin)) =>
    request(app).patch(`/api/admin/flags/${id}`).set(headers).send({ action });

  it("refuses a student", async () => {
    const id = await openFlag();
    assert.equal((await act(id, "dismiss", asStudent(reporter))).status, 403);
    assert.equal((await Flag.findById(id))!.status, "open", "a refused action changes nothing");
  });

  it("dismisses without touching the listing", async () => {
    const id = await openFlag();
    const res = await act(id, "dismiss");
    assert.equal(res.status, 200);

    const flag = await Flag.findById(id);
    assert.equal(flag!.status, "dismissed");
    assert.ok(flag!.resolvedBy?.equals(admin));
    assert.ok(flag!.resolvedAt instanceof Date);
    assert.equal((await Listing.findById(listingId))!.status, "active");
    assert.equal((await User.findById(seller))!.suspended, false);
  });

  it("removes the reported listing", async () => {
    const id = await openFlag();
    assert.equal((await act(id, "remove")).status, 200);
    assert.equal((await Flag.findById(id))!.status, "actioned");
    assert.equal((await Listing.findById(listingId))!.status, "removed");
    assert.equal((await User.findById(seller))!.suspended, false, "removing a listing does not suspend");
  });

  it("suspends the seller and hides their listings", async () => {
    const id = await openFlag();
    assert.equal((await act(id, "suspend")).status, 200);
    assert.equal((await Flag.findById(id))!.status, "actioned");
    assert.equal((await User.findById(seller))!.suspended, true);
    assert.equal((await Listing.findById(listingId))!.status, "removed", "a suspended seller's listings are hidden");
  });

  it("suspends a reported user directly", async () => {
    const created = await report({ targetType: "user", target: seller, reason: "offensive" }, asStudent(reporter));
    assert.equal((await act(created.body.id, "suspend")).status, 200);
    assert.equal((await User.findById(seller))!.suspended, true);
  });

  it("refuses to suspend an administrator and leaves the flag open", async () => {
    const created = await report({ targetType: "user", target: admin, reason: "other" }, asStudent(reporter));
    const res = await act(created.body.id, "suspend");
    assert.equal(res.status, 409);
    assert.equal((await User.findById(admin))!.suspended, false);
    assert.equal((await Flag.findById(created.body.id))!.status, "open", "unperformed work stays in the queue");
  });

  it("refuses to remove a listing for a report about a user", async () => {
    const created = await report({ targetType: "user", target: seller, reason: "other" }, asStudent(reporter));
    assert.equal((await act(created.body.id, "remove")).status, 409);
    assert.equal((await Flag.findById(created.body.id))!.status, "open");
  });

  it("resolves a flag only once", async () => {
    const id = await openFlag();
    assert.equal((await act(id, "dismiss")).status, 200);
    assert.equal((await act(id, "remove")).status, 404, "a resolved flag cannot be actioned again");
    assert.equal((await Listing.findById(listingId))!.status, "active");
  });

  it("rejects an unknown action and extra fields", async () => {
    const id = await openFlag();
    assert.equal((await act(id, "banish")).status, 400);
    const extra = await request(app).patch(`/api/admin/flags/${id}`).set(asAdmin(admin)).send({ action: "dismiss", suspended: true });
    assert.equal(extra.status, 400);
    assert.equal((await Flag.findById(id))!.status, "open");
  });

  it("rejects a malformed id", async () => {
    assert.equal((await act("not-an-id", "dismiss")).status, 400);
  });
});
