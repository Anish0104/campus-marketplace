# Listings: creation, photos and seller management

Listing mutations require the `requireUser` middleware and a valid marketplace
session cookie. Feed, category and active/sold detail reads are public. `req.userId` is loaded from the server-side account record. Create
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
viewer for active or sold listings. Invalid ObjectIds return **400**; missing or
removed documents return **404**. Invalid creation input returns **400**.
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
- Seller deletion is soft deletion, retaining attached photos. Photo replacement,
  private delivery and moderation actions are outside this feature. Existing Stage 1 URL-only records are preserved; they have no upload
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

The detail page `/listings/[id]` fetches public `GET /api/listings/:id` and uses
the current session account to show seller controls. Requests are cancelled on route/account changes and stale results are
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
[FEED.md](FEED.md). Anish's integrated messaging derives seller/title from the
listing on the server. The detail page preserves its Message seller button and
photo gallery alongside the owner controls documented below.

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
7. During submission verify inputs and the submit button are disabled. Signing
   out discards the current draft; sign back in through the normal login flow.
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


## Seller management API

All three routes use `requireUser` and derive the seller from `req.userId`, which
is populated from the cookie session and current database account. Suspended
accounts receive **403**; missing/expired sessions receive **401**. There is no
browser `x-user-id` fallback and no administrator bypass on seller routes.

| Endpoint | JSON request | Success |
| --- | --- | --- |
| `PATCH /api/listings/:id` | Nonempty subset of `title`, `description`, `price`, `category`, `condition` | **200**, updated raw Listing document |
| `PATCH /api/listings/:id/sold` | No body, or `{}` | **200**, sold raw Listing document |
| `DELETE /api/listings/:id` | No body, or `{}` | **200**, removed raw Listing document |

Example edit request:

```json
{ "title": "Calculus textbook, 9th edition", "price": 18 }
```

Responses use the same document shape as creation, including `_id`, `seller`,
`photos`, `status`, `createdAt` and `updatedAt`. Omitted editable fields remain
unchanged. Text is trimmed. Limits, finite nonnegative numeric price and condition
values use the existing `listingValidationError` helper and Mongoose validators.
The helper's partial mode is used only by seller edits; creation/admin validation
continues to validate complete fields. Unknown fields are rejected, including
`seller`, `status`, `_id`, `id`, timestamps, `__v`, `photos`, `photoUploadId` and
MongoDB operators. No photo upload or replacement occurs during an edit.

Errors retain `{ "error": "Helpful message" }`:

- **400**: invalid ObjectId, empty edit, invalid field value, unsupported field,
  action with unexpected fields, array/non-object edit, or malformed JSON.
- **401/403**: session/account restrictions as above.
- **404**: missing listing, another seller's listing, or a status that disallows
  the requested action. The common message is
  `Listing not found or unavailable for this action.` No ownership information
  is revealed by management requests.

### Status transitions and concurrency

| Starting state | Edit fields | Mark sold | Delete |
| --- | --- | --- | --- |
| `active` | `active` | `sold` | `removed` |
| `sold` | `sold` | **200** no-op | `removed` |
| `removed` | **404** | **404** | **200** no-op for owner |

Writes use atomic `findOneAndUpdate` filters containing ID, authenticated seller
and allowed starting status. An edit or sold request cannot resurrect a listing
removed by a concurrent seller/moderation action. Repeated sold/delete requests
return the existing document without changing `updatedAt`. There is no seller
relist/restore endpoint. The existing administrator endpoint can restore records;
concurrent administrator conflict resolution remains that feature's responsibility.
Edits to the same field use last-write-wins semantics.

### Soft deletion and photo retention

Delete only sets `status=removed`; it never deletes Listing, PhotoUpload,
Conversation, Message or Flag records and never contacts Cloudinary. Attached
batches stay `attached`, so the existing abandoned-upload cleanup preserves them.
Photo URLs remain publicly deliverable: deletion hides the marketplace listing,
not the underlying provider asset. Legacy URL-only photos are also retained.
Permanent erasure/private delivery would require a separate retention policy and
reference audit with the teams responsible for messaging, moderation and favorites.
Sold listings retain their detail pages and photos; removed detail URLs return
404 even for the seller. Existing conversations remain usable from the inbox.
New conversations remain restricted to active listings by Anish's existing route.

Aryan's existing `status: active` feed/category filters and Santanu's existing
profile filter already exclude sold/removed listings. Neither implementation was
changed. There are no notification emissions or favorites changes in this work.
Existing conversation title snapshots intentionally retain their original title.
Anand can add status notifications later; Santanu can map removed favorites to
unavailable when that integration is implemented. Kunal's Flag references survive
soft deletion. Completed seller deletion returns the browser to `/`.

### Seller interface and manual final demo

On `/listings/[id]`, the authenticated owner sees **Edit listing**, **Mark as sold**
(only when active), and **Delete listing**. Other viewers see no management
controls. The prefilled MUI edit dialog validates fields, preserves photos and
status, and updates detail data immediately after saving. Sold/delete dialogs
explain the effect and require confirmation. A synchronous submission lock and
busy buttons prevent duplicate requests. Failed requests preserve the dialog and
show the API error. Controls reset on account/route changes and stale mutation
results are ignored after unmount.

With MongoDB, API and frontend running, use two normal Rutgers accounts:

1. Sign in as seller A. Create a listing with two photos at **Sell an item**.
   Verify the detail gallery and the listing in the public feed.
2. Click **Edit listing**. Confirm fields are prefilled. Try blank title and
   negative price, then save a new title and price. Confirm photos, seller and
   status stay unchanged, and refresh to verify persistence.
3. Click **Mark as sold**, cancel once, reopen and confirm. Check the Sold chip,
   disabled availability/message behavior, preserved gallery and detail URL.
   Return to the home feed and verify the item is excluded (including search).
4. Create another listing. Click **Delete listing**, cancel once, then confirm.
   Verify navigation to `/`, absence from the feed and a not-found state when
   reopening the saved detail URL. Check the existing chat from the inbox if one
   was started before deletion.
5. Sign in as B and open A's active listing. Verify no management controls and
   that messaging/gallery still work. Direct mutation requests with B's session
   return 404. Sign out: feed and active/sold details remain public; mutations
   return 401.
6. At mobile and desktop widths, check the dialogs, long descriptions, inline
   errors, keyboard focus, confirmation cancel buttons and gallery thumbnails.
   Use DevTools offline mode to check error recovery and disabled submissions.
   Reconnect and refresh before retrying an ambiguous network response.

`server/tests/listingManagement.test.ts` uses actual registration cookies in its
own `-listing-management` database and fails rather than skips if MongoDB is
unavailable. It covers edits, ownership (including non-owner admins), sessions,
invalid fields/IDs/body shapes, immutable fields, repeated terminal actions,
feed/category/profile visibility, preserved references/photos, suspension and
concurrent removal. Existing suites keep their established isolated test-only
header fixtures; no authentication middleware behavior was changed.

See [Anuj's final report draft](LISTINGS_FINAL_REPORT.md) for the report section
and presentation script. Real browser/Cloudinary smoke testing remains manual.
