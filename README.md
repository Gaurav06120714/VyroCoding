# ⚡ VyroCoding

> **LeetCode + Discord + VS Code — in one multiplayer platform.**

A **real-time multiplayer coding platform** where students and professionals can solve coding problems together, compete in contests, chat live, and interview via WebRTC voice — all in the browser.

---

## 🎯 Core Features

| Feature | What It Does |
|---|---|
| 🧑‍💻 **Multiplayer Rooms** | Code together with real-time code sync (debounced 300ms) |
| 💬 **Live Chat** | Instant messaging synced over WebSocket in rooms |
| 🎤 **Voice Chat** | WebRTC peer-to-peer audio with speaking detection |
| 📊 **Room Scoreboard** | Live rankings showing who solved the problem (by time) |
| ⚙️ **Code Execution** | Run code against test cases (50+ languages via Judge0) |
| 🏆 **Contests** | Timed competitions with countdown + join button |
| 📈 **Global Leaderboard** | Rankings by rating + problems solved |
| 👤 **User Profiles** | View stats, submission history, badges |
| ⏱️ **Room Timer** | Host sets 15/30/45/60 min countdown (auto-ends room) |
| 🌙 **Dark/Light Mode** | Toggle theme with persistence |
| 🚨 **Admin Panel** | Create/edit/delete problems, manage rooms |
| 📝 **Problem Library** | 100+ LeetCode-style problems with test cases |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React, TypeScript, Tailwind CSS v4 |
| **Backend** | Node.js + Fastify 4, TypeScript |
| **Database** | PostgreSQL 14+ (15 tables, migrations in schema.sql) |
| **Real-time** | WebSocket (@fastify/websocket) for chat, code sync, voice signaling |
| **Code Editor** | Monaco Editor (VS Code in browser) |
| **Code Execution** | Judge0 API (RapidAPI or self-hosted) |
| **Voice** | WebRTC RTCPeerConnection + Web Audio API (speaking detection) |
| **Auth** | JWT (bcryptjs + signed tokens) |
| **State** | Zustand (auth, room, theme, toast stores) |
| **Styling** | Tailwind CSS v4 + CSS glassmorphism (backdrop-filter) |
| **Monorepo** | pnpm workspaces (apps/api, apps/web, packages/types) |

---

## 📁 Project Structure

```
VyroCoding/
├── apps/
│   ├── web/          → Next.js 15 frontend         (port 3002)
│   ├── api/          → Fastify REST API             (port 3001)
│   └── collab/       → Yjs WebSocket server         (port 1234)
├── packages/
│   └── types/        → Shared TypeScript types
├── .env.example
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- [Vyro Browser](https://github.com/Gaurav06120714/VyroBrowser) *(optional — auto-opens the app)*

### 1. Clone & Install

**macOS**
```bash
git clone https://github.com/Gaurav06120714/VyroCoding.git
cd VyroCoding
pnpm install
```

**Windows**
```powershell
git clone https://github.com/Gaurav06120714/VyroCoding.git
cd VyroCoding
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234
```

### 3. Database Setup

```bash
# Create DB
createdb vyro_coding

# Run schema
psql vyro_coding < apps/api/src/db/schema.sql

# Grant permissions
psql vyro_coding -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vyro; GRANT ALL ON SCHEMA public TO vyro; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vyro;"

# Seed 10 problems
cd apps/api
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding npx tsx src/db/seed.ts
```

### 4. Start All Services

**macOS**
```bash
# All services + auto-open in Vyro Browser
npm run dev:vyro

# Or manually:
# Terminal 1 — API
cd apps/api && DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding npm run dev

# Terminal 2 — Collab server
cd apps/collab && npm run dev

# Terminal 3 — Web
cd apps/web && PORT=3002 npm run dev
```

**Windows**
```powershell
# All services + auto-open in Vyro Browser
npm run dev:vyro

# Or manually in 3 separate PowerShell windows:
# Window 1 — API
cd apps\api; $env:DATABASE_URL="postgresql://vyro:vyro@localhost:5432/vyro_coding"; npm run dev

# Window 2 — Collab
cd apps\collab; npm run dev

# Window 3 — Web
cd apps\web; $env:PORT=3002; npm run dev
```

### 5. Open

| Service | URL |
|---|---|
| 🌐 Web App | http://localhost:3002 |
| ⚙️ API | http://localhost:3001 |
| 🔄 Collab (Yjs WS) | ws://localhost:1234 |

> 💡 `npm run dev:vyro` starts all services and automatically opens http://localhost:3000 in Vyro Browser if installed.

---

## 🔑 Judge0 Setup

**Option A — RapidAPI (easiest, free tier available):**
1. Sign up at https://rapidapi.com/judge0-official/api/judge0-ce
2. Get your API key
3. Set `JUDGE0_API_URL` and `JUDGE0_API_KEY` in `.env`

**Option B — Self-hosted on Railway (~$10/month):**
1. Fork https://github.com/judge0/judge0
2. Deploy on Railway
3. Point `JUDGE0_API_URL` to your Railway URL

---

## 🌐 Supported Languages

| Language | Judge0 ID |
|---|---|
| JavaScript (Node 18) | 93 |
| TypeScript | 74 |
| Python 3 | 71 |
| C++ (GCC 9.2) | 54 |
| Java | 62 |
| Go | 95 |
| Rust | 73 |

---

## 🏗️ Architecture

```
[Browser]
    │
    ├── HTTPS ──────────► [Next.js :3002]
    │                          │
    │                     REST API calls
    │                          │
    ├── REST ───────────► [Fastify API :3001]
    │                          ├── PostgreSQL (users, problems, submissions)
    │                          ├── Redis (leaderboard, cache)
    │                          └── Judge0 (code execution)
    │
    ├── WebSocket ──────► [Yjs Collab :1234] (real-time code sync)
    │
    └── WebRTC ─────────► [LiveKit SFU] (voice + screen share)
```

---

## 📦 Seeded Problems

| # | Title | Difficulty |
|---|---|---|
| 1 | Two Sum | 🟢 Easy |
| 2 | Valid Parentheses | 🟢 Easy |
| 3 | Merge Two Sorted Lists | 🟢 Easy |
| 4 | Maximum Subarray | 🟡 Medium |
| 5 | Longest Substring Without Repeating Characters | 🟡 Medium |
| 6 | 3Sum | 🟡 Medium |
| 7 | Binary Tree Level Order Traversal | 🟡 Medium |
| 8 | Word Search | 🟡 Medium |
| 9 | Merge K Sorted Lists | 🔴 Hard |
| 10 | Trapping Rain Water | 🔴 Hard |

---

## 🗺️ Roadmap

- [x] Real-time collaborative editor (Yjs)
- [x] Code execution (Judge0)
- [x] Problem library with difficulty filters
- [x] Coding rooms with live chat
- [x] Contests + leaderboard
- [ ] AI Interviewer (Claude API)
- [ ] Screen sharing (LiveKit)
- [ ] Voice chat in rooms
- [ ] Custom problem creation
- [ ] Company hiring portal (B2B)
- [ ] Mobile responsive UI

---

## 📄 License

MIT — built by Gaurav
