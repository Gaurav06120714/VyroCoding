import { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { cacheGet, cacheSet } from '../services/redis.service.js';

export async function leaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /leaderboard — global leaderboard
  fastify.get<{ Querystring: { page?: string; pageSize?: string } }>(
    '/',
    async (request, reply) => {
      const { page = '1', pageSize = '50' } = request.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

      const cacheKey = `leaderboard:global:${page}:${pageSize}`;
      const cached = await cacheGet(cacheKey);
      if (cached) return reply.send({ data: cached });

      const [countRow] = await query<{ count: string }>('SELECT COUNT(*) as count FROM users');
      const total = parseInt(countRow?.count ?? '0', 10);

      const rows = await query<{
        id: string;
        username: string;
        rating: number;
        problems_solved: number;
      }>(
        `SELECT id, username, rating, problems_solved
         FROM users
         ORDER BY rating DESC, problems_solved DESC
         LIMIT $1 OFFSET $2`,
        [parseInt(pageSize, 10), offset]
      );

      const data = {
        items: rows.map((r, idx) => ({
          rank: offset + idx + 1,
          userId: r.id,
          username: r.username,
          rating: r.rating,
          problemsSolved: r.problems_solved,
        })),
        total,
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        hasMore: offset + rows.length < total,
      };

      await cacheSet(cacheKey, data, 60);
      return reply.send({ data });
    }
  );
}
