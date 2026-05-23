import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
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
  // POST /auth/register
  fastify.post<{ Body: RegisterRequest }>('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, email, password } = request.body;

    const existing = await queryOne<DbUser>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing) {
      return reply.code(409).send({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await query<DbUser>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email, passwordHash]
    );

    const token = fastify.jwt.sign({ userId: user.id, username: user.username });

    return reply.code(201).send({ data: { ...toUser(user), token } });
  });

  // POST /auth/login
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
  }, async (request, reply) => {
    const { email, password } = request.body;

    const user = await queryOne<DbUser>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ userId: user.id, username: user.username });

    return reply.send({ data: { ...toUser(user), token } });
  });

  // GET /auth/me
  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };

    const user = await queryOne<DbUser>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return reply.send({ data: toUser(user) });
  });

  // POST /auth/forgot-password
  fastify.post<{ Body: { email: string } }>('/forgot-password', async (request, reply) => {
    const { email } = request.body;

    const user = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
    if (!user) {
      // Don't reveal whether email exists
      return reply.send({ data: { message: 'If that email exists, a reset token has been generated.' } });
    }

    const resetToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await query(
      'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    // Dev mode: return token directly
    return reply.send({ data: { resetToken, message: 'Reset token generated (dev mode).' } });
  });

  // POST /auth/reset-password
  fastify.post<{ Body: { token: string; newPassword: string } }>('/reset-password', async (request, reply) => {
    const { token, newPassword } = request.body;

    const user = await queryOne<{ id: string; reset_expires: string }>(
      'SELECT id, reset_expires FROM users WHERE reset_token = $1',
      [token]
    );

    if (!user) {
      return reply.code(400).send({ error: 'Invalid or expired reset token' });
    }

    if (new Date(user.reset_expires) < new Date()) {
      return reply.code(400).send({ error: 'Reset token has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    return reply.send({ data: { message: 'Password reset successfully.' } });
  });
}
