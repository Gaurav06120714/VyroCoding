import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import {
  loginRateLimit,
  ipRateLimit,
  botCheck,
  recordLoginFailure,
  recordLoginSuccess,
} from '../plugins/rate-limit.js';
import type { RegisterRequest, LoginRequest, User } from '@vyro/types';

interface DbUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  rating: number;
  problems_solved: number;
  created_at: string;
}

function toUser(row: DbUser): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    rating: row.rating,
    problemsSolved: row.problems_solved,
    createdAt: row.created_at,
  };
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /auth/register ──────────────────────────────────────────────────────
  // Limits: 3 registrations / hour / IP  +  bot check
  fastify.post<{ Body: RegisterRequest }>('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
    preHandler: [
      botCheck(),
      ipRateLimit(3, 60 * 60_000, 'auth:register'),   // 3 / hr / IP
    ],
  }, async (request, reply) => {
    const { username, email, password } = request.body;

    const existing = await queryOne<DbUser>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username],
    );
    if (existing) {
      return reply.code(409).send({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await query<DbUser>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email, passwordHash],
    );

    const token = fastify.jwt.sign({ userId: user.id, username: user.username });

    return reply.code(201).send({ data: { ...toUser(user), token } });
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────────
  // Limits:
  //   • Bot check
  //   • 5 attempts / 15 min / IP   (sliding window)
  //   • 3 attempts / 15 min / email (sliding window)
  //   • Progressive IP + account lockout on failure
  fastify.post<{ Body: LoginRequest }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
    preHandler: [loginRateLimit()],
  }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await queryOne<DbUser>(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );

    if (!user) {
      // Record failure to increment counters — use constant-time path so
      // timing doesn't reveal whether the email exists.
      await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000000');
      await recordLoginFailure(request, email);
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordLoginFailure(request, email);
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Success — clear failure counters so the user isn't penalised further
    await recordLoginSuccess(request, email);

    const token = fastify.jwt.sign({ userId: user.id, username: user.username });
    return reply.send({ data: { ...toUser(user), token } });
  });

  // ── GET /auth/me ─────────────────────────────────────────────────────────────
  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };

    const user = await queryOne<DbUser>(
      'SELECT * FROM users WHERE id = $1',
      [userId],
    );
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return reply.send({ data: toUser(user) });
  });

  // ── POST /auth/forgot-password ────────────────────────────────────────────────
  // Limits: 3 / hour / IP — prevents email enumeration via timing + spam
  fastify.post<{ Body: { email: string } }>('/forgot-password', {
    preHandler: [
      botCheck(),
      ipRateLimit(3, 60 * 60_000, 'auth:forgot-password'),
    ],
  }, async (request, reply) => {
    const { email } = request.body;

    const user = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
    if (!user) {
      // Always return the same response — prevents email enumeration
      return reply.send({ data: { message: 'If that email exists, a reset link has been sent.' } });
    }

    const resetToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await query(
      'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id],
    );

    // TODO: send email via your email service (e.g., Resend, SendGrid)
    // In production, never return the token in the response.
    // Dev mode: return token directly for testing convenience.
    if (process.env.NODE_ENV !== 'production') {
      return reply.send({ data: { resetToken, message: 'Reset token generated (dev mode only).' } });
    }

    return reply.send({ data: { message: 'If that email exists, a reset link has been sent.' } });
  });

  // ── POST /auth/reset-password ─────────────────────────────────────────────────
  // Limits: 5 / 15 min / IP
  fastify.post<{ Body: { token: string; newPassword: string } }>('/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token:       { type: 'string', minLength: 64, maxLength: 64 },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
    preHandler: [
      botCheck(),
      ipRateLimit(5, 15 * 60_000, 'auth:reset-password'),
    ],
  }, async (request, reply) => {
    const { token, newPassword } = request.body;

    const user = await queryOne<{ id: string; reset_expires: string }>(
      'SELECT id, reset_expires FROM users WHERE reset_token = $1',
      [token],
    );

    // Same error for both "not found" and "expired" — prevents token oracle
    if (!user || new Date(user.reset_expires) < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
      [passwordHash, user.id],
    );

    return reply.send({ data: { message: 'Password reset successfully.' } });
  });
}
