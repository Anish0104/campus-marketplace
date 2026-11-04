# Campus Marketplace

A student-only web app where Rutgers students buy, sell and trade used items.
Software Engineering (14:332:452/567), Fall 2026, Group 13.

## Stack

| Part | Tech |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Material UI (`client/`) |
| Backend | Node.js, Express, Socket.IO (`server/`) |
| Database | MongoDB (local via Docker, MongoDB Atlas in production) |
| Photos | Cloudinary |
| CI | GitHub Actions |

## Requirements

- Node.js 20.9 or newer (22 or 24 LTS recommended): `node -v`
- Docker Desktop, for the local database

## Run it locally

```bash
# 1. Clone
git clone https://github.com/Anish0104/campus-marketplace.git
cd campus-marketplace

# 2. Start MongoDB
docker compose up -d

# 3. Backend (terminal 1)
cd server
cp .env.example .env
npm install
npm run dev        # http://localhost:4000/api/health

# 4. Frontend (terminal 2)
cd client
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

Then open:

- http://localhost:3000/ui for the shared components
- http://localhost:3000/messages for chat. Click **Start a test conversation**, then open a second browser window, switch **Test account** to Sam Okafor, and reply. Messages appear in both windows instantly.

## Useful commands

| Where | Command | What it does |
| --- | --- | --- |
| server | `npm run dev` | Start the API with auto-reload |
| server | `npm test` | Run the tests in `server/tests/` (needs MongoDB running) |
| server | `npm run lint` | Type-check |
| client | `npm run dev` | Start the website |
| client | `npm run lint` | Lint |
| client | `npm run build` | Production build |

## Project structure

```
client/
  src/app/          pages (one folder per route)
  src/components/   shared UI components (see /ui)
  src/lib/          API calls, shared types, helpers
  src/theme/        MUI theme and color tokens
server/
  src/routes/       one router file per feature
  src/models/       one Mongoose model per collection
  src/middleware/   requireUser (who is signed in)
  src/app.ts        registers routers
  src/socket.ts     real-time chat
  tests/            API tests
```

## Team

| Member | Owns |
| --- | --- |
| Anish Shirodkar | Repo setup (structure, CI, Docker, team workflow) · UI foundation (wireframes, theme, shared components, responsive layout) · Real-time messaging (Socket.IO chat, inbox, conversations per listing) |
| Krisha Borana | Sign-in and accounts (NetID login, sessions, protected routes) |
| Anuj Bohra | Listings (create, edit, delete, mark sold, photo upload) |
| Aryan Nagwekar | Feed and search (keyword search, filters) |
| Kunal Pasad | Moderation (flagging, admin review queue) |
| Santanu Agarwal | Profile and favorites |
| Anand Patel | Notifications, deployment, QA and testing |