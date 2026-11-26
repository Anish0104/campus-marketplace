# Anuj Bohra — final report draft

## Listing lifecycle and photo uploads

I implemented the listing lifecycle for Campus Marketplace: creating an item,
uploading photos, viewing its details, editing its information, marking it sold,
and deleting it from the marketplace. The seller interface uses the project's
Next.js/React frontend and Material UI components, with Express APIs and Mongoose
models on MongoDB. Photos use the existing Multer/Sharp validation pipeline and
Cloudinary storage with authenticated upload ownership and batch attachment.

For the final phase, I added three authenticated seller endpoints:
`PATCH /api/listings/:id`, `PATCH /api/listings/:id/sold`, and
`DELETE /api/listings/:id`. These use the team's current cookie sessions and
check ownership in the database update filter. General edits accept only title,
description, price, category and condition, reuse shared validation, and preserve
photos, seller and status. The frontend displays prefilled editing and confirmation
dialogs only to the owner, prevents duplicate submissions, presents errors, and
updates the displayed data or returns to the feed after deletion.

The main integration challenge was preserving other features while changing a
listing's availability. Deletion therefore sets `status=removed` instead of
physically deleting the document or Cloudinary assets. Conversations and moderation
references remain valid, while the existing feed/profile filters hide sold and
removed records and the public detail route hides removed records. Atomic updates
include both ownership and allowed status so concurrent seller actions cannot
restore removed records. Repeated sold and delete requests are safe no-ops.
Existing conversation title snapshots remain unchanged after edits.

Verification includes session-based integration tests for successful edits,
non-owner and unauthenticated requests, input validation, immutable fields, invalid
and missing IDs, sold/deleted visibility, repeated requests, retained photos and
references, suspended accounts, and concurrent removal. The complete backend suite
passes 166 tests with 0 failures and 0 skips, including the existing creation,
photo, authentication, feed and messaging tests. Backend lint/build and frontend
lint/build also pass. The frontend build reports an advisory about the existing
Next.js version; a dependency upgrade is separate from this listings change.

Photo replacement, seller relisting, permanent asset deletion, new notifications,
and favorites behavior are outside this implementation. Browser and real
Cloudinary smoke testing remain manual checks.

## Final demonstration script

1. **Create:** Sign in, choose Sell an item, enter details and select photos.
   Create it and show the gallery and feed entry.
2. **Edit:** Open Edit listing, show prefilled fields and invalid-price feedback,
   change title/price, save, and show that photos remain intact.
3. **Sold:** Confirm Mark as sold. Show the Sold status and retained detail page,
   then search the home feed to demonstrate exclusion.
4. **Create again:** Post a second item to demonstrate deletion independently.
5. **Delete:** Cancel the confirmation once, then confirm deletion. Show return
   to the feed, exclusion from results and 404 for the previous detail link.
6. **Authorization:** Use another account to show that owner controls are absent;
   explain that the backend independently enforces ownership using the session.

Detailed setup and extra manual cases are in [LISTINGS.md](LISTINGS.md).
