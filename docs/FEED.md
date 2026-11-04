# Feed, search and filters

Owner: Aryan Nagwekar (branch `aryan`). Covers FR-4 and FR-5, user story US-3 and use case UC-3.

The home page (`/`) shows active listings, newest first, 20 per page. Students can
search by keyword and filter by category, condition and price, and sort by date or
price. Filters live in the page URL, so a search can be refreshed, shared and undone
with the Back button.

## API

Both routes need the temporary `x-user-id` header (`requireUser`), like the rest of
`/api/listings`. They live in `server/src/routes/feed.ts`, which `app.ts` mounts
before the listings router so `/categories` is never read as a listing id.

### `GET /api/listings`

| Query | Example | Meaning |
| --- | --- | --- |
| `q` | `calculus` | Keyword search on title and description (MongoDB text index, up to 100 characters) |
| `category` | `Textbooks` | Whole category name, any capitalisation (`books` finds `Books`, `Book` does not) |
| `condition` | `good,like_new` | One or more of `new`, `like_new`, `good`, `fair` (comma list or repeated key) |
| `minPrice`, `maxPrice` | `5`, `49.99` | Dollars, inclusive. Free items have price 0 |
| `sort` | `price_asc` | `newest` (default), `price_asc`, `price_desc` |
| `page` | `2` | 1 to 1000, default 1 |
| `limit` | `20` | 1 to 50, default 20 |

Blank values (`?category=`) count as not set. Anything invalid returns **400** with
`{ "error": "..." }`, for example `minPrice cannot be greater than maxPrice.`

Returns **200**:

```json
{
  "listings": [
    {
      "_id": "5eed00000000000000000000",
      "title": "Calculus: Early Transcendentals, 9th edition",
      "price": 45,
      "category": "Textbooks",
      "condition": "good",
      "photos": [],
      "seller": "000000000000000000000001",
      "status": "active",
      "createdAt": "2026-11-04T14:00:00.000Z",
      "updatedAt": "2026-11-04T14:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 30,
  "totalPages": 2
}
```

- Only `status: "active"` listings are returned. Sold and removed ones never appear.
- Each item is the listing document **without** `description`, to keep the feed light.
  Open `GET /api/listings/:id` for the full listing.
- Every sort ends with `createdAt` then `_id`, so paging never repeats or skips a
  listing, even when two listings were created at the same moment.
- Search uses English stemming, so `textbooks` finds `textbook`. It matches whole
  words, so `calc` does not find `calculus`. Quotes and a leading `-` are stripped,
  because MongoDB would otherwise treat them as phrase and exclude operators.

### `GET /api/listings/categories`

Categories that have active listings right now, for the filter menu. Category is
free text, so different capitalisations are merged under the first spelling used.

```json
{ "categories": [{ "name": "Furniture", "count": 6 }, { "name": "Textbooks", "count": 6 }] }
```

### Indexes

Added to `server/src/models/Listing.ts`:

- `{ status: 1, createdAt: -1 }` and `{ status: 1, price: 1 }` for the feed sorts.
- Text index `listing_text_search` on `title` (weight 5) and `description` (weight 1).
  MongoDB allows only one text index per collection, so extend this one if you need
  more searchable fields.

Mongoose builds indexes when the server connects. The seed script and the tests call
`Listing.createIndexes()` first, because `$text` fails until the text index exists.

## Sample listings

From `server/`, with MongoDB running:

```bash
npm run seed:listings              # add or reset 32 sample listings
npm run seed:listings -- --remove  # delete only the sample listings
```

- 30 active samples across Textbooks, Furniture, Appliances, Electronics, Supplies,
  Clothing, Bikes and Other, plus 2 sold ones that should never show in the feed.
- Prices range from free to $150 and creation times are spread over the last week.
- Sellers are the three test accounts in `client/src/lib/devUsers.ts`.
- Every sample has a fixed id starting with `5eed`, so running the script again resets
  the samples and never touches listings people created. Samples have no photos.
- The script refuses to run with `NODE_ENV=production` unless you pass `--force`.

## Page

`client/src/app/page.tsx` renders `FeedView` inside a Suspense boundary (needed for
`useSearchParams` with Cache Components).

- `components/feed/FeedView.tsx` reads filters from the URL, fetches the page and the
  category list, and shows the results with the shared `ListingGrid`, `LoadingGrid`
  and `EmptyState` components.
- `components/feed/FeedFilterBar.tsx` holds the search box and the filter menus.
  Menus apply straight away. The search box applies on Enter or **Search**, and the
  price fields on Enter or when they lose focus, so the feed doesn't reload on every
  keystroke. Any filter change goes back to page 1. Bad prices show an inline error
  and are not sent.
- `lib/feed.ts` converts between the URL and the filters, and calls the API. Malformed
  URL values are ignored rather than breaking the page.
- Cards come from Anuj's `toListingSummary`, which now also accepts feed items.

States:

| Situation | What the student sees |
| --- | --- |
| Loading | Skeleton grid |
| No listings at all | "No listings yet" with **Sell an item** |
| Filters match nothing | "No listings match your filters" with **Clear filters** |
| Page number past the end (old link) | "This page is empty" with **Go to the first page** |
| Server unreachable or error | The error message with **Try again** |
| Not signed in | "Sign in to browse listings" |

Results show a count (`31 listings`, `3 listings for “calculus”`) and, past 20 results,
page numbers at the bottom.

## Tests

`server/tests/feed.test.ts` (own database, `campus-marketplace-test-feed`):

- Query parsing: defaults, blanks, every filter, repeated keys, and each invalid input.
- Feed: newest first, description left out, sold and removed excluded, 20 per page
  with no repeats, stable paging with equal timestamps, keyword search and stemming,
  category ignoring case, one or more conditions, inclusive price range including
  free, both price sorts, everything combined, and single-listing and create routes
  still working alongside the feed routes.
- Categories endpoint, 401 without a user, 400 for bad filters.
- Seed script is idempotent and removes only its own listings.

Run with `npm test` in `server/` (MongoDB must be running; database tests skip
otherwise). There is no frontend test runner in the project yet.

## Manual check

1. `docker compose up -d`, then `npm run seed:listings` in `server/`, then start the
   server and client.
2. Open http://localhost:3000. You should see 20 listings and page numbers for 2 pages.
3. Search `textbook`, filter Textbooks, set a max price of 40, sort by price. Refresh
   the page and check the filters are still applied, then press Back.
4. Search `zzz` and check the "no results" state and **Clear filters**.
5. Stop the server and press **Try again** to see the error state.
6. Create a listing at **Sell an item** and check it appears at the top of the feed.
