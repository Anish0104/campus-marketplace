import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import mongoose from "mongoose";
import request from "supertest";
import { io as connectClient, type Socket } from "socket.io-client";
import { createApp } from "../src/app";
import { initSocket } from "../src/socket";
import { User } from "../src/models/User";

// These tests need MongoDB. Locally: `docker compose up -d` in the repo root.
const TEST_DB =
  process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test";

const alex = new mongoose.Types.ObjectId().toString();
const sam = new mongoose.Types.ObjectId().toString();
const jordan = new mongoose.Types.ObjectId().toString();
const listingId = new mongoose.Types.ObjectId().toString();

let dbReady = false;
const app = createApp();

before(async () => {
  try {
    await mongoose.connect(TEST_DB, { serverSelectionTimeoutMS: 2000 });
    dbReady = true;
  } catch {
    console.warn(`Skipping messaging tests: no MongoDB at ${TEST_DB}`);
  }
});

after(async () => {
  if (dbReady) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

beforeEach(async () => {
  if (dbReady) await mongoose.connection.dropDatabase();
});

const as = (userId: string) => ({ "x-user-id": userId });

async function startConversation(buyer = alex, seller = sam) {
  return request(app)
    .post("/api/conversations")
    .set(as(buyer))
    .send({ listingId, sellerId: seller, listingTitle: "Calculus textbook" });
}

describe("conversations", () => {
  it("requires a signed-in user", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await request(app).get("/api/conversations");
    assert.equal(res.status, 401);
  });

  it("creates one conversation per listing per buyer", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const first = await startConversation();
    assert.equal(first.status, 201);
    const again = await startConversation();
    assert.equal(again.status, 200);
    assert.equal(again.body._id, first.body._id);
  });

  it("does not let a seller message themselves", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await startConversation(sam, sam);
    assert.equal(res.status, 400);
  });

  it("shows each user only their own conversations", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await startConversation(alex, sam);
    const mine = await request(app).get("/api/conversations").set(as(sam));
    const theirs = await request(app).get("/api/conversations").set(as(jordan));
    assert.equal(mine.body.length, 1);
    assert.equal(theirs.body.length, 0);
  });
});

describe("messages", () => {
  it("sends a message and updates the inbox preview", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const convo = await startConversation();
    const sent = await request(app)
      .post(`/api/conversations/${convo.body._id}/messages`)
      .set(as(alex))
      .send({ body: "  Is this still available?  " });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.body, "Is this still available?");

    const thread = await request(app)
      .get(`/api/conversations/${convo.body._id}/messages`)
      .set(as(sam));
    assert.equal(thread.body.length, 1);

    const inbox = await request(app).get("/api/conversations").set(as(sam));
    assert.equal(inbox.body[0].lastMessage.body, "Is this still available?");
  });

  it("rejects empty and too-long messages", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const convo = await startConversation();
    const url = `/api/conversations/${convo.body._id}/messages`;
    const empty = await request(app).post(url).set(as(alex)).send({ body: "   " });
    const long = await request(app).post(url).set(as(alex)).send({ body: "a".repeat(1001) });
    assert.equal(empty.status, 400);
    assert.equal(long.status, 400);
  });

  it("hides conversations from people who are not in them", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const convo = await startConversation();
    const url = `/api/conversations/${convo.body._id}/messages`;
    const read = await request(app).get(url).set(as(jordan));
    const write = await request(app).post(url).set(as(jordan)).send({ body: "hi" });
    assert.equal(read.status, 404);
    assert.equal(write.status, 404);
  });
});

describe("real-time delivery", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  const sockets: Socket[] = [];

  before(async () => {
    const liveApp = createApp();
    httpServer = createServer(liveApp);
    liveApp.set("io", initSocket(httpServer));
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  after(async () => {
    sockets.forEach((s) => s.disconnect());
    await new Promise((resolve) => httpServer.close(resolve));
  });

  async function connectAs(userId: string) {
    const ticketResponse = await request(baseUrl)
      .post("/api/auth/socket-ticket")
      .set(as(userId));
    if (ticketResponse.status !== 200) throw new Error(ticketResponse.body.error ?? "Could not get socket ticket.");
    const socket = connectClient(baseUrl, { auth: { ticket: ticketResponse.body.ticket }, transports: ["websocket"] });
    sockets.push(socket);
    return new Promise<Socket>((resolve, reject) => {
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", reject);
    });
  }

  it("pushes a new message to the recipient instantly", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await User.create([
      { _id: alex, netId: "socket-alex", name: "Alex Student" },
      { _id: sam, netId: "socket-sam", name: "Sam Student" },
    ]);
    const samSocket = await connectAs(sam);
    const received = new Promise<{ message: { body: string } }>((resolve) =>
      samSocket.on("message:new", resolve)
    );

    const convo = await request(baseUrl)
      .post("/api/conversations")
      .set(as(alex))
      .send({ listingId, sellerId: sam, listingTitle: "Desk lamp" });
    await request(baseUrl)
      .post(`/api/conversations/${convo.body._id}/messages`)
      .set(as(alex))
      .send({ body: "Can I pick it up today?" });

    const event = await received;
    assert.equal(event.message.body, "Can I pick it up today?");
  });

  it("refuses socket connections without a user", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await assert.rejects(connectAs("not-an-id"));
  });
});
