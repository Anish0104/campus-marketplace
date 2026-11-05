# Contributing

## The workflow

Everyone has one branch named after them (`anish`, `krisha`, `anuj`, `aryan`, `kunal`, `santanu`, `anand`) and works only in it.

First time:

```bash
git checkout main
git pull
git checkout -b <your-name>
git push -u origin <your-name>
```

Every day:

```bash
git checkout <your-name>
git pull origin main          # get everyone's merged work
# ...make changes...
git add .
git commit -m "Add create-listing API"
git push
```

When a piece of your feature works, open a pull request from your branch into `main`. Your backup reviewer approves it, CI goes green, then merge. Keep your branch afterwards and keep working in it.

Nobody pushes directly to `main`.

## Where your code goes

- **API route:** `server/src/routes/<feature>.ts`, then register it in `server/src/app.ts`
- **Database model:** `server/src/models/<Name>.ts`
- **Tests:** `server/tests/<feature>.test.ts` (start MongoDB first: `docker compose up -d`)
- **Pages:** `client/src/app/<route>/page.tsx`
- **Shared types:** `client/src/lib/types.ts`

## Shared UI

Open http://localhost:3000/ui to see every shared component. Use them instead of building your own:

| Need | Use |
| --- | --- |
| Page title row | `PageHeader` |
| A grid of listings | `ListingGrid` (takes `ListingSummary[]`) |
| One listing | `ListingCard` |
| A price | `PriceTag` |
| Item condition | `ConditionChip` |
| Nothing to show | `EmptyState` |
| Loading listings | `LoadingGrid` |
| A button that links to a page (in a server component) | `LinkButton` |
| "5m ago" style times | `RelativeTime` |
| Colors | `tokens` from `@/theme/tokens` (never raw hex values) |

Buttons, text fields and alerts come straight from MUI. The theme already styles them.

## Signed-in user

The client uses `CurrentUserProvider` to expose the account returned by
`GET /api/auth/me`. Login and signup establish a server-side session; `apiFetch`
includes the same-origin session cookie with API requests. On protected server
routes, use `requireUser` and read the authenticated ID from `req.userId`.
`x-user-id` is accepted only in the isolated test environment; browser code must
never set it.

## Rules

- Never commit `.env` files, passwords or API keys. Share keys privately.
- Run `npm run lint` and `npm test` before pushing.
- Keep pull requests focused on one thing.
