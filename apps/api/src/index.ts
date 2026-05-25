import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';

import { authRoutes } from './routes/auth.routes.js';
import { problemsRoutes } from './routes/problems.routes.js';
import { roomsRoutes } from './routes/rooms.routes.js';
import { executeRoutes } from './routes/execute.routes.js';
import { contestsRoutes, createWeeklyContest } from './routes/contests.routes.js';
import { leaderboardRoutes } from './routes/leaderboard.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { languagesRoutes } from './routes/languages.routes.js';

dotenv.config();

const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

async function bootstrap(): Promise<void> {
  // Plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'fallback-secret-change-me',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
  });

  await fastify.register(websocket);

  // Global rate limiting: 30 requests per minute per IP
  await fastify.register(rateLimit, {
    global: true,
    max: 30,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
      statusCode: 429,
    }),
  });

  // Routes
  await fastify.register(authRoutes,      { prefix: '/auth' });
  await fastify.register(problemsRoutes,  { prefix: '/problems' });
  await fastify.register(roomsRoutes,     { prefix: '/rooms' });
  // Execute routes with stricter rate limit: 10 per minute
  await fastify.register(async (executeInstance) => {
    await executeInstance.register(rateLimit, {
      max: 10,
      timeWindow: '1 minute',
      errorResponseBuilder: (_request, context) => ({
        error: 'Too Many Requests',
        message: `Execute rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)} seconds.`,
        statusCode: 429,
      }),
    });
    await executeInstance.register(executeRoutes);
  }, { prefix: '/execute' });
  await fastify.register(contestsRoutes,  { prefix: '/contests' });
  await fastify.register(leaderboardRoutes, { prefix: '/leaderboard' });
  await fastify.register(usersRoutes,     { prefix: '/users' });
  await fastify.register(adminRoutes,     { prefix: '/admin' });
  await fastify.register(languagesRoutes, { prefix: '/languages' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Start
  const port = parseInt(process.env.API_PORT ?? '3001', 10);
  const host = process.env.API_HOST ?? '0.0.0.0';

  await fastify.listen({ port, host });
  console.log(`API running on http://${host}:${port}`);

  // Auto-create next Monday's weekly contest on every startup
  createWeeklyContest()
    .then((c) => {
      if (c) console.log(`[weekly] Created contest: ${c.title} (${c.id})`);
      else    console.log('[weekly] Contest already exists or no unused problems — skipped.');
    })
    .catch((err) => console.error('[weekly] Failed to auto-create contest:', err));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
