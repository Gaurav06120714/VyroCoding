import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';

// env MUST be the first import so all modules see populated process.env
import { env } from './config/env.js';

import { authRoutes }         from './routes/auth.routes.js';
import { problemsRoutes }     from './routes/problems.routes.js';
import { roomsRoutes }        from './routes/rooms.routes.js';
import { executeRoutes }      from './routes/execute.routes.js';
import { contestsRoutes, createWeeklyContest } from './routes/contests.routes.js';
import { leaderboardRoutes }  from './routes/leaderboard.routes.js';
import { usersRoutes }        from './routes/users.routes.js';
import { adminRoutes }        from './routes/admin.routes.js';
import { languagesRoutes }    from './routes/languages.routes.js';
import { aiRoutes }           from './routes/ai.routes.js';
import { bootOllamaSetup }    from './services/ollama.service.js';
import { getRedis }           from './services/redis.service.js';
import { ipRateLimit, userRateLimit, logSecurityEvent } from './plugins/rate-limit.js';

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
  /**
   * trustProxy must match PROXY_DEPTH in your infrastructure.
   * - 1 = single Nginx/ALB in front (standard)
   * - Set PROXY_DEPTH=0 in dev for direct connections
   */
  trustProxy: env.PROXY_DEPTH > 0,
});

async function bootstrap(): Promise<void> {

  // ── CORS ──────────────────────────────────────────────────────────────────
  // CORS_ORIGIN is parsed at startup by env.ts — always an array.
  // In production, set CORS_ORIGIN=https://yourapp.com (no trailing slash).
  await fastify.register(cors, {
    origin: env.NODE_ENV === 'production' ? env.CORS_ORIGIN : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── JWT ───────────────────────────────────────────────────────────────────
  // JWT_SECRET validation happens in env.ts at startup (throws in production).
  // Dev fallback: random-per-boot value so dev tokens never leak to production.
  const jwtSecret = env.JWT_SECRET || ('dev-only-unsafe:' + Math.random().toString(36));
  if (!env.JWT_SECRET) {
    fastify.log.warn('JWT_SECRET not set — tokens are signed with a random dev-only key (invalid after restart)');
  }
  await fastify.register(jwt, {
    secret: jwtSecret,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  await fastify.register(websocket);

  // ── Global rate limiting (Redis-backed, sliding window via @fastify/rate-limit)
  // This acts as the first line of defence — a broad limit before we even parse routes.
  // Per-route stricter limits are applied via preHandlers in each route file.
  // Redis store: survives restarts and works across multiple API instances.
  await fastify.register(rateLimit, {
    global: true,
    max: 120,                  // 120 requests / min / IP (2 req/sec burst)
    timeWindow: '1 minute',
    redis: getRedis(),         // persist counters in Redis (multi-instance safe)
    nameSpace: 'rl:global:',
    // Respect standard rate-limit headers so clients can implement backoff
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    keyGenerator: (request) => {
      // Key on IP — the plugin itself handles X-Forwarded-For via Fastify's
      // trustProxy setting. For extra safety we use our own extraction fn
      // as the key to be consistent with per-route limiters.
      const { extractClientIp } = require('./plugins/rate-limit.js');
      return extractClientIp(request);
    },
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Global rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s.`,
      statusCode: 429,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
    onExceeded: (request) => {
      logSecurityEvent(fastify, request as Parameters<typeof logSecurityEvent>[1], 'global_rate_limit_exceeded');
    },
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(problemsRoutes, { prefix: '/problems' });
  await fastify.register(roomsRoutes, { prefix: '/rooms' });

  // /execute — stricter limits: 10 / min / IP  +  30 / hr / user
  // Code execution is expensive (CPU, sandbox spin-up) and must be protected
  // against both anonymous floods and authenticated abuse.
  await fastify.register(async (executeInstance) => {
    executeInstance.addHook('preHandler', ipRateLimit(10, 60_000, 'execute:ip'));
    executeInstance.addHook('preHandler', userRateLimit(30, 60 * 60_000, 'execute:user'));
    await executeInstance.register(executeRoutes);
  }, { prefix: '/execute' });

  await fastify.register(contestsRoutes,    { prefix: '/contests' });
  await fastify.register(leaderboardRoutes, { prefix: '/leaderboard' });
  await fastify.register(usersRoutes,       { prefix: '/users' });

  // /admin — tight limits: 30 / min / IP
  // Admin routes deal with sensitive operations. Even authenticated admins
  // should not be able to fire 100s of requests per second.
  await fastify.register(async (adminInstance) => {
    adminInstance.addHook('preHandler', ipRateLimit(30, 60_000, 'admin:ip'));
    await adminInstance.register(adminRoutes);
  }, { prefix: '/admin' });

  await fastify.register(languagesRoutes, { prefix: '/languages' });

  // /ai — AI assistant endpoints (rate limited: 20/min/IP + 60/hr/user)
  // AI calls are expensive (GPU time on NVIDIA NIM), protect against abuse.
  await fastify.register(async (aiInstance) => {
    aiInstance.addHook('preHandler', ipRateLimit(20, 60_000, 'ai:ip'));
    aiInstance.addHook('preHandler', userRateLimit(60, 60 * 60_000, 'ai:user'));
    await aiInstance.register(aiRoutes);
  }, { prefix: '/ai' });

  // ── Health check (exempt from rate limiting) ──────────────────────────────
  fastify.get('/health', {
    config: { rateLimit: false },
  }, async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // ── 404 handler ───────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'Not Found', statusCode: 404 });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  fastify.setErrorHandler((err, request, reply) => {
    // Don't log 4xx as errors — they're client mistakes, not server problems
    if ((err.statusCode ?? 500) >= 500) {
      fastify.log.error({ err, path: request.url, method: request.method }, 'Unhandled server error');
    }
    reply
      .code(err.statusCode ?? 500)
      .send({ error: err.message ?? 'Internal Server Error', statusCode: err.statusCode ?? 500 });
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
  fastify.log.info(`API running on http://${env.API_HOST}:${env.API_PORT} [${env.NODE_ENV}]`);

  // Ollama auto-setup (non-blocking — runs in background)
  bootOllamaSetup((msg) => fastify.log.info(msg)).catch(() => {});

  // Weekly contest auto-create
  createWeeklyContest()
    .then((c) => {
      if (c) fastify.log.info(`[weekly] Created contest: ${c.title} (${c.id})`);
      else    fastify.log.info('[weekly] Contest already exists or no unused problems — skipped.');
    })
    .catch((err) => fastify.log.error({ err }, '[weekly] Failed to auto-create contest'));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
