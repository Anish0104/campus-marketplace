# Flagging and admin review

Moderation lets a student report a listing or another user, and lets an admin work
through those reports. This document covers the midterm scope: the `Flag` model and
the `User` fields moderation depends on. The `POST /api/flags` route, the Report
button and the admin queue page are after-midterm work.

## Flag schema

The Mongoose model is registered as `Flag`.

- Required `targetType`: `listing` or `user`. Decides which collection `target`
  points into.
- Required `target` ObjectId, resolved through `refPath: "targetModel"` so
  `populate("target")` loads either a Listing or a User without a second query.
- `targetModel`: `Listing` or `User`. **Derived** from `targetType` in a
  `pre("validate")` hook and never taken from the request, so a caller cannot point
  the reference at the wrong collection.
- Required `reporter` ObjectId referencing the user who filed the report.
- Required `reason`: `scam`, `prohibited`, `offensive` or `other`. These are the four
  choices on the Report button.
- Optional trimmed `note`, at most 1000 characters, defaulting to `""`. The reason
  alone is often enough.
- Required `status`: `open`, `dismissed` or `actioned`, defaulting to `open`.
- `resolvedBy` ObjectId and `resolvedAt` date, both `null` while the flag is open.
  Written together with the terminal status so a decision has an author and a time.
- Mongoose-managed `createdAt` and `updatedAt` timestamps.

### Indexes

```
{ targetType: 1, target: 1, reporter: 1 }  unique
{ status: 1, createdAt: -1 }
{ targetType: 1, target: 1, status: 1 }
```

The unique index is what stops the same user flagging the same item twice; a second
attempt fails with a duplicate-key error rather than being silently ignored. It is
scoped by `targetType`, so one reporter may flag both a listing and its seller, and a
different reporter may still flag the same item. The second index drives the admin
queue (open flags, newest first). The third answers "has this item been reported?" on
listing detail.

## User fields moderation depends on

`server/src/models/User.ts` is **Krisha's model**. A minimal version was written on
the `kunal` branch so moderation had something to reference and test against; if
Krisha's version differs, hers wins. Only the fields other features already depend on
are defined: `netId`, `name`, `email`, `role` and `suspended`. Sign-in, sessions and
CAS handling are deliberately absent.

- `role`: `student` or `admin`, defaulting to `student`. Krisha's `requireAdmin` and
  the admin queue both read it.
- `suspended`: boolean, defaulting to `false`. This is the existing contract in
  `server/src/services/suspension.ts`, which already returns `false` for everyone
  while no `User` model is registered. Kunal sets the flag; Krisha blocks sign-in;
  Anish blocks messaging.

`netId` and `email` are both unique and lowercased on write, so `CD5678` and `cd5678`
cannot both exist.

## Admin actions

Every action closes the flag by writing `status`, `resolvedBy` and `resolvedAt`.

| Action | Flag status | Side effect |
| --- | --- | --- |
| Dismiss | `dismissed` | None; the report was not valid |
| Remove listing | `actioned` | `Listing.status = "removed"` |
| Suspend user | `actioned` | `User.suspended = true`, and their listings are hidden |

Removing a listing drops it from Aryan's feed and shows it as unavailable in
Santanu's saved list. Suspending a user blocks sign-in and messaging. Anand creates a
notification from the resolution.

## Wireframe and schema diagram

- Admin flagged-items queue wireframe: <https://claude.ai/artifact/Dauz4tvgv4mHfDFEvVzC1X>
- Database schema diagram, all seven models: <https://claude.ai/artifact/1P9ZXTw8ZkzxtneSGAgsBa>

Both links are private until shared from each page's Share menu.

## Tests

`server/tests/flags.test.ts`, run with `npm test` from `server/`. Start MongoDB first
with `docker compose up -d`; the suite skips itself with a warning if the database is
unreachable, so a skipped run is not a passing run.

Covered: stored fields and trimming, the empty-note default, `targetModel` derivation
including a caller trying to override it, `populate` through `refPath`, every enum
rejection, missing required fields, the note length limit, the duplicate-flag rule
and the two cases it must still allow, admin queue ordering, resolution bookkeeping,
`User` defaults and lowercasing, and agreement with `isSuspended` in both states.
