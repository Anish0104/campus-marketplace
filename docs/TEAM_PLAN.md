# Campus Marketplace: Team Plan

Group 13 · Software Engineering, Fall 2026

## Roles

| Member | Branch | Owns |
| --- | --- | --- |
| Anish Shirodkar | `anish` | Repo setup, UI foundation (theme, shared components, layout), real-time messaging |
| Krisha Borana | `krisha` | Sign-in and accounts (Rutgers email/password and protected routes) |
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
| Sign-in | Rutgers-domain email and password |
| CI | GitHub Actions |



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
| Features | Nov 16–27 | Chat, moderation, favorites, notifications |
| Test and demo | Nov 30–Dec 4 | Testing, fixes, final report, final demo |