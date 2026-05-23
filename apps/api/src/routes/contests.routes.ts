import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

export async function contestsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /contests
  fastify.get('/', async (_request, reply) => {
    const contests = await query<{
      id: string;
      title: string;
      start_time: string;
      end_time: string;
      status: string;
      participant_count: string;
      created_at: string;
    }>(
      `SELECT c.id, c.title, c.start_time, c.end_time, c.status, c.created_at,
              COUNT(DISTINCT cp.user_id) as participant_count
       FROM contests c
       LEFT JOIN contest_participants cp ON cp.contest_id = c.id
       GROUP BY c.id
       ORDER BY c.start_time DESC
       LIMIT 50`
    );

    return reply.send({
      data: contests.map((c) => ({
        id: c.id,
        title: c.title,
        startTime: c.start_time,
        endTime: c.end_time,
        status: c.status,
        participantCount: parseInt(c.participant_count ?? '0', 10),
        createdAt: c.created_at,
      })),
    });
  });

  // POST /contests/:id/join — join a contest (auth required)
  fastify.post<{ Params: { id: string } }>(
    '/:id/join',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;

      const contest = await queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM contests WHERE id = $1',
        [id]
      );
      if (!contest) return reply.code(404).send({ error: 'Contest not found' });
      if (contest.status === 'ended') return reply.code(400).send({ error: 'Contest has ended' });

      await query(
        `INSERT INTO contest_participants (contest_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, userId]
      );

      return reply.send({ data: { joined: true } });
    }
  );

  // GET /contests/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const contest = await queryOne<{
      id: string;
      title: string;
      start_time: string;
      end_time: string;
      status: string;
      created_at: string;
    }>('SELECT * FROM contests WHERE id = $1', [id]);

    if (!contest) return reply.code(404).send({ error: 'Contest not found' });

    const problems = await query<{
      contest_id: string;
      problem_id: string;
      slug: string;
      title: string;
      difficulty: string;
      points: number;
      order_index: number;
    }>(
      `SELECT cp.contest_id, cp.problem_id, p.slug, p.title, p.difficulty, cp.points, cp.order_index
       FROM contest_problems cp
       JOIN problems p ON p.id = cp.problem_id
       WHERE cp.contest_id = $1
       ORDER BY cp.order_index`,
      [id]
    );

    return reply.send({
      data: {
        id: contest.id,
        title: contest.title,
        startTime: contest.start_time,
        endTime: contest.end_time,
        status: contest.status,
        createdAt: contest.created_at,
        problems: problems.map((p) => ({
          contestId: p.contest_id,
          problemId: p.problem_id,
          problem: { id: p.problem_id, slug: p.slug, title: p.title, difficulty: p.difficulty },
          points: p.points,
          orderIndex: p.order_index,
        })),
      },
    });
  });

  // GET /contests/:id/leaderboard
  fastify.get<{ Params: { id: string } }>('/:id/leaderboard', async (request, reply) => {
    const { id } = request.params;

    const entries = await query<{
      user_id: string;
      username: string;
      total_score: string;
      problems_solved: string;
    }>(
      `SELECT cs.user_id, u.username,
              SUM(cs.score) as total_score,
              COUNT(DISTINCT cs.problem_id) as problems_solved
       FROM contest_submissions cs
       JOIN users u ON u.id = cs.user_id
       WHERE cs.contest_id = $1
       GROUP BY cs.user_id, u.username
       ORDER BY total_score DESC, problems_solved DESC`,
      [id]
    );

    return reply.send({
      data: entries.map((e, idx) => ({
        rank: idx + 1,
        userId: e.user_id,
        username: e.username,
        score: parseInt(e.total_score ?? '0', 10),
        problemsSolved: parseInt(e.problems_solved ?? '0', 10),
      })),
    });
  });

  // POST /contests — create contest (admin)
  fastify.post<{
    Body: { title: string; startTime: string; endTime: string; problemIds: string[] };
  }>('/', { preHandler: authenticate }, async (request, reply) => {
    const { title, startTime, endTime, problemIds } = request.body;

    const [contest] = await query<{ id: string }>(
      `INSERT INTO contests (title, start_time, end_time)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [title, startTime, endTime]
    );

    if (problemIds?.length) {
      for (let i = 0; i < problemIds.length; i++) {
        await query(
          `INSERT INTO contest_problems (contest_id, problem_id, points, order_index)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [contest.id, problemIds[i], 100, i]
        );
      }
    }

    return reply.code(201).send({ data: { id: contest.id } });
  });
}
