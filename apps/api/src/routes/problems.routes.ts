import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/client.js';
import { cacheGet, cacheSet } from '../services/redis.service.js';
import { authenticate } from '../middleware/auth.js';
import type { Problem, Difficulty } from '@vyro/types';

interface DbProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  description: string;
  examples: unknown;
  constraints: unknown;
  starter_code: unknown;
  test_cases: unknown;
  tags: string[];
  acceptance_rate: string;
  created_at: string;
}

function toPublicProblem(row: DbProblem): Problem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty as Difficulty,
    description: row.description,
    examples: row.examples as Problem['examples'],
    constraints: row.constraints as string[],
    starterCode: row.starter_code as Problem['starterCode'],
    testCases: (row.test_cases as Problem['testCases']).map((tc) => ({
      ...tc,
      isHidden: tc.isHidden ?? false,
    })),
    tags: row.tags ?? [],
    acceptanceRate: parseFloat(row.acceptance_rate) || 0,
    createdAt: row.created_at,
  };
}

export async function problemsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /problems  — list with optional filters
  fastify.get<{
    Querystring: {
      difficulty?: string;
      tag?: string;
      search?: string;
      page?: string;
      pageSize?: string;
    };
  }>('/', async (request, reply) => {
    const { difficulty, tag, search, page = '1', pageSize = '20' } = request.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (difficulty) {
      conditions.push(`difficulty = $${paramIdx++}`);
      params.push(difficulty);
    }
    if (tag) {
      conditions.push(`$${paramIdx++} = ANY(tags)`);
      params.push(tag);
    }
    if (search) {
      conditions.push(`(title ILIKE $${paramIdx} OR slug ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Cache key based on all query params
    const listCacheKey = `problems:list:${difficulty ?? 'all'}:${tag ?? ''}:${search ?? ''}:${page}:${pageSize}`;
    const cached = await cacheGet<{ items: unknown[]; total: number; page: number; pageSize: number; hasMore: boolean }>(listCacheKey);
    if (cached) return reply.send({ data: cached });

    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM problems ${where}`,
      params
    );
    const total = parseInt(countRows[0]?.count ?? '0', 10);

    const rows = await query<DbProblem>(
      `SELECT id, slug, title, difficulty, tags, acceptance_rate, created_at
       FROM problems ${where}
       ORDER BY difficulty, title
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(pageSize, 10), offset]
    );

    const responseData = {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        difficulty: r.difficulty as Difficulty,
        tags: r.tags ?? [],
        acceptanceRate: parseFloat(r.acceptance_rate) || 0,
        createdAt: r.created_at,
      })),
      total,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      hasMore: offset + rows.length < total,
    };
    // Cache for 60 seconds
    await cacheSet(listCacheKey, responseData, 60);

    return reply.send({ data: responseData });
  });

  // GET /problems/:slug
  fastify.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params;

    const cacheKey = `problem:${slug}`;
    const cached = await cacheGet<Problem>(cacheKey);
    if (cached) {
      return reply.send({ data: cached });
    }

    const row = await queryOne<DbProblem>(
      'SELECT * FROM problems WHERE slug = $1',
      [slug]
    );
    if (!row) {
      return reply.code(404).send({ error: 'Problem not found' });
    }

    const problem = toPublicProblem(row);
    await cacheSet(cacheKey, problem, 600);

    return reply.send({ data: problem });
  });

  // GET /problems/:slug/submissions — user's submissions for this problem (auth required)
  fastify.get<{ Params: { slug: string } }>(
    '/:slug/submissions',
    { preHandler: authenticate },
    async (request, reply) => {
      const { slug } = request.params;
      const { userId } = request.user as { userId: string };

      const submissions = await query<{
        id: string;
        status: string;
        language_id: number;
        time_ms: number | null;
        memory_kb: number | null;
        created_at: string;
        code: string;
      }>(
        `SELECT s.id, s.status, s.language_id, s.time_ms, s.memory_kb, s.created_at, s.code
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE p.slug = $1 AND s.user_id = $2
         ORDER BY s.created_at DESC
         LIMIT 20`,
        [slug, userId]
      );

      return reply.send({
        data: submissions.map((s) => ({
          id: s.id,
          status: s.status,
          languageId: s.language_id,
          timeMs: s.time_ms,
          memoryKb: s.memory_kb,
          createdAt: s.created_at,
          code: s.code,
        })),
      });
    }
  );
}
