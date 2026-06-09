import crypto from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getRedis } from '../services/redis.service.js';

import { env } from '../config/env.js';

const PROXY_DEPTH = env.PROXY_DEPTH;
const IP_HASH_SALT = env.IP_HASH_SALT;

const SLIDING_WINDOW_LUA = `
local key      = KEYS[1]
local now_ms   = tonumber(ARGV[1])
local win_ms   = tonumber(ARGV[2])
local limit    = tonumber(ARGV[3])
local member   = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now_ms - win_ms)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now_ms, member)
  redis.call('PEXPIRE', key, win_ms)
  return count + 1
end
return -1
`;

export function extractClientIp(request: FastifyRequest): string {
  const xffHeader = request.headers['x-forwarded-for'];
  const xri = request.headers['x-real-ip'];

  if (xffHeader) {
    const raw = Array.isArray(xffHeader) ? xffHeader.join(',') : xffHeader;
    const ips = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normaliseIp);

    const clientIdx = ips.length - PROXY_DEPTH - 1;
    if (clientIdx >= 0 && ips[clientIdx]) return ips[clientIdx];
    if (ips.length > 0) return ips[0]; 
  }

  if (typeof xri === 'string') return normaliseIp(xri.trim());

  return normaliseIp(request.ip ?? '127.0.0.1');
}

function normaliseIp(ip: string): string {
  
  const clean = ip.replace(/%.*$/, '').toLowerCase().trim();
  
  if (/^[\d.]+$/.test(clean) || /^[0-9a-f:]+$/.test(clean)) return clean;
  return '0.0.0.0'; 
}

function hashForLog(value: string): string {
  return crypto
    .createHmac('sha256', IP_HASH_SALT)
    .update(value)
    .digest('hex')
    .slice(0, 16); 
}

export function logSecurityEvent(
  fastify: FastifyInstance,
  request: FastifyRequest,
  event: string,
  extra?: Record<string, unknown>,
): void {
  const ip = extractClientIp(request);
  fastify.log.warn(
    {
      security_event: event,
      
      ip_hash: hashForLog(ip),
      method: request.method,
      
      path: request.url.split('?')[0],
      
      user_agent: (request.headers['user-agent'] ?? 'none').slice(0, 250),
      ...extra,
    },
    `[security] ${event}`,
  );
}

interface SlidingWindowResult {
  allowed: boolean;
  
  count: number;
  
  retryAfterMs: number;
}

async function slidingWindowCheck(
  key: string,
  limit: number,
  windowMs: number,
): Promise<SlidingWindowResult> {
  const redis = getRedis();
  const nowMs = Date.now();
  
  const member = `${nowMs}:${crypto.randomBytes(6).toString('hex')}`;

  try {
    const result = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      `rl:sw:${key}`,
      String(nowMs),
      String(windowMs),
      String(limit),
      member,
    )) as number;

    if (result === -1) {
      
      const oldest = await redis.zrange(`rl:sw:${key}`, 0, 0, 'WITHSCORES');
      const oldestMs = oldest.length >= 2 ? parseFloat(oldest[1]) : nowMs;
      return {
        allowed: false,
        count: limit,
        retryAfterMs: Math.max(0, oldestMs + windowMs - nowMs),
      };
    }

    return { allowed: true, count: result, retryAfterMs: 0 };
  } catch (err) {
    
    console.error('[rate-limit] Redis error (failing open):', (err as Error).message);
    return { allowed: true, count: 0, retryAfterMs: 0 };
  }
}

async function getLockoutTtl(key: string): Promise<number> {
  
  const redis = getRedis();
  try {
    const ttl = await redis.ttl(`rl:lock:${key}`);
    return ttl > 0 ? ttl : 0;
  } catch {
    return 0;
  }
}

export async function recordAuthFailure(lockKey: string): Promise<void> {
  const redis = getRedis();
  const failCountKey = `rl:fails:${lockKey}`;
  try {
    const fails = await redis.incr(failCountKey);
    
    await redis.expire(failCountKey, 86_400);

    let lockTtl = 0;
    if (fails >= 20) lockTtl = 86_400; 
    else if (fails >= 10) lockTtl = 3_600; 
    else if (fails >= 5) lockTtl = 900;   

    if (lockTtl > 0) {
      
      await redis.set(`rl:lock:${lockKey}`, '1', 'EX', lockTtl, 'NX');
    }
  } catch {
    
  }
}

export async function clearAuthFailures(lockKey: string): Promise<void> {
  const redis = getRedis();
  try {
    await redis.del(`rl:fails:${lockKey}`, `rl:lock:${lockKey}`);
  } catch {
    
  }
}

function ipLockKey(ip: string): string {
  
  return `ip:${hashForLog(ip)}`;
}

function emailLockKey(email: string): string {
  return `email:${hashForLog(email.toLowerCase())}`;
}

const KNOWN_SCANNER_PATTERNS = [
  /sqlmap/i, /nikto/i, /dirbuster/i, /masscan/i, /nmap/i,
  /hydra/i, /medusa/i, /nessus/i, /metasploit/i, /burpsuite/i,
  /havij/i, /zgrab/i, /acunetix/i, /appscan/i, /openvas/i,
  /gobuster/i, /wfuzz/i, /dirb\b/i, /nuclei/i, /feroxbuster/i,
];

function isScannerUserAgent(ua: string): boolean {
  return KNOWN_SCANNER_PATTERNS.some((re) => re.test(ua));
}

function sendRateLimited(
  reply: FastifyReply,
  message: string,
  retryAfterMs: number,
  limit?: number,
): void {
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  reply
    .code(429)
    .header('Retry-After', String(retryAfterSec))
    .header('X-RateLimit-Limit', String(limit ?? ''))
    .header('X-RateLimit-Remaining', '0')
    .header(
      'X-RateLimit-Reset',
      String(Math.floor((Date.now() + retryAfterMs) / 1000)),
    )
    .send({
      error: 'Too Many Requests',
      message,
      statusCode: 429,
      retryAfter: retryAfterSec,
    });
}

export function ipRateLimit(limit: number, windowMs: number, prefix: string) {
  return async function preHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ip = extractClientIp(request);
    const result = await slidingWindowCheck(`${prefix}:${hashForLog(ip)}`, limit, windowMs);

    if (!result.allowed) {
      logSecurityEvent(request.server, request, 'rate_limit_exceeded', { prefix });
      sendRateLimited(
        reply,
        `Rate limit exceeded. Please wait ${Math.ceil(result.retryAfterMs / 1000)} seconds.`,
        result.retryAfterMs,
        limit,
      );
    }
  };
}

export function userRateLimit(limit: number, windowMs: number, prefix: string) {
  return async function preHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = request.user as { userId?: string; sub?: string } | undefined;
    const userId = user?.userId ?? user?.sub;
    if (!userId) return; 

    const result = await slidingWindowCheck(`${prefix}:user:${userId}`, limit, windowMs);
    if (!result.allowed) {
      logSecurityEvent(request.server, request, 'user_rate_limit_exceeded', { prefix });
      sendRateLimited(
        reply,
        'You have exceeded the request limit for this operation. Please slow down.',
        result.retryAfterMs,
        limit,
      );
    }
  };
}

export function botCheck() {
  return async function preHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ua = request.headers['user-agent'] ?? '';

    if (!ua) {
      logSecurityEvent(request.server, request, 'missing_user_agent');
      reply.code(400).send({ error: 'Bad Request', message: 'User-Agent header required.', statusCode: 400 });
      return;
    }

    if (isScannerUserAgent(ua)) {
      logSecurityEvent(request.server, request, 'scanner_ua_blocked');
      reply.code(403).send({ error: 'Forbidden', statusCode: 403 });
    }
  };
}

export function loginRateLimit() {
  return async function preHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    
    const ua = request.headers['user-agent'] ?? '';
    if (!ua || isScannerUserAgent(ua)) {
      logSecurityEvent(request.server, request, 'bot_blocked_on_login');
      reply.code(403).send({ error: 'Forbidden', statusCode: 403 });
      return;
    }

    const ip = extractClientIp(request);
    const ipKey = ipLockKey(ip);

    const ipLockTtl = await getLockoutTtl(ipKey);
    if (ipLockTtl > 0) {
      logSecurityEvent(request.server, request, 'login_ip_locked_out');
      sendRateLimited(
        reply,
        `Too many failed attempts from this location. Try again in ${Math.ceil(ipLockTtl / 60)} minute(s).`,
        ipLockTtl * 1000,
      );
      return;
    }

    const ipResult = await slidingWindowCheck(`login:ip:${hashForLog(ip)}`, 5, 15 * 60_000);
    if (!ipResult.allowed) {
      logSecurityEvent(request.server, request, 'login_rate_limit_ip');
      await recordAuthFailure(ipKey);
      sendRateLimited(
        reply,
        'Too many login attempts. Please wait before trying again.',
        ipResult.retryAfterMs,
        5,
      );
      return;
    }

    const body = request.body as { email?: unknown } | undefined;
    if (typeof body?.email === 'string' && body.email.length > 0) {
      const emailKey = emailLockKey(body.email);

      const emailLockTtl = await getLockoutTtl(emailKey);
      if (emailLockTtl > 0) {
        logSecurityEvent(request.server, request, 'login_account_locked_out');
        sendRateLimited(
          reply,
          'This account is temporarily locked. Please try again later or reset your password.',
          emailLockTtl * 1000,
        );
        return;
      }

      const emailResult = await slidingWindowCheck(
        `login:email:${hashForLog(body.email.toLowerCase())}`,
        3,
        15 * 60_000,
      );
      if (!emailResult.allowed) {
        logSecurityEvent(request.server, request, 'login_rate_limit_email');
        await recordAuthFailure(emailKey);
        sendRateLimited(
          reply,
          'Too many attempts for this account. Please wait before trying again.',
          emailResult.retryAfterMs,
          3,
        );
        return;
      }
    }
  };
}

export async function recordLoginFailure(
  request: FastifyRequest,
  email?: string,
): Promise<void> {
  const ip = extractClientIp(request);
  await recordAuthFailure(ipLockKey(ip));
  if (email) await recordAuthFailure(emailLockKey(email));
}

export async function recordLoginSuccess(
  request: FastifyRequest,
  email: string,
): Promise<void> {
  const ip = extractClientIp(request);
  await clearAuthFailures(ipLockKey(ip));
  await clearAuthFailures(emailLockKey(email));
}
