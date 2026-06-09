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

function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');   
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

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
      ipRateLimit(3, 60 * 60_000, 'auth:register'),   
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

    const okResponse = { data: { message: 'If that email exists, a reset link has been sent.' } };

    if (!user) {
      
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
      return reply.send(okResponse);
    }

    const { raw: rawToken, hash: tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

    await query(
      `UPDATE users
         SET reset_token_hash = $1, reset_token_expires = $2
       WHERE id = $3`,
      [tokenHash, expiresAt.toISOString(), user.id],
    );

    const resetLink = `${env.APP_URL}/reset-password?token=${rawToken}`;

    const { sent, previewLink } = await sendPasswordResetEmail(user.email, resetLink);

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

    const tokenHash = hashToken(token);

    const user = await queryOne<{ id: string; reset_token_expires: string }>(
      `SELECT id, reset_token_expires
         FROM users
        WHERE reset_token_hash = $1`,
      [tokenHash],
    );

    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return reply.code(400).send({ error: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

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
