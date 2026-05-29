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

### AI Assistant
| Feature | Detail |
|---|---|
| 💡 **Hint** | Tag-aware hints based on the problem's topics |
| 🧠 **Explain** | Step-by-step explanation of your current code |
| 🔍 **Review** | Code quality feedback and improvement suggestions |
| 🐛 **Debug** | Identifies bugs and explains the fix |
| 💬 **Chat** | Free-form AI chat about the problem (streamed via SSE) |
| 🤖 **Model Support** | NVIDIA NIM / Ollama — configurable via `AI_BASE_URL` + `AI_MODEL` env vars |

### Problems & Contests
| Feature | Detail |
|---|---|
| 📝 **103 Problems** | LeetCode-style problems across Easy / Medium / Hard |
| 📊 **Accurate Stats** | Difficulty counts (22 Easy · 53 Medium · 28 Hard) fetched from real totals |
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
| **AI Streaming** | Server-Sent Events (SSE) with CORS headers manually merged on `writeHead` |
| **State** | Zustand — auth, room, theme, toast, editor settings stores |
| **Styling** | Tailwind CSS — dark slate + cyan design system (`#0a0e17` canvas, `#00d4ff` primary) |
| **Monorepo** | pnpm workspaces (`apps/api`, `apps/web`, `packages/types`) |
| **Rate Limiting** | `@fastify/rate-limit` — 30 req/min global, 10 req/min on execute routes |

---

## 🎨 Design System

The UI uses a custom dark slate + cyan theme defined in `tailwind.config.ts`:

| Token | Value | Usage |
|---|---|---|
| `canvas` | `#0a0e17` | Page background |
| `surface1` | `#0f1623` | Cards, panels |
| `surface2` | `#161d2e` | Elevated surfaces |
| `surface3` | `#1e2740` | Hover states |
| `primary` | `#00d4ff` | Buttons, links, active states |
| `easy` | `#10b981` | Easy difficulty label |
| `medium` | `#f59e0b` | Medium difficulty label |
| `hard` | `#ef4444` | Hard difficulty label |

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
│   │       │   │   ├── AiChatDrawer.tsx      → AI assistant panel (SSE streaming)
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
│   │       ├── styles/
│   │       │   └── globals.css               → Global styles + design tokens
│   │       └── store/
│   │           ├── editor.store.ts           → Font/theme/settings (persisted)
│   │           ├── auth.store.ts
│   │           ├── room.store.ts
│   │           └── toast.store.ts
│   │
│   └── api/                          → Fastify REST + WebSocket API (port 3003)
│       └── src/
│           ├── routes/
│           │   ├── rooms.routes.ts    → WS server + all 20 event types
│           │   ├── execute.routes.ts  → /run, /run-all, /submit, /submissions
│           │   ├── problems.routes.ts → Problems CRUD + Redis cache
│           │   ├── contests.routes.ts → Contests + weekly auto-create
│           │   ├── ai.routes.ts       → AI hint/explain/review/debug/chat (SSE)
│           │   └── languages.routes.ts → 7 supported languages
│           ├── services/
│           │   ├── judge0.service.ts  → Judge0 client + wrapCode() harness
│           │   ├── ai.service.ts      → AI prompt builder + SSE streamer
│           │   ├── email.service.ts   → Resend email (password reset links)
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
│  ├── AiChatDrawer ──SSE stream──►                      │
│  └── WebRTC (P2P voice mesh)                           │
└────────────┬────────────────────────────────────────────┘
             │ WebSocket + REST + SSE
             ▼
┌─────────────────────────────────────────────────────────┐
│              Fastify API (port 3003)                     │
│                                                         │
│  ┌──────────────┐   ┌─────────────────────────────┐    │
│  │  REST Routes  │   │    WebSocket Handler         │    │
│  │  /problems    │   │    20 event types            │    │
│  │  /execute     │   │    JWT auth from ?token=     │    │
│  │  /contests    │   │    Pub/Sub subscriber        │    │
│  │  /ai (SSE)    │   │    Heartbeat / presence      │    │
│  │  /auth        │   └──────────┬──────────────────┘    │
│  └──────┬───────┘              │                         │
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

### 1. Clone & Install

```bash
git clone https://github.com/Gaurav06120714/VyroCoding.git
cd VyroCoding
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `apps/api/.env`:

```env
# Database
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding

# Redis (required for Pub/Sub, BullMQ, cache, presence)
REDIS_URL=redis://localhost:6379

# Auth — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-64-hex-char-secret

# Judge0 — free public instance, no API key needed
JUDGE0_API_URL=https://ce.judge0.com

# AI Assistant (optional — pick one)
# Option A: NVIDIA NIM
AI_BASE_URL=https://integrate.api.nvidia.com/v1
AI_API_KEY=your-nvidia-nim-key
AI_MODEL=deepseek-ai/deepseek-r1

# Option B: Ollama (local, free)
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=llama3

# Email — password reset links (dev mode logs link to console, no key needed)
RESEND_API_KEY=re_your_key   # optional — only needed for production email sending
EMAIL_FROM=VyroCoding <noreply@vyrocoding.com>

# Frontend URL — used in password reset email links
APP_URL=http://localhost:3002
```

> **Important:** `APP_URL` must match the port your web app runs on (`3002` by default). Wrong port = broken password reset links.

Edit `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3003
```

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

# 103 problems (full library)
DATABASE_URL=postgresql://vyro:vyro@localhost:5432/vyro_coding npx tsx src/db/seed-100.ts
```

### 4. Start All Services

```bash
# Terminal 1 — API (port 3003)
pnpm --filter @vyro/api run dev

# Terminal 2 — Web (port 3002)
pnpm --filter @vyro/web run dev
```

### 5. Open

| Service | URL |
|---|---|
| 🌐 Web App | http://localhost:3002 |
| ⚙️ API | http://localhost:3003 |
| ❤️ Health Check | http://localhost:3003/health |

> Redis must be running (`redis-server`) before starting the API.

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

## 🤖 AI Assistant (SSE)

The AI panel (`Hint / Explain / Review / Debug / Chat`) streams responses via **Server-Sent Events**.

### How it works

```
Browser  ──POST /ai/chat──►  Fastify
                              └── reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', ...corsHeaders })
                              └── AI SDK streamText() → pipe chunks as `data: {...}\n\n`
                              └── `data: [DONE]\n\n` on finish
```

> **CORS note:** `reply.raw.writeHead()` bypasses Fastify's CORS plugin. The route manually reads CORS headers from `reply.getHeaders()` and merges them into `writeHead` so the browser doesn't block the stream.

### Configuration

| Env Var | Default | Description |
|---|---|---|
| `AI_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible API base URL |
| `AI_API_KEY` | `ollama` | API key (use `ollama` for local Ollama) |
| `AI_MODEL` | `deepseek-ai/deepseek-r1` | Model name |

Works with any OpenAI-compatible endpoint: **Ollama**, **NVIDIA NIM**, **OpenAI**, **Together AI**, etc.

---

## 📦 Problem Library (103 Problems)

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
- [x] Resizable panels (problem / editor / output) — polling-based fix for react-resizable-panels timing bug
- [x] Code execution via Judge0 CE (free, no key)
- [x] Auto-inject stdin harness for JS/TS (transparent to user)
- [x] Per-test-case pass/fail output panel
- [x] Custom stdin input panel
- [x] Submission history with code viewer
- [x] Rate limiting (global + per-route)
- [x] Redis cache for problems list
- [x] 103 problems across all major patterns
- [x] Weekly auto-created contests (non-repeating problems)
- [x] **Phase 2: Live cursors** — see other users' positions in Monaco
- [x] **Phase 2: Presence system** — avatar stack, typing indicators, WS status
- [x] **Phase 2: Execution feed** — live ticker of who's running code
- [x] **Phase 2: Emoji reactions** — floating animated reactions
- [x] **Phase 2: Redis Pub/Sub** — horizontally scalable WS broadcasting
- [x] **Phase 2: BullMQ execution queue** — async, prioritized, retry-safe
- [x] **Phase 2: Voice chat** — WebRTC P2P mesh with speaking detection
- [x] **Phase 3: AI Assistant** — Hint / Explain / Review / Debug / Chat via SSE streaming
- [x] **Phase 3: UI redesign** — dark slate + cyan design system
- [x] **Phase 3: Password reset** — email token flow with correct APP_URL
- [x] **Phase 3: Accurate difficulty stats** — real totals fetched independently of pagination
- [ ] Yjs collaborative editing (conflict-free merging)
- [ ] Screen sharing
- [ ] Custom problem creation by users
- [ ] Company hiring portal (B2B)
- [ ] Mobile responsive layout

---

## 🐛 Known Fixes & Gotchas

| Issue | Root Cause | Fix |
|---|---|---|
| AI panel "Failed to fetch" | `reply.raw.writeHead()` bypasses Fastify CORS plugin | Manually merge `reply.getHeaders()` CORS headers into `writeHead` |
| JWT tokens invalid after restart | Random per-boot fallback secret | Set a real `JWT_SECRET` in `.env` |
| Panel layout collapses on load | `react-resizable-panels` writes deferred flex value after mount | Poll with `setInterval(applyFlex, 30ms)` for 1.5s after data loads |
| Reset password link goes to wrong port | `APP_URL` defaulted to `localhost:3000` | Set `APP_URL=http://localhost:3002` in `apps/api/.env` |
| StatsBar shows "0 Medium" | Counted from current page (50 items), not full dataset | Fetch 3 parallel API calls with `pageSize: 1` to get real totals |

---

## 📄 License

MIT — built by Gaurav
