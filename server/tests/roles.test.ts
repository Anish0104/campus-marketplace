import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { User } from "../src/models/User";
import { Listing } from "../src/models/Listing";
import { seedAdmin } from "../src/seed/seedAdmin";
import { seedUsers, SEEDED_USERS } from "../src/seed/seedUsers";
import { verifyPassword } from "../src/services/password";

const app = createApp();
const admin = request.agent(app);
const student = request.agent(app);
// Test fixtures only. Actual seed credentials come from the environment.
const password = "test-role-password";
const db = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
db.pathname += "-roles";
let studentId: string;
let adminId: string;
let listingId: string;

before(async () => {
  // Fail rather than silently skip security coverage when MongoDB is missing.
  await mongoose.connect(db.toString(), { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await User.createIndexes();
  await seedUsers(password);
  await seedAdmin(password);
  studentId = (await User.findOne({ email: SEEDED_USERS[0].email }))!.id;
  adminId = (await User.findOne({ username: "admin" }))!.id;
});
after(async () => { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

describe("roles with real cookie sessions", () => {
  it("logs in all seeded students and keeps seed operations repeatable", async () => {
    for (const user of SEEDED_USERS) {
      const response = await (user === SEEDED_USERS[0] ? student : request.agent(app)).post("/api/auth/login").send({ email: user.email.toUpperCase(), password });
      assert.equal(response.status, 200);
      assert.equal(response.body.role, "student");
      assert.equal(response.body.passwordHash, undefined);
    }
    assert.deepEqual(await seedUsers(password), { created: 0, updated: SEEDED_USERS.length });
    assert.equal(await seedAdmin("different-test-password"), "preserved");
    assert.equal(await User.countDocuments({ username: "admin" }), 1);
    const user = await User.findById(adminId).select("+passwordHash");
    assert.equal(await verifyPassword(password, user!.passwordHash!), true);
  });
  it("separates administrator credentials from student login and rotates sessions", async () => {
    assert.equal((await request(app).post("/api/auth/admin/login").send({ username: "admin", password: "incorrect" })).status, 401);
    assert.equal((await request(app).post("/api/auth/admin/login").send({ username: SEEDED_USERS[0].email, password })).status, 401);
    const login = await admin.post("/api/auth/admin/login").send({ username: " ADMIN ", password });
    assert.equal(login.status, 200);
    assert.equal(login.body.role, "admin");
    assert.equal(login.body.passwordHash, undefined);
    assert.match(login.headers["set-cookie"][0], /HttpOnly/);
    assert.equal((await admin.get("/api/auth/me")).body.username, "admin");
  });
  it("blocks viewer and student access to every admin operation", async () => {
    for (const agent of [request(app), student]) {
      const expected = agent === student ? 403 : 401;
      assert.equal((await agent.get("/api/admin/users")).status, expected);
      assert.equal((await agent.get("/api/admin/listings")).status, expected);
      assert.equal((await agent.patch(`/api/admin/users/${studentId}`).send({ suspended: true })).status, expected);
      assert.equal((await agent.patch(`/api/admin/listings/${studentId}`).send({ title: "hijack" })).status, expected);
      assert.equal((await agent.put("/api/admin/rules").send({ content: "hijack" })).status, expected);
    }
    assert.equal((await request(app).post("/api/listings").send({})).status, 401);
    assert.equal((await request(app).post("/api/listings/photos")).status, 401);
    assert.equal((await request(app).get("/api/conversations")).status, 401);
  });
  it("ignores role escalation during registration", async () => {
    const response = await request(app).post("/api/auth/register").send({ name: "New student", email: "new-role-test@rutgers.edu", password, role: "admin", username: "admin" });
    assert.equal(response.status, 201);
    assert.equal(response.body.role, "student");
    assert.equal(response.body.username, undefined);
  });
  it("supports guest browsing and admin listing edits without changing ownership", async () => {
    const created = await student.post("/api/listings").send({ title: "Book", description: "Good book", category: "Books", price: 10, condition: "good" });
    assert.equal(created.status, 201);
    listingId = created.body._id;
    assert.equal((await request(app).get(`/api/listings/${listingId}`)).status, 200);
    assert.equal((await request(app).get("/api/listings?category=Books")).body.total, 1);
    assert.equal((await request(app).get("/api/listings/categories")).status, 200);
    for (const body of [{ seller: adminId }, { price: -1 }, { title: " " }, { photos: [] }, { status: "invalid" }]) {
      assert.equal((await admin.patch(`/api/admin/listings/${listingId}`).send(body)).status, 400);
    }
    const edited = await admin.patch(`/api/admin/listings/${listingId}`).send({ title: "Corrected book", price: 8, status: "removed" });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.seller, studentId);
    assert.equal((await request(app).get(`/api/listings/${listingId}`)).status, 404);
    assert.equal((await request(app).get("/api/listings")).body.total, 0);
    assert.equal((await admin.get("/api/admin/listings")).body.listings[0].status, "removed");
    assert.equal((await admin.patch(`/api/admin/listings/${listingId}`).send({ status: "active" })).status, 200);
    assert.equal((await request(app).get(`/api/listings/${listingId}`)).status, 200);
    assert.equal((await admin.get("/api/admin/listings?page=-1")).status, 400);
  });
  it("suspends students, rejects existing sessions, and protects the admin account", async () => {
    const users = await admin.get("/api/admin/users");
    assert.equal(users.status, 200);
    assert.ok(users.body.users.every((user: Record<string, unknown>) => !user.passwordHash));
    assert.equal((await admin.patch(`/api/admin/users/${studentId}`).send({ role: "admin" })).status, 400);
    assert.equal((await admin.patch(`/api/admin/users/${adminId}`).send({ suspended: true })).status, 404);
    assert.equal((await admin.patch(`/api/admin/users/${studentId}`).send({ suspended: true })).status, 200);
    assert.equal((await student.post("/api/listings").send({})).status, 403);
    assert.equal((await request(app).post("/api/auth/login").send({ email: SEEDED_USERS[0].email, password })).status, 403);
    assert.equal((await admin.patch(`/api/admin/users/${studentId}`).send({ suspended: false })).status, 200);
    assert.equal((await student.post("/api/auth/login").send({ email: SEEDED_USERS[0].email, password })).status, 200);
    // Authorization consults the database, not a role cached in the session.
    await User.findByIdAndUpdate(adminId, { role: "student" });
    assert.equal((await admin.get("/api/admin/users")).status, 403);
    await User.findByIdAndUpdate(adminId, { role: "admin" });
  });
  it("publishes persistent public rules and validates content", async () => {
    assert.equal((await request(app).get("/api/rules")).status, 200);
    for (const content of [" ", "a".repeat(10001), 123]) assert.equal((await admin.put("/api/admin/rules").send({ content })).status, 400);
    assert.equal((await admin.put("/api/admin/rules").send({ content: " Meet safely on campus. " })).status, 200);
    assert.equal((await request(app).get("/api/rules")).body.content, "Meet safely on campus.");
    assert.equal((await admin.post("/api/auth/logout")).status, 204);
    assert.equal((await admin.get("/api/admin/users")).status, 401);
  });
  it("resets admin credentials only explicitly and refuses to promote a conflicting account", async () => {
    assert.equal(await seedAdmin("replacement-test-password", true), "reset");
    await User.findByIdAndUpdate(adminId, { role: "student" });
    await assert.rejects(seedAdmin(password, true), /refusing to promote/);
  });
});
