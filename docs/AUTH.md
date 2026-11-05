# Authentication and accounts

## Sign up and sign in

Create an account at `/signup` with your name, a Rutgers email address ending
exactly in `@rutgers.edu` or `@scarletmail.rutgers.edu`, and a password. Sign in
at `/login`. Email matching is case-insensitive and stored in lowercase. The
server enforces the same checks as the form and returns **"Only Rutgers students
can register."** for other email domains.

Registration currently checks the address domain only. It does not send an email
or prove that the user owns the inbox or is enrolled at Rutgers. Use only an
address you control. Email verification was left out to avoid requiring an email
provider and its credentials.

Passwords are hashed with bcrypt before storage; plaintext passwords and hashes
are never returned to the browser. Passwords must be at least 8 characters and
no more than 72 UTF-8 bytes. No character classes or composition rules are
required. Login and registration requests are rate limited.
Password-reset email is not configured; forgotten passwords require administrator
assistance until an email provider is added.

For controlled project/demo use, the three prepared Rutgers student accounts
can be created or reset with the same password. Set `MONGODB_URI` to the intended
database and review it carefully; the command previews by default. To apply,
provide the shared password through `SEED_USER_PASSWORD` using a secure local
environment mechanism, then run the command below. Do not commit the password
or put it in a shared command log:

```bash
npm run seed:users -- --apply
```

The command stores only bcrypt hashes. New accounts are students; if an email
already exists, its password is reset while its role and other account state are
preserved. The shared, predictable password is for controlled demo use only.

CAS sign-in has been removed. There is no demo-account or passwordless login path.

## Accounts and permissions

Password-created accounts use their normalized email as the unique login
identifier. Legacy `netId` remains optional for existing records. New accounts
default to the `student` role; administrator promotion is a privileged database
operation because the app has no admin-management interface.

If upgrading a database that contains CAS-created accounts, those accounts do not
have password hashes and cannot use password login. Do not silently link a new
registration to a legacy account by typed email: without email verification this
could allow account takeover. Existing records are not deleted by this change.

The User schema changes the unique `netId` index to a sparse unique index so
multiple email/password accounts can omit `netId`. On a database created by the
old CAS schema, run the `migrate:auth-user-indexes` script once before allowing
registration. First preview the changes, then back up the database and apply:

```bash
npm run migrate:auth-user-indexes
npm run migrate:auth-user-indexes -- --apply
```

The script refuses to normalize colliding email addresses; resolve those records
manually before retrying. It does not delete user records or attach passwords to
legacy accounts.

The backend stores a seven-day session in MongoDB in production and uses an
HttpOnly, Secure, SameSite=Lax cookie. Local development uses an in-memory session
store. Production must set `NODE_ENV=production`, `MONGODB_URI`, and a random
`SESSION_SECRET` of at least 32 characters. The frontend proxies `/api` requests
through its own origin (`API_SERVER_URL`) so browsers do not need third-party
cookies. Do not set `NEXT_PUBLIC_API_URL` for the proxy-based production
deployment; configure `NEXT_PUBLIC_SOCKET_URL` to the Socket.IO server.

`GET /api/auth/me` returns the current account. `POST /api/auth/logout` ends the
marketplace session. `requireUser` checks the current database account on
protected requests, and `requireAdmin` checks its server-side role. Suspended
accounts cannot sign in or use authenticated routes. Socket.IO connections use
short-lived, single-use credentials issued only to the current session.

The API continues to populate `req.userId`, so feature routes can use the existing
owner/participant logic. The old `x-user-id` header is accepted only by the test
runner's isolated test mode; clients do not send it.
