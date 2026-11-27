# Favorites

Owner: Santanu Agarwal (branch `santanu`). Covers FR-7, user story US-6 and use case UC-7:
a student saves listings to come back to later.

## What students see

- A heart on every listing card and a **Save** button on the listing page. Tap it to save,
  tap again to unsave. The change shows at once and is undone with an error message if
  the server refuses it.
- The heart is hidden for signed-out visitors and on your own listings. A sold listing
  can't be newly saved, but if you already saved it you can still unsave it.
- **Saved** in the header (signed-in students only) opens `/saved`:
  - Listings still for sale, newest saved first, as normal cards.
  - **No longer available**: saved listings that were sold, removed, deleted, or whose
    seller is suspended. Sold ones link to their page; the others show only the title.
    Each has a **Remove** button.
  - An empty state with **Browse listings** when nothing is saved.
- Signed-out visitors who open `/saved` are sent to the login page and back afterwards.

## Data

`Favorite` (`server/src/models/Favorite.ts`):

| Field | Meaning |
| --- | --- |
| `user` | The student who saved it (from the session, never from the request) |
| `listing` | The saved listing |
| `createdAt` | When it was saved |

Indexes:

```
{ user: 1, listing: 1 }  unique   one save per student per listing
{ user: 1, createdAt: -1 }        my saved list, newest first
{ listing: 1 }                    who saved this listing
```

The listing is never copied into the favorite, so the Saved page always shows the
current price and status. For notifications (Anand), the students to tell when a
listing is sold or removed are `Favorite.find({ listing }).select("user")`.

## API

All routes need a signed-in student (`requireUser`) and act only on that student's list.

| Route | Result |
| --- | --- |
| `GET /api/favorites` | `{ favorites: SavedListing[] }`, newest saved first |
| `GET /api/favorites/ids` | `{ ids: string[] }`, for heart buttons |
| `PUT /api/favorites/:listingId` | Save. **201** when new, **200** when already saved |
| `DELETE /api/favorites/:listingId` | Unsave. **200** even if it wasn't saved |

Each `SavedListing` is:

```json
{
  "listingId": "5eed00000000000000000000",
  "savedAt": "2026-11-27T15:04:05.000Z",
  "availability": "available",
  "title": "Calculus: Early Transcendentals, 9th edition",
  "listing": { "_id": "…", "title": "…", "price": 45, "status": "active", "…": "same fields as the feed" }
}
```

| `availability` | When | `listing` |
| --- | --- | --- |
| `available` | Active, seller not suspended | Card fields |
| `sold` | Sold, seller not suspended | Card fields |
| `unavailable` | Removed, deleted, or seller suspended | `null`; `title` is `null` if the listing was deleted |

Errors:

| Status | When |
| --- | --- |
| 400 | Invalid listing id, or saving your own listing |
| 401 | Not signed in |
| 404 | Saving a listing that doesn't exist or was removed |
| 409 | Newly saving a sold listing |

Saving the same listing twice, even in two requests at the same moment, leaves one row:
the unique index rejects the second insert and the route still answers with success.

## Tests

`server/tests/favorites.test.ts` (9 tests, real cookie sessions): sign-in required on every
route; save shows in the list and ids; duplicate and simultaneous saves ignored; unsave and
unsave again; each student's list is separate; newest saved first; invalid, unknown,
removed and own listings refused; a sold listing can't be newly saved; sold, removed,
deleted and suspended-seller listings show as unavailable and can still be unsaved.
