# VyroCoding — Setup Guide

## Quick Start

### Prerequisites
- **Node.js** 18+ with pnpm
- **PostgreSQL** 14+ running locally
- **Redis** (optional, for production)

### 1. Environment Setup

```bash
# Copy example env
cp apps/api/.env.example apps/api/.env

# Update DATABASE_URL and JWT_SECRET in apps/api/.env
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding
JWT_SECRET=your_secret_key_here
PORT=3001
```

### 2. Database Setup

```bash
# Create database
createdb vyro_coding

# Run schema
psql vyro_coding < apps/api/src/db/schema.sql

# Seed data (optional)
cd apps/api && npx tsx src/db/seed.ts
```

### 3. Install & Run

```bash
# Install dependencies
pnpm install

# Start dev servers (both API + web)
pnpm dev

# Or separately:
pnpm dev:api    # http://localhost:3001
pnpm dev:web    # http://localhost:3000
```

## Features

### 🎮 Core Multiplayer
- **Real-time code sync** — See teammates' code live (300ms debounce)
- **WebSocket chat** — Instant messaging in rooms
- **Voice chat** — WebRTC peer-to-peer audio + speaking detection
- **Room scoreboard** — Live leaderboard of who solved the problem

### 🏆 Problem Solving
- **Problem library** — 100+ LeetCode-style problems with test cases
- **Test case runner** — Run against all test cases, see pass/fail per case
- **Code execution** — Judge0 integration (supports 50+ languages)
- **Submission history** — Track all attempts

### 🎯 Social & Gamification
- **Live leaderboard** — Global rankings by rating/problems solved
- **Contests** — Timed competitions with countdowns
- **User profiles** — View stats, submission history, badges
- **Dark/light mode** — Theme persistence

### 🛠️ Admin Tools
- **Problem management** — Create/edit/delete problems via admin panel
- **Room management** — Monitor active rooms and participants
- **Submission viewer** — See all submissions with status

### ⏱️ Room Features
- **Host controls** — Problem switcher, timer (15/45/60 min), room deletion
- **Real-time sync** — Code, chat, voice all synchronized
- **Notifications** — Toast alerts for submissions, problem changes, timers

## API Endpoints

### Auth
- `POST /auth/register` — Create account
- `POST /auth/login` — Login
- `GET /auth/me` — Current user
- `POST /auth/forgot-password` — Reset token
- `POST /auth/reset-password` — Set new password

### Rooms
- `GET /rooms` — List public rooms
- `POST /rooms` — Create room (auto-assigns 10 problems)
- `GET /rooms/:id` — Room details + participants
- `GET /rooms/:id/problems` — Room's problem list
- `GET /rooms/:id/scoreboard` — Accepted submissions
- `PATCH /rooms/:id/active-problem` — Host changes problem (broadcasts)
- `PATCH /rooms/:id/timer` — Host sets timer
- `GET /rooms/:id/ws` — WebSocket endpoint

### Problems
- `GET /problems` — List all problems
- `GET /problems/:slug` — Problem details + test cases
- `GET /problems/:slug/submissions` — Submission history

### Execute
- `POST /execute/run` — Run code (single test case)
- `POST /execute/run-all` — Run all test cases
- `GET /execute/submissions/:id` — Check submission status

### Social
- `GET /leaderboard` — Global rankings
- `GET /users/:username` — User profile
- `GET /contests` — List contests
- `POST /contests/:id/join` — Join contest

### Admin
- `GET /admin/stats` — Platform stats
- `GET /admin/problems` — All problems (admin only)
- `POST /admin/problems` — Create problem
- `PATCH /admin/problems/:id` — Edit problem
- `DELETE /admin/problems/:id` — Delete problem
- `GET /admin/submissions` — Recent submissions

## WebSocket Messages

Room WS at `wss://api.vyrocoding.com/rooms/:id/ws?token=...`

**Types:**
- `chat` — Text message
- `code-update` — Code sync
- `submission-result` — Someone solved
- `problem-changed` — Host changed problem
- `timer-start` — Timer started
- `voice-*` — WebRTC signaling (offer/answer/ice/join/leave/mute)

## Database Schema

**Key Tables:**
- `users` — Auth + profiles
- `problems` — Problem statements + test cases
- `rooms` — Multiplayer sessions
- `room_participants` — Who's in each room
- `room_problems` — Problems assigned to rooms
- `submissions` — Code execution results
- `contests` — Timed competitions
- `contest_participants` — Contest enrollments

## Deployment

### Vercel (Frontend)
```bash
cd apps/web
vercel deploy
```

### Railway/Render (API)
```bash
# Set env vars: DATABASE_URL, JWT_SECRET, PORT
# Deploy apps/api
```

### Neon (Database)
```bash
# Create serverless Postgres
# Update DATABASE_URL in deployed API
```

## Contributing

1. Fork & branch
2. Make changes
3. Test locally
4. Submit PR with description

## License

MIT — Build on top of this freely.
