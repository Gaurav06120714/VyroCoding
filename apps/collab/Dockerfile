# =============================================================================
# VyroCoding Collab — Multi-stage Production Dockerfile (Y.js WebSocket)
# Build context: repo root
# =============================================================================

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/collab/package.json ./apps/collab/

RUN pnpm install --frozen-lockfile

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/collab/node_modules ./apps/collab/node_modules
COPY . .

RUN pnpm --filter @vyro/collab build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodeuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/collab/node_modules ./apps/collab/node_modules
COPY --from=builder /app/apps/collab/dist ./apps/collab/dist
COPY --from=builder /app/apps/collab/package.json ./apps/collab/
COPY --from=builder /app/package.json ./

USER nodeuser
EXPOSE 1234

# Health: HTTP server returns { status: 'ok' } at /
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:1234/ || exit 1

CMD ["node", "apps/collab/dist/index.js"]
