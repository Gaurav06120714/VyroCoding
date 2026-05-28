/**
 * Production-grade rate limiting & abuse prevention plugin for Fastify.
 *
 * Design decisions:
 *  - Sliding window (sorted-set Lua script) — far more accurate than fixed-window
 *    counters which allow 2× the limit at window boundaries.
 *  - Redis-backed — survives process restarts and works across multiple API
 *    instances behind a load balancer.
 *  - Fail-open — if Redis is unreachable, requests are let through with a
 *    warning log. Better to serve traffic than to 429 everyone during a Redis
 *    blip; use Redis Sentinel/Cluster for HA in production.
 *  - Progressive lockouts — failed auth accumulates a failure counter that
 *    triggers increasing bans: 5 fails → 15 min, 10 → 1 hr, 20 → 24 hr.
 *    The counter resets after 24 h of no failures.
 *  - Dual-keying on login — both IP and hashed email are rate-limited
 *    independently so credential stuffing from many IPs still triggers
 *    per-account lockout.
 *  - Proxy-aware IP extraction — honours X-Forwarded-For with configurable
 *    trust depth. Never blindly trust the leftmost XFF IP (client-controlled).
 *  - Privacy-preserving logging — IP and email are hashed before logging;
 *    body content is never logged.
 */

import crypto from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getRedis } from '../services/redis.service.js';

// ── Env config ─────────────────────────────────────────────────────────────────
/**
 * PROXY_DEPTH: Number of trusted reverse-proxy hops in front of this service.
 *
 * Example deployment: Client → Cloudflare (1) → ALB (2) → API
 *   PROXY_DEPTH=2   → client IP is XFF[-3]
 *
 * For a single Nginx/HAProxy in front: PROXY_DEPTH=1 (default)
 * For a direct connection (dev):       PROXY_DEPTH=0
 *
 * Set too low  → attackers can spoof XFF and bypass IP limits.
 * Set too high → you use an internal proxy IP as the client key (all traffic
 *                shares one bucket and the limit is immediately hit).
 */
import { env } from '../config/env.js';

const PROXY_DEPTH = env.PROXY_DEPTH;
const IP_HASH_SALT = env.IP_HASH_SALT;

// ── Sliding-window Lua script ─────────────────────────────────────────────────
/**
 * Atomic sliding-window check+add in a single round-trip.
 *
 * KEYS[1]  — Redis sorted-set key for this window bucket
 * ARGV[1]  — current timestamp in milliseconds
 * ARGV[2]  — window size in milliseconds
 * ARGV[3]  — maximum requests allowed in the window
 * ARGV[4]  — unique member ID for this request (ts:random)
 *
 * Returns:
 *   >= 1   — request accepted; value is the current count after adding
 *   -1     — request REJECTED (over limit)
 */
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

// ── IP extraction ─────────────────────────────────────────────────────────────

/**
 * Extract the real client IP from a Fastify request.
 *
 * Algorithm:
 *   1. Parse X-Forwarded-For into an array [client, proxy1, proxy2, …, outerProxy]
 *   2. The rightmost PROXY_DEPTH entries are our own infrastructure (trusted).
 *   3. The entry immediately to the left of those is the actual client.
 *
 * If XFF has fewer entries than expected (direct connection in dev), we fall
 * back to the leftmost entry or request.ip.
 */
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

    // clientIdx: strip PROXY_DEPTH rightmost entries, take the next one
    const clientIdx = ips.length - PROXY_DEPTH - 1;
    if (clientIdx >= 0 && ips[clientIdx]) return ips[clientIdx];
    if (ips.length > 0) return ips[0]; // fewer hops than expected (e.g., dev)
  }

  if (typeof xri === 'string') return normaliseIp(xri.trim());

  return normaliseIp(request.ip ?? '127.0.0.1');
}

function normaliseIp(ip: string): string {
  // Strip IPv6 zone IDs (e.g., "::1%lo")
  const clean = ip.replace(/%.*$/, '').toLowerCase().trim();
  // IPv4: digits + dots  |  IPv6: hex + colons
  if (/^[\d.]+$/.test(clean) || /^[0-9a-f:]+$/.test(clean)) return clean;
  return '0.0.0.0'; // malformed — use safe fallback
}

// ── Privacy-preserving hashing ─────────────────────────────────────────────────

function hashForLog(value: string): string {
  return crypto
    .createHmac('sha256', IP_HASH_SALT)
    .update(value)
    .digest('hex')
    .slice(0, 16); // short enough to be readable, not reversible
}

// ── Structured security logging ───────────────────────────────────────────────

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
      // Never log raw IP in structured fields — always hash it
      ip_hash: hashForLog(ip),
      method: request.method,
      // Strip query string from logged path to avoid leaking tokens in URLs
      path: request.url.split('?')[0],
      // Truncate user-agent to avoid log-injection
      user_agent: (request.headers['user-agent'] ?? 'none').slice(0, 250),
      ...extra,
    },
    `[security] ${event}`,
  );
}

// ── Core sliding-window check ─────────────────────────────────────────────────

interface SlidingWindowResult {
  allowed: boolean;
  /** Current count (only meaningful when allowed = true). */
  count: number;
  /** Milliseconds until the oldest entry leaves the window. */
  retryAfterMs: number;
}

async function slidingWindowCheck(
  key: string,
  limit: number,
  windowMs: number,
): Promise<SlidingWindowResult> {
  const redis = getRedis();
  const nowMs = Date.now();
  // Use a unique member so concurrent requests don't collide on the same score
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
      // Over limit — calculate retry-after from the oldest surviving entry
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
    // Fail open — don't block traffic when Redis is unavailable
    console.error('[rate-limit] Redis error (failing open):', (err as Error).message);
    return { allowed: true, count: 0, retryAfterMs: 0 };
  }
}

// ── Progressive lockout ────────────────────────────────────────────────────────
/**
 * Lockout tiers (cumulative failure count → ban duration):
 *   5  failures → 15 minutes
 *   10 failures → 1 hour
 *   20 failures → 24 hours
 *
 * The failure counter itself resets after 24 h of no further failures,
 * so a legitimate user who fat-fingers their password 4 times is not
 * permanently penalised.
 */

async function getLockoutTtl(key: string): Promise<number> {
  /** Returns seconds remaining in lockout, or 0 if not locked. */
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
    // Reset failure counter after 24 h — gives legitimate users a clean slate
    await redis.expire(failCountKey, 86_400);

    let lockTtl = 0;
    if (fails >= 20) lockTtl = 86_400; // 24 h
    else if (fails >= 10) lockTtl = 3_600; // 1 h
    else if (fails >= 5) lockTtl = 900;   // 15 min

    if (lockTtl > 0) {
      // NX: only set if not already locked to avoid resetting a longer ban
      await redis.set(`rl:lock:${lockKey}`, '1', 'EX', lockTtl, 'NX');
    }
  } catch {
    // Fail silently — lockout is a best-effort defence
  }
}

export async function clearAuthFailures(lockKey: string): Promise<void> {
  const redis = getRedis();
  try {
    await redis.del(`rl:fails:${lockKey}`, `rl:lock:${lockKey}`);
  } catch {
    // Fail silently
  }
}

// ── Derived key builders ──────────────────────────────────────────────────────

function ipLockKey(ip: string): string {
  // Hash the IP so the Redis key doesn't contain raw PII
  return `ip:${hashForLog(ip)}`;
}

function emailLockKey(email: string): string {
  return `email:${hashForLog(email.toLowerCase())}`;
}

// ── Bot detection ─────────────────────────────────────────────────────────────

const KNOWN_SCANNER_PATTERNS = [
  /sqlmap/i, /nikto/i, /dirbuster/i, /masscan/i, /nmap/i,
  /hydra/i, /medusa/i, /nessus/i, /metasploit/i, /burpsuite/i,
  /havij/i, /zgrab/i, /acunetix/i, /appscan/i, /openvas/i,
  /gobuster/i, /wfuzz/i, /dirb\b/i, /nuclei/i, /feroxbuster/i,
];

function isScannerUserAgent(ua: string): boolean {
  return KNOWN_SCANNER_PATTERNS.some((re) => re.test(ua));
}

// ── Rate-limit response builder ───────────────────────────────────────────────

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

// ── Public preHandlers ─────────────────────────────────────────────────────────

/**
 * Simple IP-based sliding-window rate limiter.
 *
 * @param limit       Max requests allowed per window per IP.
 * @param windowMs    Window duration in milliseconds.
 * @param prefix      Redis key prefix — use a descriptive string like 'auth:register'.
 *
 * Usage:
 *   fastify.post('/auth/register', {
 *     preHandler: [ipRateLimit(3, 60 * 60_000, 'auth:register')],
 *   }, handler);
 */
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

/**
 * Authenticated-user sliding-window rate limiter (per userId, not IP).
 * Use for endpoints where a user might rotate IPs to bypass IP limits.
 *
 * Requires the JWT to have been verified already (i.e., call after authenticate).
 *
 * @param limit    Max requests per window per authenticated user.
 * @param windowMs Window in milliseconds.
 * @param prefix   Redis key prefix.
 */
export function userRateLimit(limit: number, windowMs: number, prefix: string) {
  return async function preHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = request.user as { userId?: string; sub?: string } | undefined;
    const userId = user?.userId ?? user?.sub;
    if (!userId) return; // no user — skip (unauthenticated requests hit ipRateLimit instead)

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

/**
 * Bot / scanner detection middleware.
 * Rejects requests with missing or known-malicious User-Agent on sensitive endpoints.
 */
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

/**
 * Full login protection preHandler.
 *
 * Enforces:
 *   1. No missing User-Agent (basic bot filter).
 *   2. IP lockout check (progressive bans from prior failures).
 *   3. IP sliding window: 5 attempts / 15 min.
 *   4. Per-email sliding window: 3 attempts / 15 min (uses hashed email from body).
 *   5. Per-email lockout check.
 *
 * Companion functions to call in the route handler:
 *   - recordLoginFailure(request, email)  — on bad credentials
 *   - recordLoginSuccess(request, email)  — on successful auth (clears counters)
 */
export function loginRateLimit() {
  return async function preHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // 0. Bot check
    const ua = request.headers['user-agent'] ?? '';
    if (!ua || isScannerUserAgent(ua)) {
      logSecurityEvent(request.server, request, 'bot_blocked_on_login');
      reply.code(403).send({ error: 'Forbidden', statusCode: 403 });
      return;
    }

    const ip = extractClientIp(request);
    const ipKey = ipLockKey(ip);

    // 1. IP lockout
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

    // 2. IP sliding window: 5 / 15 min
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

    // 3 & 4. Per-email checks (email is in request body)
    const body = request.body as { email?: unknown } | undefined;
    if (typeof body?.email === 'string' && body.email.length > 0) {
      const emailKey = emailLockKey(body.email);

      // 3. Email lockout
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

      // 4. Email sliding window: 3 / 15 min
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

/**
 * Call from the login route handler when credentials are INVALID.
 * Increments failure counters for the IP and (if known) the email.
 */
export async function recordLoginFailure(
  request: FastifyRequest,
  email?: string,
): Promise<void> {
  const ip = extractClientIp(request);
  await recordAuthFailure(ipLockKey(ip));
  if (email) await recordAuthFailure(emailLockKey(email));
}

/**
 * Call from the login route handler when credentials are VALID.
 * Clears failure counters so a legitimate user isn't unfairly locked out.
 */
export async function recordLoginSuccess(
  request: FastifyRequest,
  email: string,
): Promise<void> {
  const ip = extractClientIp(request);
  await clearAuthFailures(ipLockKey(ip));
  await clearAuthFailures(emailLockKey(email));
}
