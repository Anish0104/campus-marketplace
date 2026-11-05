import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { User } from "../src/models/User";
import { seedUsers, SEEDED_USERS } from "../src/seed/seedUsers";
import { verifyPassword } from "../src/services/password";

const TEST_PASSWORD = "seed-test-password";

describe("seed users", () => {
  const testDb = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
  testDb.pathname = `${testDb.pathname}-user-seed`;
  let dbReady = false;

  before(async () => {
    try {
      await mongoose.connect(testDb.toString(), { serverSelectionTimeoutMS: 2000 });
      await mongoose.connection.dropDatabase();
      await User.createIndexes();
      dbReady = true;
    } catch {
      console.warn("Skipping user-seed tests: MongoDB unavailable.");
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    if (dbReady) await User.deleteMany({ email: { $in: SEEDED_USERS.map((user) => user.email) } });
  });

  after(async () => {
    if (dbReady) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("creates the requested student accounts with hashed passwords and is repeatable", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const first = await seedUsers(TEST_PASSWORD);
    assert.deepEqual(first, { created: 3, updated: 0 });

    for (const expected of SEEDED_USERS) {
      const user = await User.findOne({ email: expected.email }).select("+passwordHash");
      assert.ok(user);
      assert.equal(user.name, expected.name);
      assert.equal(user.role, "student");
      assert.equal(user.suspended, false);
      assert.notEqual(user.passwordHash, TEST_PASSWORD);
      assert.equal(await verifyPassword(TEST_PASSWORD, user.passwordHash!), true);
    }

    const second = await seedUsers(TEST_PASSWORD);
    assert.deepEqual(second, { created: 0, updated: 3 });
    assert.equal(await User.countDocuments({ email: { $in: SEEDED_USERS.map((user) => user.email) } }), 3);
  });

  it("resets an existing password while preserving its role and other account state", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const target = SEEDED_USERS[0];
    await User.create({
      ...target,
      passwordHash: "old-hash",
      role: "admin",
      suspended: true,
    });

    const result = await seedUsers(TEST_PASSWORD);
    assert.deepEqual(result, { created: 2, updated: 1 });
    const user = await User.findOne({ email: target.email }).select("+passwordHash");
    assert.ok(user);
    assert.equal(user.name, target.name);
    assert.equal(user.role, "admin");
    assert.equal(user.suspended, true);
    assert.equal(await verifyPassword(TEST_PASSWORD, user.passwordHash!), true);
  });

  it("rejects seed passwords outside the authentication password limits", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await assert.rejects(seedUsers("short"), /at least 8 characters/);
    await assert.rejects(seedUsers("a".repeat(73)), /no more than 72 bytes/);
  });
});
