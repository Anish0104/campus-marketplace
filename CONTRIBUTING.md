# Contributing

## The workflow

1. Get the latest code: `git checkout main && git pull`
2. Make a branch for your feature: `git checkout -b feature/listings`
3. Commit small, clear changes: `git commit -m "Add create-listing API"`
4. Push your branch: `git push -u origin feature/listings`
5. Open a pull request on GitHub and fill in the template.
6. Your backup reviewer approves it, CI goes green, then merge.

Nobody pushes directly to `main`.

## Branch names

`feature/<what>` for new work, `fix/<what>` for bugs. Examples:
`feature/auth`, `feature/listings`, `feature/search`, `fix/feed-sorting`.

## Where your code goes

- **API route:** `server/src/routes/<feature>.ts`, then register it in `server/src/app.ts`
- **Database model:** `server/src/models/<Name>.ts`
- **Tests:** `server/tests/<feature>.test.ts`
- **Pages:** `client/src/app/<route>/page.tsx`
- **Reusable UI:** `client/src/components/` (check here before building your own)

## Rules

- Use the shared components and theme. Ask in the group chat if something is missing.
- Never commit `.env` files, passwords or API keys. Share keys privately.
- Run `npm run lint` and `npm test` before pushing.
- Keep pull requests focused on one thing.
