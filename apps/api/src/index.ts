import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';

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
  
  trustProxy: env.PROXY_DEPTH > 0,
});

async function bootstrap(): Promise<void> {

  await fastify.register(cors, {
    origin: env.NODE_ENV === 'production' ? env.CORS_ORIGIN : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const jwtSecret = env.JWT_SECRET || ('dev-only-unsafe:' + Math.random().toString(36));
  if (!env.JWT_SECRET) {
    fastify.log.warn('JWT_SECRET not set — tokens are signed with a random dev-only key (invalid after restart)');
  }
  await fastify.register(jwt, {
    secret: jwtSecret,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  await fastify.register(websocket);

  await fastify.register(rateLimit, {
    global: true,
    max: 120,                  
    timeWindow: '1 minute',
    redis: getRedis(),         
    nameSpace: 'rl:global:',
    
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    keyGenerator: (request) => {
      
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

  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(problemsRoutes, { prefix: '/problems' });
  await fastify.register(roomsRoutes, { prefix: '/rooms' });

  await fastify.register(async (executeInstance) => {
    executeInstance.addHook('preHandler', ipRateLimit(10, 60_000, 'execute:ip'));
    executeInstance.addHook('preHandler', userRateLimit(30, 60 * 60_000, 'execute:user'));
    await executeInstance.register(executeRoutes);
  }, { prefix: '/execute' });

  await fastify.register(contestsRoutes,    { prefix: '/contests' });
  await fastify.register(leaderboardRoutes, { prefix: '/leaderboard' });
  await fastify.register(usersRoutes,       { prefix: '/users' });

  await fastify.register(async (adminInstance) => {
    adminInstance.addHook('preHandler', ipRateLimit(30, 60_000, 'admin:ip'));
    await adminInstance.register(adminRoutes);
  }, { prefix: '/admin' });

  await fastify.register(languagesRoutes, { prefix: '/languages' });

  await fastify.register(async (aiInstance) => {
    aiInstance.addHook('preHandler', ipRateLimit(20, 60_000, 'ai:ip'));
    aiInstance.addHook('preHandler', userRateLimit(60, 60 * 60_000, 'ai:user'));
    await aiInstance.register(aiRoutes);
  }, { prefix: '/ai' });

  fastify.get('/health', {
    config: { rateLimit: false },
  }, async () => ({ status: 'ok', ts: new Date().toISOString() }));

  fastify.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'Not Found', statusCode: 404 });
  });

  fastify.setErrorHandler((err, request, reply) => {
    
    if ((err.statusCode ?? 500) >= 500) {
      fastify.log.error({ err, path: request.url, method: request.method }, 'Unhandled server error');
    }
    reply
      .code(err.statusCode ?? 500)
      .send({ error: err.message ?? 'Internal Server Error', statusCode: err.statusCode ?? 500 });
  });

  await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
  fastify.log.info(`API running on http://${env.API_HOST}:${env.API_PORT} [${env.NODE_ENV}]`);

  bootOllamaSetup((msg) => fastify.log.info(msg)).catch(() => {});

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
