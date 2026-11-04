import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { Listing } from "../src/models/Listing";
import { removeSampleListings, SAMPLE_COUNT, sampleId, seedSampleListings } from "../src/seed/sampleListings";
import { buildFeedFilter, buildFeedSort, parseFeedQuery, toTextSearch } from "../src/services/feedQuery";

// Own database so this suite never races the other suites' cleanup hooks.
const TEST_DB = new URL(process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017/campus-marketplace-test");
TEST_DB.pathname = `${TEST_DB.pathname}-feed`;
const app = createApp();
const seller = new mongoose.Types.ObjectId();
const viewer = new mongoose.Types.ObjectId().toString();
let dbReady = false;

before(async () => {
  try {
    await mongoose.connect(TEST_DB.toString(), { serverSelectionTimeoutMS: 2000 });
    await Listing.createIndexes(); // $text needs the text index to exist
    dbReady = true;
  } catch {
    console.warn("Skipping feed database tests: MongoDB unavailable.");
  }
});
beforeEach(async () => { if (dbReady) await Listing.deleteMany({}); });
after(async () => {
  if (dbReady) await Listing.deleteMany({});
  await mongoose.disconnect();
});

const HOUR = 60 * 60 * 1000;
let clock = Date.now();
type Fields = { title?: string; description?: string; price?: number; category?: string; condition?: string; status?: string; createdAt?: Date };

/** Inserts listings directly so each one gets a distinct, controlled createdAt. */
async function insert(...items: Fields[]) {
  const docs = items.map((item) => {
    clock -= HOUR;
    const createdAt = item.createdAt ?? new Date(clock);
    return {
      title: "Item", description: "Something useful", price: 10, category: "Other",
      condition: "good", photos: [], seller, status: "active", ...item, createdAt, updatedAt: createdAt,
    };
  });
  return Listing.insertMany(docs, { timestamps: false } as never);
}

const feed = (query = "") => request(app).get(`/api/listings${query}`).set("x-user-id", viewer);
const titles = (res: request.Response) => res.body.listings.map((l: { title: string }) => l.title);

describe("parseFeedQuery", () => {
  it("defaults to newest, page 1, 20 per page", () => {
    assert.deepEqual(parseFeedQuery({}), { ok: true, query: { sort: "newest", page: 1, limit: 20 } });
  });
  it("treats blank values as not set", () => {
    const result = parseFeedQuery({ q: "  ", category: "", condition: "", minPrice: "", maxPrice: "", sort: "", page: "" });
    assert.deepEqual(result, { ok: true, query: { sort: "newest", page: 1, limit: 20 } });
  });
  it("parses every filter", () => {
    const result = parseFeedQuery({
      q: " calculus ", category: " Textbooks ", condition: "good,like_new", minPrice: "5", maxPrice: "49.99",
      sort: "price_asc", page: "2", limit: "10",
    });
    assert.deepEqual(result, {
      ok: true,
      query: { q: "calculus", category: "Textbooks", conditions: ["good", "like_new"], minPrice: 5, maxPrice: 49.99, sort: "price_asc", page: 2, limit: 10 },
    });
  });
  it("accepts repeated condition keys and removes duplicates", () => {
    const result = parseFeedQuery({ condition: ["good", "fair,good"] });
    assert.ok(result.ok);
    assert.deepEqual(result.query.conditions, ["good", "fair"]);
  });
  const invalid: [string, Record<string, unknown>][] = [
    ["unknown condition", { condition: "excellent" }],
    ["negative price", { minPrice: "-1" }],
    ["non-numeric price", { maxPrice: "cheap" }],
    ["too many decimals", { maxPrice: "1.999" }],
    ["min above max", { minPrice: "50", maxPrice: "10" }],
    ["unknown sort", { sort: "oldest" }],
    ["page zero", { page: "0" }],
    ["fractional page", { page: "1.5" }],
    ["page too large", { page: "1001" }],
    ["limit too large", { limit: "51" }],
    ["search too long", { q: "a".repeat(101) }],
    ["category too long", { category: "a".repeat(81) }],
  ];
  for (const [name, raw] of invalid) {
    it(`rejects ${name}`, () => {
      const result = parseFeedQuery(raw);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(typeof result.error, "string");
    });
  }
});

describe("feed query builders", () => {
  it("always limits the feed to active listings", () => {
    assert.deepEqual(buildFeedFilter({ sort: "newest", page: 1, limit: 20 }), { status: "active" });
  });
  it("escapes regex characters in the category", () => {
    const filter = buildFeedFilter({ category: "C++ (books)", sort: "newest", page: 1, limit: 20 });
    assert.deepEqual(filter.category, { $regex: "^C\\+\\+ \\(books\\)$", $options: "i" });
  });
  it("strips MongoDB search syntax from what students type", () => {
    assert.equal(toTextSearch('"mini fridge" -broken'), "mini fridge broken");
    assert.equal(toTextSearch("TI-84"), "TI-84");
  });
  it("breaks ties so pages are stable", () => {
    assert.deepEqual(buildFeedSort("newest"), { createdAt: -1, _id: -1 });
    assert.deepEqual(buildFeedSort("price_asc"), { price: 1, createdAt: -1, _id: -1 });
    assert.deepEqual(buildFeedSort("price_desc"), { price: -1, createdAt: -1, _id: -1 });
  });
});

describe("GET /api/listings", () => {
  it("requires a signed-in user", async () => {
    for (const path of ["/api/listings", "/api/listings/categories"]) {
      const res = await request(app).get(path);
      assert.equal(res.status, 401);
      assert.equal(typeof res.body.error, "string");
    }
  });

  it("returns 400 with a message for invalid filters", async () => {
    const res = await feed("?minPrice=50&maxPrice=10");
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "minPrice cannot be greater than maxPrice.");
  });

  it("returns an empty page when there are no listings", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const res = await feed();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { listings: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it("shows active listings newest first and leaves out the description", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert({ title: "Newest" }, { title: "Middle" }, { title: "Oldest" });
    const res = await feed();
    assert.equal(res.status, 200);
    assert.deepEqual(titles(res), ["Newest", "Middle", "Oldest"]);
    const [first] = res.body.listings;
    assert.equal(first.description, undefined);
    for (const field of ["_id", "title", "price", "category", "condition", "photos", "seller", "status", "createdAt"]) {
      assert.ok(field in first, `missing ${field}`);
    }
    assert.equal(first.seller, seller.toString());
  });

  it("excludes sold and removed listings", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert({ title: "Available" }, { title: "Sold", status: "sold" }, { title: "Removed", status: "removed" });
    const res = await feed();
    assert.deepEqual(titles(res), ["Available"]);
    assert.equal(res.body.total, 1);
  });

  it("pages 20 at a time without repeating listings", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert(...Array.from({ length: 45 }, (_, i) => ({ title: `Item ${i}` })));
    const pages = await Promise.all([feed("?page=1"), feed("?page=2"), feed("?page=3"), feed("?page=4")]);
    assert.deepEqual(pages.map((res) => res.body.listings.length), [20, 20, 5, 0]);
    assert.ok(pages.every((res) => res.body.total === 45 && res.body.totalPages === 3));
    const ids = pages.flatMap((res) => res.body.listings.map((l: { _id: string }) => l._id));
    assert.equal(new Set(ids).size, 45);
  });

  it("keeps pages stable when listings share a createdAt", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const same = new Date();
    await insert(...Array.from({ length: 6 }, (_, i) => ({ title: `Tie ${i}`, createdAt: same })));
    const [a, b, c] = await Promise.all([feed("?limit=2&page=1"), feed("?limit=2&page=2"), feed("?limit=2&page=3")]);
    const ids = [a, b, c].flatMap((res) => res.body.listings.map((l: { _id: string }) => l._id));
    assert.equal(new Set(ids).size, 6);
  });

  it("searches titles and descriptions by keyword", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert(
      { title: "Calculus textbook", description: "Stewart 9th edition" },
      { title: "Desk lamp", description: "Great for reading calculus notes late" },
      { title: "Mini fridge", description: "Cold and quiet" },
    );
    const res = await feed("?q=calculus");
    assert.deepEqual(titles(res).sort(), ["Calculus textbook", "Desk lamp"]);
    const stem = await feed("?q=textbooks"); // English stemming: textbooks finds textbook
    assert.deepEqual(titles(stem), ["Calculus textbook"]);
    const none = await feed("?q=bicycle");
    assert.deepEqual(none.body.listings, []);
    assert.equal(none.body.total, 0);
  });

  it("filters by category without caring about case", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert({ title: "Book A", category: "Textbooks" }, { title: "Book B", category: "textbooks" }, { title: "Chair", category: "Furniture" });
    const res = await feed("?category=TEXTBOOKS");
    assert.deepEqual(titles(res), ["Book A", "Book B"]);
    const partial = await feed("?category=Text"); // whole-name match only
    assert.deepEqual(partial.body.listings, []);
  });

  it("filters by one or more conditions", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert({ title: "N", condition: "new" }, { title: "L", condition: "like_new" }, { title: "G", condition: "good" }, { title: "F", condition: "fair" });
    assert.deepEqual(titles(await feed("?condition=fair")), ["F"]);
    assert.deepEqual(titles(await feed("?condition=new,like_new")), ["N", "L"]);
  });

  it("filters by price range, inclusive, with free items counted as 0", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert({ title: "Free", price: 0 }, { title: "Ten", price: 10 }, { title: "Fifty", price: 50 }, { title: "Hundred", price: 100 });
    assert.deepEqual(titles(await feed("?minPrice=10&maxPrice=50")), ["Ten", "Fifty"]);
    assert.deepEqual(titles(await feed("?maxPrice=0")), ["Free"]);
    assert.deepEqual(titles(await feed("?minPrice=60")), ["Hundred"]);
  });

  it("sorts by price both ways", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert({ title: "Mid", price: 20 }, { title: "Cheap", price: 5 }, { title: "Pricey", price: 90 });
    assert.deepEqual(titles(await feed("?sort=price_asc")), ["Cheap", "Mid", "Pricey"]);
    assert.deepEqual(titles(await feed("?sort=price_desc")), ["Pricey", "Mid", "Cheap"]);
  });

  it("combines search, filters and sort", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert(
      { title: "Chemistry textbook", category: "Textbooks", condition: "good", price: 40 },
      { title: "Chemistry textbook, older edition", category: "Textbooks", condition: "fair", price: 15 },
      { title: "Chemistry lab coat", category: "Supplies", condition: "good", price: 20 },
      { title: "Chemistry textbook", category: "Textbooks", condition: "good", price: 30, status: "sold" },
      { title: "Biology textbook", category: "Textbooks", condition: "good", price: 25 },
    );
    const res = await feed("?q=chemistry&category=textbooks&maxPrice=45&sort=price_asc");
    assert.deepEqual(res.body.listings.map((l: { price: number }) => l.price), [15, 40]);
    const good = await feed("?q=chemistry&category=Textbooks&condition=good");
    assert.deepEqual(good.body.listings.map((l: { price: number }) => l.price), [40]);
  });

  it("still serves single listings and creation after the feed routes", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const created = await request(app).post("/api/listings").set("x-user-id", viewer)
      .send({ title: "Lamp", description: "Bright", price: 5, category: "Furniture", condition: "good" });
    assert.equal(created.status, 201);
    const one = await request(app).get(`/api/listings/${created.body._id}`).set("x-user-id", viewer);
    assert.equal(one.status, 200);
    assert.equal(one.body.description, "Bright");
    assert.deepEqual(titles(await feed()), ["Lamp"]);
  });
});

describe("GET /api/listings/categories", () => {
  it("lists categories of active listings, merging different capitalisation", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    await insert(
      { category: "Textbooks", createdAt: new Date(Date.now() - 3 * HOUR) },
      { category: "textbooks", createdAt: new Date(Date.now() - 2 * HOUR) },
      { category: "Furniture" },
      { category: "Bikes", status: "sold" },
    );
    const res = await request(app).get("/api/listings/categories").set("x-user-id", viewer);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { categories: [{ name: "Furniture", count: 1 }, { name: "Textbooks", count: 2 }] });
  });
});

describe("sample listings seed", () => {
  it("is safe to run twice and only removes its own listings", async (t) => {
    if (!dbReady) return t.skip("no MongoDB");
    const [mine] = await insert({ title: "A real student's listing" });
    const first = await seedSampleListings();
    assert.equal(first.inserted, SAMPLE_COUNT);
    const second = await seedSampleListings();
    assert.equal(second.inserted, 0);
    assert.equal(await Listing.countDocuments(), SAMPLE_COUNT + 1);
    assert.ok(await Listing.exists({ _id: sampleId(0) }));

    const res = await feed("?limit=50");
    assert.ok(res.body.listings.every((l: { status: string }) => l.status === "active"));
    assert.ok(res.body.total >= 30, "about 30 active samples for the demo");

    assert.equal(await removeSampleListings(), SAMPLE_COUNT);
    assert.ok(await Listing.exists({ _id: mine!._id }));
  });
});
