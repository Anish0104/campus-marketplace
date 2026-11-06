import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { User } from "../src/models/User";
import { hashPassword, verifyPassword } from "../src/services/password";
import { consumeSocketTicket } from "../src/services/socketTicket";

const app = createApp();
const testEmails = [
  "krisha-auth-test@rutgers.edu",
  "student-auth-test@scarletmail.rutgers.edu",
  "suspended-auth-test@rutgers.edu",
  "eight-char-password@rutgers.edu",
  "seven-char-password@rutgers.edu",
];

describe("authentication endpoints", () => {
  it("does not expose obsolete CAS or demo login endpoints", async () => {
    const cas = await request(app).get("/api/auth/cas");
    const users = await request(app).get("/api/auth/dev-users");
    const devLogin = await request(app).post("/api/auth/dev-login").send({ userId: "000000000000000000000001" });
    assert.equal(cas.status, 404);
    assert.equal(users.status, 404);
    assert.equal(devLogin.status, 404);
  });

  it("returns an unauthenticated response when there is no marketplace session", async () => {
    const response = await request(app).get("/api/auth/me");
    assert.equal(response.status, 401);
    assert.match(response.body.error, /sign in/i);
  });

  it("rejects email domains outside Rutgers with the requested message", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "Student", email: "student@example.com", password: "a-very-long-password" });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "Only Rutgers students can register.");
  });

  it("blocks cross-origin cookie-authenticated writes", async () => {
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Origin", "https://untrusted.example");
    assert.equal(response.status, 403);
  });

  it("issues a short-lived one-use socket credential only to an authenticated user", async () => {
    const userId = "000000000000000000000001";
    const denied = await request(app).post("/api/auth/socket-ticket");
    assert.equal(denied.status, 401);

    const response = await request(app)
      .post("/api/auth/socket-ticket")
      .set("x-user-id", userId);
    assert.equal(response.status, 200);
    assert.equal(consumeSocketTicket(response.body.ticket), userId);
    assert.equal(consumeSocketTicket(response.body.ticket), null);
  });

  describe("database-backed email/password sign-in", () => {
    const testDb = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
    testDb.pathname = `${testDb.pathname}-auth`;
    let dbReady = false;

    before(async () => {
      try {
        await mongoose.connect(testDb.toString(), { serverSelectionTimeoutMS: 2000 });
        await mongoose.connection.dropDatabase();
        await User.createIndexes();
        dbReady = true;
      } catch {
        console.warn("Skipping database-backed auth tests: MongoDB unavailable.");
        await mongoose.disconnect();
      }
    });

    beforeEach(async () => {
      if (dbReady) await User.deleteMany({ email: { $in: testEmails } });
    });

    after(async () => {
      if (dbReady) await User.deleteMany({ email: { $in: testEmails } });
      await mongoose.disconnect();
    });

    it("registers either Rutgers domain, normalizes email, and creates a session", async (t) => {
      if (!dbReady) return t.skip("no MongoDB");
      const agent = request.agent(app);
      const response = await agent.post("/api/auth/register").send({
        name: " Krisha Borana ",
        email: "Krisha-Auth-Test@Rutgers.EDU",
        password: "my-long-and-safe-password",
      });

      assert.equal(response.status, 201);
      assert.equal(response.body.name, "Krisha Borana");
      assert.equal(response.body.email, testEmails[0]);
      assert.equal(response.body.role, "student");
      assert.equal(response.body.passwordHash, undefined);
      assert.ok(response.headers["set-cookie"]);

      const user = await User.findOne({ email: testEmails[0] }).select("+passwordHash");
      assert.ok(user?.passwordHash);
      assert.notEqual(user.passwordHash, "my-long-and-safe-password");
      assert.equal(await verifyPassword("my-long-and-safe-password", user.passwordHash), true);
      assert.equal((await agent.get("/api/auth/me")).body.email, testEmails[0]);

      const scarletmail = await request(app).post("/api/auth/register").send({
        name: "Another Student",
        email: testEmails[1],
        password: "my-long-and-safe-password",
      });
      assert.equal(scarletmail.status, 201);
      assert.equal(scarletmail.body.email, testEmails[1]);
    });

    it("rejects duplicate accounts and invalid password input", async (t) => {
      if (!dbReady) return t.skip("no MongoDB");
      const account = {
        name: "Rutgers Student",
        email: testEmails[1],
        password: "my-long-and-safe-password",
      };
      assert.equal((await request(app).post("/api/auth/register").send(account)).status, 201);

      const duplicate = await request(app).post("/api/auth/register").send(account);
      assert.equal(duplicate.status, 409);

      const shortPassword = await request(app).post("/api/auth/register").send({
        ...account,
        email: "another-auth-test@rutgers.edu",
        password: "short",
      });
      assert.equal(shortPassword.status, 400);

      const oversizedPassword = await request(app).post("/api/auth/register").send({
        ...account,
        email: "oversized-auth-test@rutgers.edu",
        password: "a".repeat(73),
      });
      assert.equal(oversizedPassword.status, 400);

      const eightCharacterPassword = await request(app).post("/api/auth/register").send({
        ...account,
        email: testEmails[3],
        password: "password",
      });
      assert.equal(eightCharacterPassword.status, 201);

      const sevenCharacterPassword = await request(app).post("/api/auth/register").send({
        ...account,
        email: testEmails[4],
        password: "pass123",
      });
      assert.equal(sevenCharacterPassword.status, 400);
    });

    it("logs in with the password, rejects incorrect credentials, and logs out", async (t) => {
      if (!dbReady) return t.skip("no MongoDB");
      const password = "another-long-and-safe-password";
      await User.create({
        name: "Rutgers Student",
        email: testEmails[0],
        passwordHash: await hashPassword(password),
        role: "student",
        suspended: false,
      });

      const badLogin = await request(app).post("/api/auth/login").send({
        email: testEmails[0],
        password: "incorrect-password",
      });
      assert.equal(badLogin.status, 401);
      assert.equal(badLogin.body.error, "Email or password is incorrect.");

      const agent = request.agent(app);
      const login = await agent.post("/api/auth/login").send({
        email: "KRISHA-AUTH-TEST@RUTGERS.EDU",
        password,
      });
      assert.equal(login.status, 200);
      assert.equal(login.body.email, testEmails[0]);
      assert.ok(login.headers["set-cookie"]);
      assert.equal((await agent.get("/api/auth/me")).status, 200);
      assert.equal((await agent.post("/api/auth/logout")).status, 204);
      assert.equal((await agent.get("/api/auth/me")).status, 401);
    });

    it("refuses login for a suspended account", async (t) => {
      if (!dbReady) return t.skip("no MongoDB");
      const password = "another-long-and-safe-password";
      await User.create({
        name: "Suspended Student",
        email: testEmails[2],
        passwordHash: await hashPassword(password),
        role: "student",
        suspended: true,
      });
      const response = await request(app).post("/api/auth/login").send({
        email: testEmails[2],
        password,
      });
      assert.equal(response.status, 403);
      assert.match(response.body.error, /suspended/i);
    });
  });
});
