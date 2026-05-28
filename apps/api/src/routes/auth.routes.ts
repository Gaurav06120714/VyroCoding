import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, queryOne } from '../db/client.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import {
  loginRateLimit,
  ipRateLimit,
  botCheck,
  recordLoginFailure,
  recordLoginSuccess,
} from '../plugins/rate-limit.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import type { RegisterRequest, LoginRequest, User } from '@vyro/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * Generate a cryptographically secure reset token.
 * Returns both the raw token (to be sent in the email link) and its
 * SHA-256 hash (to be stored in the database — never the raw token).
 */
function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');   // 64 hex chars
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

/** Hash an incoming token the same way so we can do a DB lookup by hash. */
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /auth/register ──────────────────────────────────────────────────────
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
      // Constant-time path to avoid timing attacks that reveal email existence
      await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000000');
      await recordLoginFailure(request, email);
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordLoginFailure(request, email);
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

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
  //
  // Security properties:
  //   • Always returns the same response body — prevents email enumeration
  //   • Raw token never persisted — only its SHA-256 hash is stored
  //   • Token expires in 1 hour
  //   • Rate-limited: 3 requests / hour / IP
  //
  fastify.post<{ Body: { email: string } }>('/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
    preHandler: [
      botCheck(),
      ipRateLimit(3, 60 * 60_000, 'auth:forgot-password'),
    ],
  }, async (request, reply) => {
    const { email } = request.body;

    const user = await queryOne<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE email = $1',
      [email],
    );

    // Always return the same shape so callers can't enumerate which emails exist
    const okResponse = { data: { message: 'If that email exists, a reset link has been sent.' } };

    if (!user) {
      // Artificial delay to prevent timing-based email enumeration
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
      return reply.send(okResponse);
    }

    // Generate token and persist only the hash
    const { raw: rawToken, hash: tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      `UPDATE users
         SET reset_token_hash = $1, reset_token_expires = $2
       WHERE id = $3`,
      [tokenHash, expiresAt.toISOString(), user.id],
    );

    const resetLink = `${env.APP_URL}/reset-password?token=${rawToken}`;

    const { sent, previewLink } = await sendPasswordResetEmail(user.email, resetLink);

    // Dev mode: return the token/link so developers can test without email creds
    if (!sent && previewLink && env.NODE_ENV !== 'production') {
      return reply.send({
        data: {
          message: 'Reset token generated (dev mode — no email sent).',
          resetToken: rawToken,
          resetLink: previewLink,
        },
      });
    }

    return reply.send(okResponse);
  });

  // ── POST /auth/reset-password ─────────────────────────────────────────────────
  //
  // Security properties:
  //   • Looks up user by SHA-256 hash of the token — raw token never in DB
  //   • Returns same error for "not found" and "expired" — no oracle
  //   • Clears token on success so it can't be reused
  //   • Rate-limited: 5 requests / 15 min / IP
  //
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

    // Hash the incoming token before the DB lookup
    const tokenHash = hashToken(token);

    const user = await queryOne<{ id: string; reset_token_expires: string }>(
      `SELECT id, reset_token_expires
         FROM users
        WHERE reset_token_hash = $1`,
      [tokenHash],
    );

    // Unified error message — prevents oracle attacks
    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and clear token atomically
    await query(
      `UPDATE users
         SET password_hash       = $1,
             reset_token_hash    = NULL,
             reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, user.id],
    );

    return reply.send({ data: { message: 'Password reset successfully. You can now log in.' } });
  });

  // ── POST /auth/change-password ────────────────────────────────────────────────
  // Authenticated users can change their password directly (no token needed)
  fastify.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/change-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword:     { type: 'string', minLength: 8 },
          },
        },
      },
      preHandler: [
        authenticate,
        ipRateLimit(10, 15 * 60_000, 'auth:change-password'),
      ],
    },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { currentPassword, newPassword } = request.body;

      const user = await queryOne<DbUser>(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [userId],
      );
      if (!user) return reply.code(404).send({ error: 'User not found' });

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return reply.code(401).send({ error: 'Current password is incorrect' });

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

      return reply.send({ data: { message: 'Password changed successfully.' } });
    },
  );
}
