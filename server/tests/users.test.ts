import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { User, USER_ROLES } from "../src/models/User";

describe("User model", () => {
  it("uses the account fields shared with moderation and messaging", () => {
    const user = new User({
      netId: "  Krisha-Demo ",
      name: " Krisha Borana ",
      email: " KRISHA@example.edu ",
      passwordHash: "hashed-password",
    });

    assert.equal(user.netId, "krisha-demo");
    assert.equal(user.name, "Krisha Borana");
    assert.equal(user.email, "krisha@example.edu");
    assert.equal(user.role, "student");
    assert.equal(user.suspended, false);
    assert.equal(User.schema.options.timestamps, true);
    assert.deepEqual(USER_ROLES, ["student", "admin"]);
  });

  it("rejects missing identity fields and unknown roles", async () => {
    for (const user of [
      new User({ email: "student@example.edu" }),
      new User({ name: "Student", role: "owner" }),
    ]) {
      await assert.rejects(user.validate());
    }
  });

  it("supports password accounts without a NetID and keeps password hashes private by default", async () => {
    const user = new User({
      name: "Student",
      email: "student@rutgers.edu",
      passwordHash: "hashed-password",
    });
    await assert.doesNotReject(user.validate());
    assert.equal(user.netId, undefined);
    assert.equal(User.schema.path("passwordHash").options.select, false);
    assert.equal(User.schema.indexes().some(([index, options]) =>
      "netId" in index && options?.unique === true && options.sparse === true
    ), true);
  });
});
