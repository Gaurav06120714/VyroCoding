# ⚡ VyroCoding

> **LeetCode + Discord + VS Code — in one multiplayer platform.**

A **real-time multiplayer coding platform** where students and professionals solve coding problems together, compete in timed contests, chat live, see each other's cursors, and interview over WebRTC voice — all in the browser. No extensions. No installs. Just a URL.

---

## 🎯 Features

### Core Platform
| Feature | Detail |
|---|---|
| 🧑‍💻 **Multiplayer Rooms** | Code together with live code sync (debounced 250ms over WebSocket) |
| 👁️ **Live Cursors** | See every participant's cursor position in the editor in real time |
| 🟢 **Presence System** | Avatar stack with online indicators, typing badges, language pills |
| ⚡ **Execution Feed** | Live ticker showing when room members run code + their result |
| 😄 **Reactions** | 8-emoji picker, floating reactions with spring animation |
| 💬 **Live Chat** | Instant messaging synced over WebSocket in every room |
| 🎤 **Voice Chat** | WebRTC P2P audio with Web Audio API speaking detection |
| 📊 **Room Scoreboard** | Live rankings showing who solved the problem and when |
| ⏱️ **Room Timer** | Host sets 15/30/45/60 min countdown (auto-ends room on expiry) |

### Code Editor
| Feature | Detail |
|---|---|
| 🖥️ **Monaco Editor** | VS Code in the browser — same engine, same keybindings |
| 🔤 **Font Settings** | Size (10–22px), tab size (2/4), word wrap, minimap toggle |
| 🌙 **Theme Toggle** | Dark / Light with persistence via Zustand store |
| 💾 **Auto-Save** | Code saved to localStorage per problem per language (300ms debounce) |
| ⌨️ **Keyboard Shortcuts** | `Ctrl+Enter` → Run, `Ctrl+Shift+Enter` → Submit |
| 📐 **Resizable Panels** | Drag to resize problem / editor / output panels |
| 📝 **Custom Stdin** | Collapsible input panel for testing with your own input |

### Code Execution
| Feature | Detail |
|---|---|
| ▶️ **Run** | Runs against all visible test cases — shows per-case pass/fail |
| ✅ **Submit** | Runs all test cases, stores result, updates stats |
| 📋 **Test Cases Panel** | Expandable cards: Input → Expected → Your Output |
| 📺 **Output Panel** | stdout (green), stderr (red), compile output (orange), runtime + memory |
| 🔄 **Async Queue** | BullMQ execution queue backed by Redis — room submissions get priority |
| 🌐 **Free Judge0** | Uses `ce.judge0.com` — no API key needed, no credit card |

### Problems & Contests
| Feature | Detail |
|---|---|
| 📝 **100 Problems** | LeetCode-style problems across Easy / Medium / Hard |
| 💡 **Smart Hints** | Tag-based hints (hash-map, two-pointers, dp, sliding-window, etc.) |
| 📜 **Submissions** | Full history with code viewer (read-only Monaco modal) |
| 🏆 **Contests** | Timed competitions with countdown, auto-start, auto-end |
| 📅 **Weekly Contests** | Auto-created each week with non-repeating problem picks |
| 📈 **Leaderboard** | Global rankings by rating + problems solved |
| 👤 **Profiles** | Stats, submission history, badges per user |
| 🚨 **Admin Panel** | Create / edit / delete problems, manage rooms and contests |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS |
| **Backend** | Node.js 20 + Fastify 4, TypeScript |
| **Database** | PostgreSQL 16 (schema.sql, 15 tables) |
| **Cache** | Redis 7 — problems list (60s TTL), room state (4h TTL), presence (30s TTL) |
| **Real-time** | WebSocket (`@fastify/websocket`) — code sync, cursors, presence, chat, signaling |
| **Pub/Sub** | Redis Pub/Sub — scalable broadcast across multiple API instances |
| **Job Queue** | BullMQ (Redis) — async code execution with concurrency 5 |
| **Code Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Code Execution** | Judge0 CE (`ce.judge0.com`) — free public instance, no key needed |
| **Voice** | WebRTC `RTCPeerConnection` + Web Audio API (speaking detection via AnalyserNode) |
| **Auth** | JWT (bcryptjs + signed tokens, 7-day expiry) |
| **State** | Zustand — auth, room, theme, toast, editor settings stores |
| **Styling** | Tailwind CSS + dark-first design system |
| **Monorepo** | pnpm workspaces (`apps/api`, `apps/web`, `packages/types`) |
| **Rate Limiting** | `@fastify/rate-limit` — 30 req/min global, 10 req/min on execute routes |

---

## 📁 Project Structure

```
VyroCoding/
├── apps/
│   ├── web/                          → Next.js 15 frontend (port 3002)
│   │   └── src/
│   │       ├── app/(app)/
│   │       │   ├── problems/[slug]/  → Problem solver page (resizable panels)
│   │       │   ├── rooms/[id]/       → Multiplayer room (live cursors + presence)
│   │       │   ├── contests/         → Contest list + join
│   │       │   └── dashboard/        → Stats + recent activity
│   │       ├── components/
│   │       │   ├── editor/
│   │       │   │   ├── CodeEditor.tsx        → Monaco + cursor broadcast
│   │       │   │   ├── EditorToolbar.tsx     → Font/theme/wrap settings
│   │       │   │   ├── OutputPanel.tsx       → Output + Test Cases tabs
│   │       │   │   ├── SubmissionsPanel.tsx  → History + code viewer
│   │       │   │   └── CustomInput.tsx       → Custom stdin panel
│   │       │   └── room/
│   │       │       ├── PresenceBar.tsx       → Avatar stack + WS status
│   │       │       ├── LiveCursors.tsx       → Cursor overlay on Monaco
│   │       │       ├── ExecutionFeed.tsx     → Live "X is running..." ticker
│   │       │       ├── ReactionOverlay.tsx   → Emoji picker + floating reactions
│   │       │       ├── RoomChat.tsx          → Chat panel
│   │       │       ├── RoomUsers.tsx         → Participant list
│   │       │       ├── RoomHeader.tsx        → Room bar + voice controls + timer
│   │       │       └── RoomScoreboard.tsx    → Live rankings
│   │       ├── hooks/
│   │       │   ├── useRoomWebSocket.ts       → Phase 2 WS hook (auto-reconnect, all events)
│   │       │   └── useVoiceChat.ts           → WebRTC voice (P2P mesh)
│   │       └── store/
│   │           ├── editor.store.ts           → Font/theme/settings (persisted)
│   │           ├── auth.store.ts
│   │           ├── room.store.ts
│   │           └── toast.store.ts
│   │
│   └── api/                          → Fastify REST + WebSocket API (port 3003)
│       └── src/
│           ├── routes/
│           │   ├── rooms.routes.ts   → WS server + all 20 event types
│           │   ├── execute.routes.ts → /run, /run-all, /submit, /submissions
│           │   ├── problems.routes.ts → Problems CRUD + Redis cache
│           │   ├── contests.routes.ts → Contests + weekly auto-create
│           │   └── languages.routes.ts → 7 supported languages
│           ├── services/
│           │   ├── judge0.service.ts  → Judge0 client + wrapCode() harness
│           │   ├── pubsub.service.ts  → Redis Pub/Sub + room state + presence
│           │   ├── execution.queue.ts → BullMQ worker (priority queue)
│           │   └── redis.service.ts   → Redis singleton
│           └── db/
│               ├── schema.sql         → Full database schema
│               ├── seed.ts            → 10 core problems
│               └── seed-100.ts        → 100 problems seeder
│
└── packages/
    └── types/        → Shared TypeScript types (Language, Problem, ExecutionResult…)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                           │
│                                                         │
│  Next.js 15 App (port 3002)                            │
│  ├── Monaco Editor  ──cursor broadcast──►              │
│  ├── useRoomWebSocket hook                              │
│  │    └── auto-reconnect + heartbeat (10s)             │
│  └── WebRTC (P2P voice mesh)                           │
└────────────┬────────────────────────────────────────────┘
             │ WebSocket + REST
             ▼
┌─────────────────────────────────────────────────────────┐
│              Fastify API (port 3003)                     │
│                                                         │
│  ┌──────────────┐   ┌─────────────────────────────┐    │
│  │  REST Routes  │   │    WebSocket Handler         │    │
│  │  /problems    │   │    20 event types            │    │
│  │  /execute     │   │    JWT auth from ?token=     │    │
│  │  /contests    │   │    Pub/Sub subscriber        │    │
│  │  /languages   │   │    Heartbeat / presence      │    │
│  └──────┬───────┘   └──────────┬──────────────────┘    │
│         │                      │                         │
└─────────┼──────────────────────┼─────────────────────────┘
          │                      │
          ▼                      ▼
┌─────────────────┐   ┌──────────────────────────────────┐
│   PostgreSQL    │   │              Redis 7              │
│                 │   │                                   │
│  users          │   │  Pub/Sub: room:{id}:events        │
│  problems       │   │  BullMQ: code-execution queue     │
│  submissions    │   │  Cache:  problems:list:* (60s)    │
│  rooms          │   │  State:  room:{id}:state (4h)     │
│  contests       │   │  Presence: room:{id}:presence:*   │
│  ...            │   │           (30s TTL + heartbeat)   │
└─────────────────┘   └──────────────────────────────────┘
                                  │
                      ┌───────────┘
                      ▼
             ┌─────────────────┐
             │  Judge0 CE      │
             │  ce.judge0.com  │
             │  (free, no key) │
             │  7 languages    │
             └─────────────────┘
```

**Scalability:** Redis Pub/Sub means any number of API instances can handle the same room — messages published on one instance are received and forwarded by all others. BullMQ ensures code execution jobs survive restarts and are processed exactly once.

---

## ⚙️ Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- [Vyro Browser](https://github.com/Gaurav06120714/VyroBrowser) *(optional — auto-opens the app)*

### 1. Clone & Install

**macOS / Linux**
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
# Database
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding

# Redis (required for Pub/Sub, BullMQ, cache, presence)
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key-min-32-chars

# Judge0 — free public instance, no API key needed
JUDGE0_API_URL=https://ce.judge0.com

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3003
```

> No Judge0 API key required. `ce.judge0.com` is the free public instance.

### 3. Database Setup

```bash
# Create database
createdb vyro_coding

# Run schema (creates all 15 tables + indexes)
psql vyro_coding < apps/api/src/db/schema.sql

# Grant permissions
psql vyro_coding -c "
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vyro;
  GRANT ALL ON SCHEMA public TO vyro;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vyro;
"

# Seed problems (choose one)
cd apps/api

# 10 core problems (quick start)
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding npx tsx src/db/seed.ts

# 100 problems (full library)
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding npx tsx src/db/seed-100.ts
```

### 4. Start All Services

**macOS (all-in-one)**
```bash
npm run dev:vyro
# Starts API + Web, auto-opens in Vyro Browser
```

**macOS (manual, 2 terminals)**
```bash
# Terminal 1 — API + BullMQ worker + Redis Pub/Sub
cd apps/api && npm run dev

# Terminal 2 — Next.js frontend
cd apps/web && PORT=3002 npm run dev
```

**Windows (manual, 2 PowerShell windows)**
```powershell
# Window 1 — API
cd apps\api; $env:DATABASE_URL="postgresql://vyro:vyro@localhost:5432/vyro_coding"; npm run dev

# Window 2 — Web
cd apps\web; $env:PORT=3002; npm run dev
```

### 5. Open

| Service | URL |
|---|---|
| 🌐 Web App | http://localhost:3002 |
| ⚙️ API | http://localhost:3003 |

> Redis must be running (`redis-server`) before starting the API — it powers the execution queue, presence, Pub/Sub, and cache.

---

## 🌐 Supported Languages

| Language | Judge0 ID | Monaco ID |
|---|---|---|
| JavaScript (Node 18) | 93 | `javascript` |
| TypeScript | 74 | `typescript` |
| Python 3 | 71 | `python` |
| C++ (GCC 9.2) | 54 | `cpp` |
| Java | 62 | `java` |
| Go | 60 | `go` |
| Rust | 73 | `rust` |

---

## 🔄 WebSocket Events

The room WebSocket server handles 20 event types:

| Event | Flow | Purpose |
|---|---|---|
| `code-update` | Client → Room | Live code sync (debounced 250ms) |
| `cursor-update` | Client → Room | Cursor line/column + color for live cursors |
| `typing` | Client → Room | Typing indicator badge on avatars |
| `chat` | Client → Room | Chat message |
| `ping` | Client → Server | Heartbeat — refreshes Redis presence TTL |
| `pong` | Server → Client | Heartbeat ack |
| `reaction` | Client → Room | Emoji reaction (floats + auto-fades) |
| `language-change` | Client → Room | Notify others of language switch |
| `voice-join/leave/mute` | Client → Room | Voice presence updates |
| `voice-offer/answer/ice` | Client → Target | WebRTC P2P signaling (targeted by userId) |
| `execution-start` | Queue → Room | Someone started running code |
| `execution-complete` | Queue → Room | Execution result + test pass/fail counts |
| `submission-result` | Server → Room | Accepted/failed submission broadcast |
| `problem-changed` | Server → Room | Host switched the active problem |
| `timer-start` | Server → Room | Contest countdown started |
| `presence-sync` | Server → Client | Full presence list sent on join |
| `user-joined` | Server → Room | New participant connected |
| `user-left` | Server → Room | Participant disconnected |

---

## 📦 Problem Library (100 Problems)

Covers all major patterns:

| Pattern | Examples |
|---|---|
| 🗺️ Hash Map / Set | Two Sum, Group Anagrams, LRU Cache |
| 👉 Two Pointers | 3Sum, Container With Most Water, Trapping Rain Water |
| 🪟 Sliding Window | Longest Substring, Min Window Substring, Sliding Window Max |
| 🔍 Binary Search | Search in Rotated Array, Find Peak Element, Koko Eating Bananas |
| 📚 Stack / Queue | Valid Parentheses, Daily Temperatures, Min Stack |
| 🌳 Trees | Level Order Traversal, Max Path Sum, Serialize/Deserialize |
| 📊 Dynamic Programming | Climbing Stairs, Coin Change, Longest Increasing Subsequence |
| 🔗 Linked Lists | Reverse, Cycle Detection, Merge K Sorted |
| 🕸️ Graphs | Number of Islands, Course Schedule, Word Ladder |
| ↩️ Backtracking | Permutations, N-Queens, Word Search |

---

## 🗺️ Roadmap

- [x] Real-time code sync over WebSocket
- [x] Monaco Editor with font/theme/settings persistence
- [x] Resizable panels (problem / editor / output)
- [x] Code execution via Judge0 CE (free, no key)
- [x] Auto-inject stdin harness for JS/TS (transparent to user)
- [x] Per-test-case pass/fail output panel
- [x] Custom stdin input panel
- [x] Submission history with code viewer
- [x] Rate limiting (global + per-route)
- [x] Redis cache for problems list
- [x] 100 problems across all major patterns
- [x] Weekly auto-created contests (non-repeating problems)
- [x] **Phase 2: Live cursors** — see other users' positions in Monaco
- [x] **Phase 2: Presence system** — avatar stack, typing indicators, WS status
- [x] **Phase 2: Execution feed** — live ticker of who's running code
- [x] **Phase 2: Emoji reactions** — floating animated reactions
- [x] **Phase 2: Redis Pub/Sub** — horizontally scalable WS broadcasting
- [x] **Phase 2: BullMQ execution queue** — async, prioritized, retry-safe
- [x] **Phase 2: Voice chat** — WebRTC P2P mesh with speaking detection
- [x] Smart hints panel (tag-based contextual hints)
- [ ] AI Interviewer (Claude API integration)
- [ ] Yjs collaborative editing (conflict-free merging)
- [ ] Screen sharing
- [ ] Custom problem creation by users
- [ ] Company hiring portal (B2B)
- [ ] Mobile responsive layout

---

## 📄 License

MIT — built by Gaurav
