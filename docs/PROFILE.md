# Profile

Owner: Santanu Agarwal (branch `santanu`). Covers the public profile page and `GET /api/users/:id`.

## What students see

`/users/<id>` shows a student's name, NetID, the month they joined, and their active
listings in the shared `ListingGrid`. Open it from **View seller profile** on any
listing page. Your own profile says "Your profile" and offers **Sell an item**.
A student with no active listings sees an empty state, and an unknown id shows
"Profile not found".

## API

`GET /api/users/:id` needs the temporary `x-user-id` header (`requireUser`). Any signed-in
student can view any profile.

Returns **200**:

```json
{
  "id": "000000000000000000000002",
  "name": "Krisha Borana",
  "netId": "kb0002",
  "memberSince": "2026-11-04T14:00:00.000Z",
  "listings": [
    { "_id": "5eed00000000000000000001", "title": "...", "price": 60, "category": "Textbooks",
      "condition": "good", "photos": [], "seller": "000000000000000000000002",
      "status": "active", "createdAt": "...", "updatedAt": "..." }
  ]
}
```

| Status | When |
| --- | --- |
| 400 | `:id` is not a valid ObjectId |
| 401 | No signed-in user |
| 404 | No such user |

**Public fields only.** The response is built field by field, so email, role, suspended
flag and password data are never sent. `netId` is `null` for accounts without one.
`listings` holds only that user's **active** listings, newest first, without descriptions.
For a suspended user the profile still loads but `listings` is empty (moderation hides
their listings, see Kunal's suspend action).

## Local setup

The test accounts in `client/src/lib/devUsers.ts` have no `User` documents until you run:

```bash
cd server
npm run seed:profiles    # creates the 3 test users with the ids the sample listings use
npm run seed:listings    # sample listings (Aryan)
```

`server/src/models/User.ts` is Krisha's model, copied unchanged so this branch works on its
own. When her branch merges, the two files are identical.

## Tests

`server/tests/profile.test.ts`: sign-in required, invalid id, unknown user, no email or role
in the response, missing NetID, only active listings newest first, empty list, suspended user.
