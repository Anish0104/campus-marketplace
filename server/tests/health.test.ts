import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/api/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok" });
  });
});
