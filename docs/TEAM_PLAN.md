# Campus Marketplace: Team Plan

Group 13 · Software Engineering, Fall 2026

## Roles

| Member | Branch | Owns |
| --- | --- | --- |
| Anish Shirodkar | `anish` | Repo setup, UI foundation (theme, shared components, layout), real-time messaging |
| Krisha Borana | `krisha` | Sign-in and accounts (test login, then NetID) |
| Anuj Bohra | `anuj` | Listings and photo upload |
| Aryan Nagwekar | `aryan` | Feed, search and filters |
| Kunal Pasad | `kunal` | Flagging and admin review queue |
| Santanu Agarwal | `santanu` | Profile, "My listings" and favorites |
| Anand Patel | `anand` | Notifications, deployment, QA |

Each person builds their feature end to end (pages, API, data model, tests) and demos it.

## Rules

1. Work only in your own branch. Never push to `main`.
2. Run `git pull origin main` before starting new work.
3. When something works, open a pull request into `main`. One approval and green CI to merge.
4. Use the shared components in `client/src/components/`.
5. Never commit `.env` files or keys.

## Stack (all free)

| Part | Tool |
| --- | --- |
| Frontend | Next.js on Vercel |
| Backend + chat | Express + Socket.IO on Render |
| Database | MongoDB Atlas |
| Photos | Cloudinary |
| Sign-in | Rutgers NetID (CAS) |
| CI | GitHub Actions |

## Midterm sprint (due Nov 6)

Goal: log in, post a listing with a photo, see it in the feed, all deployed. Code freeze Wed Nov 4.

| Member | Tasks |
| --- | --- |
| Anish | Repo and CI (Oct 30) · Wireframes (Nov 1) · Theme and shared components (Nov 3) · Chat prototype (Nov 4) |
| Krisha | Test login (Oct 31) · NetID access request (Nov 2) |
| Anuj | Listing API (Nov 2) · New listing form with photo upload (Nov 4) |
| Aryan | Feed API (Nov 2) · Feed page (Nov 4) |
| Kunal | Flag model and admin wireframe (Nov 2) · Database schema diagram (Nov 4) |
| Santanu | Profile page (Nov 2) · Midterm slides (Nov 4) |
| Anand | Hosting accounts (Nov 1) · Deployed site (Nov 3) · Notification setup and test plan (Nov 4) |
| Everyone | Rehearsal (Nov 5) |

## Midterm presentation

1. Title and recap: Santanu
2. Stack and architecture: Anand
3. Database schema: Kunal
4. Wireframes: Anish
5. Roles and progress: Krisha, Aryan
6. Live demo: Anuj and Anish
7. Next steps: Krisha

## Timeline

| Phase | Dates | Work |
| --- | --- | --- |
| Design | Oct 12–23 | Requirements, wireframes, schema |
| Core build | Oct 26–Nov 13 | Login, listings, feed, search, UI, deployment |
| Features | Nov 16–27 | Chat, moderation, favorites, notifications, NetID |
| Test and demo | Nov 30–Dec 4 | Testing, fixes, final report, final demo |