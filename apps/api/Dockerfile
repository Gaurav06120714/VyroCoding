# =============================================================================
# VyroCoding API — Multi-stage Production Dockerfile
# Build context: repo root (monorepo — pnpm-lock.yaml is at root)
# =============================================================================

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@9

# Copy workspace manifest files only (for layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Build shared types first, then API
RUN pnpm --filter @vyro/types build || true
RUN pnpm --filter @vyro/api build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nodeuser

# Copy only production deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy compiled output
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
# DB schema needed for volume-mount at startup
COPY --from=builder /app/apps/api/src/db ./apps/api/src/db
# Shared packages
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./

USER nodeuser
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
