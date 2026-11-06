# Listings: Stages 1, 2 and 3

All listing endpoints require the `requireUser` middleware and a valid marketplace
session cookie. `req.userId` is loaded from the server-side account record. Create
an account or sign in through the app before testing authenticated listing
endpoints; the project has no demo-account login. The optional prepared-account
seed is documented in [Authentication](AUTH.md).

The optional `curl` example below assumes you already have a valid marketplace
session cookie. For normal testing, use the browser UI; its HttpOnly session
cookie is sent automatically.

## Listing schema

The Mongoose model is registered as `Listing`, preserving Conversation's existing
`ref: "Listing"`. Seller references `User` and is not populated in API responses.

- Required trimmed title: 1–120 characters (matches conversation title snapshots).
- Required trimmed description: 1–5000 characters.
- Required finite numeric price in dollars: >= 0; zero means free.
- Required trimmed category: 1–80 characters. Free text pending a shared taxonomy.
- Required condition: `new`, `like_new`, `good`, `fair`, matching client types.
- Photos: URL strings, defaults to `[]`, maximum five, each <= 2048 characters.
  The model shape is unchanged; creation now derives URLs from an owned upload.
- Required seller ObjectId, always derived from `req.userId` during creation.
- Status: `active`, `sold`, `removed`; creation forces `active`.
- Mongoose-managed `createdAt` and `updatedAt` timestamps.

## Upload photos

`POST /api/listings/photos`

Send `multipart/form-data` with one to five file parts, all named `photos`.
No text fields are accepted. Authentication runs before multipart parsing.

```bash
curl -X POST http://localhost:4000/api/listings/photos \
  -b cookies.txt \
  -F "photos=@/path/to/book.jpg;type=image/jpeg" \
  -F "photos=@/path/to/desk.png;type=image/png"
```

Returns **201**:

```json
{
  "photoUploadId": "507f1f77bcf86cd799439011",
  "expiresAt": "2026-11-05T12:00:00.000Z",
  "photos": [
    {
      "url": "https://res.cloudinary.com/your_cloud/image/upload/v123/campus-marketplace/listings/507f1f77bcf86cd799439011/0.webp",
      "publicId": "campus-marketplace/listings/507f1f77bcf86cd799439011/0"
    }
  ]
}
```

Limits and content validation:

- At most five images per request, each at most **5 MiB (5 × 1024 × 1024 bytes)**.
- Only JPEG (`image/jpeg`), PNG (`image/png`) and WebP (`image/webp`). Actual
  decoded format must match the declared MIME type; filenames confer no trust.
- Sharp checks the format, rejects animation and images over 20 megapixels, and
  decodes/re-encodes the image as WebP. Corrupt pixel data is rejected. EXIF/GPS
  metadata and trailing content are discarded; orientation is normalized.
- Normalized output must also be <= 5 MiB. Cloudinary accepts image/WebP only.
- Files are held in bounded per-request memory, never saved to local disk.
  Decoding/uploading is sequential within each request. Concurrent requests can
  still consume significant resources; deployment should add upload rate limits,
  quotas and reverse-proxy body/time limits before public use.

All files are validated before any Cloudinary upload. Empty uploads, invalid
formats, mismatched MIME types, excessive size/count, unexpected form fields and
malformed multipart return **400**. Missing/invalid authentication returns **401**.
Cloudinary failures return **502**:

```json
{ "error": "Photo upload failed. Please try again." }
```

Provider errors/credentials are not returned or logged. Database failures can use
the existing application-level JSON **500** handler. Other errors use the same
`{ "error": "Helpful error message" }` shape.

## Create a listing using uploaded photos

`POST /api/listings`, Content-Type: application/json:

```json
{
  "title": "Calculus textbook",
  "description": "Lightly used textbook",
  "price": 25,
  "category": "Books",
  "condition": "good",
  "photoUploadId": "507f1f77bcf86cd799439011"
}
```

The upload ID represents the entire ordered batch. Upload all selected photos in
one request; batches cannot be combined or individually edited in this stage.
Omit `photoUploadId` for a listing without photos. `photos` may be omitted or `[]`;
**nonempty URL arrays from Stage 1 are now rejected**, including Cloudinary URLs.
Public IDs and URLs returned to clients are display metadata, never ownership proof.

The server atomically claims a ready, unexpired upload matching `req.userId`,
marks it attached to a new server-generated listing ID, and copies only its stored
URLs into `Listing.photos`. Another owner, expired batch, unknown batch or reused
batch returns **400** with the same generic error. Concurrent requests cannot
claim the same batch twice. Seller, status, ids and timestamps in the body cannot
override server values. No client-controlled asset deletion endpoint exists.

Returns **201** with the raw listing document:

```json
{
  "_id": "507f191e810c19729de860ea",
  "title": "Calculus textbook",
  "description": "Lightly used textbook",
  "price": 25,
  "category": "Books",
  "condition": "good",
  "photos": ["https://res.cloudinary.com/your_cloud/image/upload/v123/campus-marketplace/listings/507f1f77bcf86cd799439011/0.webp"],
  "seller": "507f191e810c19729de860eb",
  "status": "active",
  "createdAt": "2026-11-04T12:00:00.000Z",
  "updatedAt": "2026-11-04T12:00:00.000Z",
  "__v": 0
}
```

If saving fails and the listing is confirmed absent, the claim is released so the
owner can retry before expiry. If the database cannot confirm absence, the claim
is retained to avoid allowing reuse of an ambiguously successful write.

`GET /api/listings/:id` returns **200** with the same document shape to any
signed-in user. Invalid ObjectIds return **400**; missing documents return **404**.
It does not filter by status. Invalid creation input returns **400**.
The feed endpoint `GET /api/listings` is documented in [FEED.md](FEED.md).

## Storage configuration

Server-side environment variables (placeholders in `server/.env.example`):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

`server/src/index.ts` already loads dotenv before creating the app. The reusable
Cloudinary service configures the official SDK lazily, using signed server-side
stream uploads. No unsigned upload preset or client secret is required. Public
IDs use `campus-marketplace/listings/<server-generated batch id>/<index>` and
`overwrite: false`. Images use public HTTPS delivery. No real credentials or
external uploads are needed for automated tests. Real-account connectivity and
permissions still require a manual smoke test; automated tests mock storage.

## Failure cleanup and abandoned uploads

`PhotoUpload` records store owner, public IDs, URLs, state, expiry and optional
listing association. Public IDs are persisted **before** contacting Cloudinary.
Batches expire 24 hours after upload begins. There is deliberately no MongoDB TTL
index: deleting only a database record would lose the IDs needed to delete assets.

On partial failure, the batch is marked `cleanup` and deletion is attempted for
all planned IDs, including the failed request's ID (a timeout may hide a completed
upload). Successful cleanup removes the batch record. Failed deletions retain it
for retry. Missing Cloudinary assets are treated as already cleaned.

From `server/`, run:

```bash
npm run photos:cleanup
```

**Schedule this command externally, for example hourly**, against the same
MongoDB database and Cloudinary account as the server. No scheduler is installed
by this change. It marks expired ready/uploading batches for cleanup, retries all
cleanup records, and preserves live or attached batches. State transitions are
conditional, so cleanup and listing creation cannot both acquire a ready batch.
The command returns a failure exit code if cleanup is incomplete. Do not switch
Cloudinary accounts while there are pending cleanup records.

Limitations:

- MongoDB and Cloudinary cannot commit atomically. A process crash between the
  attachment claim and listing write can leave an attached reservation with no
  listing. The command intentionally preserves attached records: stop concurrent
  writes and manually reconcile old attached records against their listing IDs
  before marking confirmed orphans for cleanup. A future transactional workflow
  or reconciliation job can automate this safely.
- A crash after receiving some files but before creating the batch record leaves
  no Cloudinary assets because provider uploads have not started yet.
- A very late provider completion after deletion, prolonged database outages, or
  provider unavailability can still leave assets requiring Cloudinary-console
  reconciliation. Cleanup retries are best effort, not a distributed transaction.
- No full listing deletion, photo replacement, private delivery or moderation is
  added here. Existing Stage 1 URL-only records are preserved; they have no upload
  ownership metadata and must not be treated as verified owned Cloudinary assets.

## Stage 3: frontend usage and integration

Open `http://localhost:3000/listings/new`, or use **Sell an item** in the existing
navigation/home page after signing in.
The form requires title, description, category, condition, and a numeric USD price
of zero or more. Category stays free text, matching the backend. Field length
limits match Stage 1. Photos are optional.

Use **Add photos** to select JPEG, PNG or WebP images, up to five files at 5 MiB
each. Local previews appear immediately; **Replace** and **Remove** update the
selection. The first selected image is the cover. Preview object URLs are revoked
on removal, replacement, account changes and unmount. Client MIME/size checks are
only early feedback: the backend remains authoritative for actual image contents,
normalized size, animation and dimensions.

Submission performs these steps:

1. Validate required fields and price; focus the first invalid field.
2. Lock the form synchronously to prevent duplicate submissions.
3. If there are photos, POST one FormData batch to `/api/listings/photos`, with
   repeated `photos` fields and the current session cookie. The shared
   `apiFetch` recognizes FormData and leaves Content-Type unset so fetch supplies
   the multipart boundary. Existing JSON messaging requests remain JSON.
4. POST listing JSON to `/api/listings` with the returned `photoUploadId`. No URL
   or public ID is submitted as ownership evidence. With no photos, omit the
   upload reference and skip uploading entirely.
5. Navigate to `/listings/<returned _id>` after successful creation.

The form shows uploading/creating/opening states and preserves inputs on failure.
Errors use the existing `ApiError` convention. A retry uploads a fresh complete
batch, so expired/invalid references are never cached or reused. Failed or
abandoned prior batches follow the 24-hour cleanup policy above. A lost network
response can hide a successful write: the error warns users to check before
resubmitting. The API has no idempotency key, so duplicates remain possible after
an ambiguous network failure. Drafts are kept only in memory, not persisted.
Signing out discards the draft; if it happens during an upload, the old form does
not proceed to creation. A listing request already sent may still save under the
original account.

The detail page `/listings/[id]` fetches `GET /api/listings/:id` using the current
account. Requests are cancelled on route/account changes and stale results are
not displayed. It shows price, condition, category, status, full plain-text
description, created date, and seller **ObjectId**; no seller name is invented.
Photos have a main image and keyboard-accessible selectable thumbnails, with
placeholders for missing/broken main images. Loading, invalid ID, 404,
authentication and retryable network/server errors have distinct states.

The dynamic detail route and the shared header's pathname hook have Suspense
boundaries required by the existing Next.js Cache Components configuration. The
header component itself is unchanged; only its layout boundary was added.

The typed `toListingSummary` adapter in `client/src/lib/listings.ts` maps `_id`
to `id`, `photos[0]` to optional `imageUrl`, and copies the other card fields.
`sellerName` stays absent until a public account API exists. Existing ListingCard
and ListingGrid contracts are unchanged.

Newly created listings appear at the top of the feed on the home page; see
[FEED.md](FEED.md). Anish's messaging
flow still needs to load Listing and derive seller/title on the server instead
of trusting conversation request fields before wiring a contact-seller action.
No chat action, edit, delete, mark-sold or other teammates' features are added.

### Manual end-to-end verification

With MongoDB, server (port 4000), and client (port 3000) running:

1. Create an account or sign in and open `/listings/new`.
2. Submit an empty form and check inline validation. Enter an item with price 0
   and no photos; create it and verify the detail page shows Free, the description,
   category, condition, seller ID, created date and no-photo placeholder.
3. Create another listing with two valid photos. Verify previews, remove/replace,
   and submit. In DevTools Network, verify multipart upload then listing JSON with
   `photoUploadId`; confirm no arbitrary photos/public IDs appear in creation JSON.
4. Verify the detail gallery, thumbnail keyboard interaction, refresh and saved
   URL. Repeat at mobile and desktop widths; check that fields and images fit.
5. Try six photos, a file over 5 MiB, and an unsupported type. Check useful client
   errors. A corrupt file labeled as PNG should be rejected by the server while
   the form preserves the selected files and text for correction.
6. Open `/listings/not-an-id` and `/listings/ffffffffffffffffffffffff` to check
   invalid-link and not-found states. Temporarily stop the API or use DevTools
   offline mode to verify retry/error behavior, then restore it and try again.
7. During submission verify inputs and the submit button are disabled. Do not
   switch development accounts until completion when testing a real upload.
8. Real Cloudinary connectivity is a manual check: automated tests mock it. Keep
   the existing server credentials configured privately; no frontend secret is
   required. Schedule the cleanup command as described above.

## Verification

Inside `server/`: `npm run lint`, `npm run build`, `npm test`.
Tests use Node's test runner, Supertest, Mongoose and mocked photoStorage methods;
they never load `.env` or invoke Cloudinary. PNG/JPEG/WebP fixtures are generated
in memory. The test URI defaults to `campus-marketplace-test`; listing and photo
suites append `-listings` and `-photo-uploads`, respectively, to avoid the messaging
suite's parallel database-drop hooks. Use only a dedicated `MONGODB_TEST_URI`.
Database-dependent tests explicitly skip when MongoDB is unavailable; validation
and authentication tests still run. Cleanup tests only call mocked deletion.

Frontend checks: run `npm run lint` and `npm run build` inside `client/`.
There is no existing frontend test runner; no new framework was introduced.
