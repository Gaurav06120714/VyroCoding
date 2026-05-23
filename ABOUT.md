# About VyroCoding

## What Is VyroCoding?

**VyroCoding** is a **real-time multiplayer coding interview & practice platform** built for competitive programmers, students, and tech interview candidates.

Think of it as:
- **LeetCode** (problem solving) +
- **Discord** (real-time chat & voice) +
- **VS Code** (code editor) +
- **Google Sheets** (live code sync)

...all in one web app.

---

## The Problem We Solve

Traditional coding platforms are **single-player**:
- You code alone on LeetCode
- You interview over Zoom (screen sharing is clunky)
- You chat on Discord (separate from your editor)
- You can't see teammates' code in real-time

**VyroCoding solves this** by bundling everything together:
- Code alongside teammates with **live sync**
- **Voice chat** built-in (no Discord tab switch)
- **See who solved** problems first (scoreboard)
- **Real-time chat** in the room
- **Contests** with countdowns
- **Leaderboard** to track progress

---

## Who Uses VyroCoding?

1. **CS Students** — Practice problems together, study groups, coding clubs
2. **Interview Prep** — Mock interviews with peers, live feedback
3. **Competitive Programming** — Contests, team challenges, speed contests
4. **Coding Bootcamps** — Instructors can host rooms, students collaborate
5. **Companies** — Technical hiring screening (via admin panel)

---

## Key Differentiators

| Feature | VyroCoding | LeetCode | HackerRank | Codewars |
|---|---|---|---|---|
| Real-time Code Sync | ✅ | ❌ | ❌ | ❌ |
| Voice Chat (Built-in) | ✅ | ❌ | ❌ | ❌ |
| Room-based Collaboration | ✅ | ❌ | ❌ | ❌ |
| Room Scoreboard | ✅ | ❌ | ❌ | ❌ |
| Contests | ✅ | ✅ | ✅ | ✅ |
| Problem Library | ✅ (extensible) | ✅ | ✅ | ✅ |
| Open Source | ✅ | ❌ | ❌ | ❌ |
| Free | ✅ | Partially | Partially | ✅ |

---

## How It Works

### For Students
1. **Sign up** → Create/join a room
2. **Invite teammates** → Share room link
3. **Select a problem** (host broadcasts to everyone)
4. **Code together** → See each other's code in real-time
5. **Run tests** → Check all test cases
6. **Submit solution** → See on room scoreboard
7. **Voice chat** → Discuss with teammates (built-in mic)
8. **Repeat** → Move to next problem

### For Instructors
1. **Access admin panel** → Create custom problems
2. **Create a contest** → Set time limit, problem list
3. **Host a room** → Set timer, broadcast problem changes
4. **Monitor submissions** → See who solved, how long it took
5. **View analytics** → See submission history, speed rankings

### For Companies
1. **Post a contest** → Create interview problems
2. **Candidates join** → Solve within time limit
3. **Review submissions** → Automated scoring + manual review
4. **Hire top candidates** → View leaderboard

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         VyroCoding Browser App           │
│  (Next.js 15 + React + Tailwind CSS)    │
├─────────────────────────────────────────┤
│         ↓                                │
│  REST API (Fastify) @ :3001             │
│  ├── Auth (register/login/JWT)          │
│  ├── Problems (CRUD, test cases)        │
│  ├── Rooms (create, join, manage)       │
│  ├── Execution (Judge0 integration)     │
│  ├── Leaderboard (rankings)             │
│  ├── Contests (timed competitions)      │
│  └── Admin panel (problem mgmt)         │
│         ↓                                │
│  WebSocket @ /rooms/:id/ws              │
│  ├── Chat messages                      │
│  ├── Code sync (debounced)              │
│  ├── Voice signaling (WebRTC)           │
│  ├── Submission results                 │
│  ├── Problem changes (host broadcast)   │
│  └── Timer updates                      │
│         ↓                                │
│  PostgreSQL Database                     │
│  ├── 15 tables (users, problems, etc)   │
│  ├── Migrations in schema.sql           │
│  └── Seed data (100+ problems)          │
└─────────────────────────────────────────┘
```

---

## Real-time Features Breakdown

### 1. Code Sync
- Every keystroke is sent over WebSocket (debounced 300ms)
- All participants see the same code in real-time
- Preserves individual cursor positions
- Shows who's editing (via "X is watching" indicator)

### 2. Voice Chat
- Built-in WebRTC peer-to-peer audio
- No external service needed (e.g., Discord)
- Speaking detection via Web Audio API analyzer
- Mute toggle, show participant list with speaking status

### 3. Chat
- Instant messages over WebSocket
- Visible to all room participants
- Timestamps + usernames
- Support for emoji and code snippets

### 4. Room Scoreboard
- Live rankings of who solved the current problem
- Shows: username, language used, time taken, solve order
- Auto-updates when someone submits accepted solution
- Persisted in database (can review later)

### 5. Problem Broadcast
- Host can switch problems for entire room
- All participants' editors reset to starter code
- WS message triggers reload across all clients
- Old code is preserved in submission history

### 6. Room Timer
- Host sets duration (15/30/45/60 min)
- Countdown shows in room header
- Turns red under 5 minutes
- Auto-ends room when timer hits zero
- Prevents new submissions after time's up

---

## What Makes VyroCoding Different

### Open Source
- Full source code available on GitHub
- No vendor lock-in
- Deploy on your own servers (Vercel + Railway + Neon)
- Fork and customize for your use case

### Real-time Collaboration
- Not just watching a shared screen (async)
- Simultaneous editing like Google Docs but for code
- Voice + chat + code in one context

### Flexible Problem Library
- Admin panel to add unlimited problems
- Support for any language (Judge0 has 50+)
- Custom test cases + input/output validation
- Hidden test cases for contests

### Scalable Architecture
- WebSocket broadcasts (not individual polling)
- PostgreSQL for persistent data
- Redis-ready for sessions (multi-instance support)
- Judge0 for sandboxed code execution

---

## Roadmap

### ✅ Implemented
- Real-time code sync
- WebRTC voice chat
- Live chat (WebSocket)
- Room scoreboard
- Problem library (100+ problems)
- Contests with countdown
- Global leaderboard
- User profiles
- Admin panel
- Dark/light mode

### 🔄 In Progress
- Deploy to production (Vercel + Railway)
- Email notifications
- Real email sending (Resend)

### 🚀 Planned
- Friends system (follow/activity feed)
- Problem discussions (comments/hints)
- XP + streak system
- Mobile app (React Native)
- Interview scheduler (calendar)
- Company hiring portal
- Live code review mode
- Collaborative debugging (breakpoints)

---

## Tech Highlights

### Performance
- **Code sync debounced at 300ms** → reduces network traffic, smooth UX
- **WebSocket single connection** → low latency chat, code, voice signaling
- **Monaco editor** → instant code highlighting (50+ languages)
- **PostgreSQL indexing** → fast problem lookup, submission queries

### Reliability
- **JWT + bcrypt** → secure auth
- **Try-catch + logging** → graceful error handling
- **WebSocket reconnect logic** → auto-rejoin on disconnect
- **DB schema migrations** → versioned updates

### Developer Experience
- **TypeScript strict mode** → zero errors, IDE autocomplete
- **Zustand stores** → lightweight state (auth, room, theme, toast)
- **Tailwind CSS** → rapid UI development
- **pnpm workspaces** → monorepo organization (shared types)
- **ESLint + Prettier** → code consistency

---

## Getting Started

1. Clone the repo
2. Install dependencies (`pnpm install`)
3. Set up PostgreSQL + Redis
4. Create `.env` file with API keys
5. Run migrations (`db/schema.sql`)
6. Start dev servers (API @ 3001, Web @ 3000)
7. Open http://localhost:3000 in browser

See **SETUP.md** for detailed instructions.

---

## Why VyroCoding?

The name **Vyro** comes from:
- **V** = Virtual
- **Y** = You
- **RO** = Real-time Online

**VyroCoding** = "Virtual You, Real-time Online Coding"

It's about bringing the **real-time collaboration** of pair programming to the cloud, making it easy for anyone to code together remotely.

---

## Statistics

- **Lines of Code:** 12,000+
- **Files:** 78 core files
- **Frontend Components:** 20+
- **Backend Routes:** 25+
- **Database Tables:** 15
- **Languages Supported:** 50+
- **Test Cases:** 1000+ seeded
- **Deployment Ready:** ✅ Vercel + Railway + Neon

---

## License

MIT — Use, fork, modify freely.

**Built by:** Gaurav  
**GitHub:** github.com/Gaurav06120714/VyroCoding  
**Started:** May 2026
