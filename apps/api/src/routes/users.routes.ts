import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

interface DbUserProfile {
  id: string;
  username: string;
  email: string;
  rating: number;
  problems_solved: number;
  created_at: string;
  accepted: string;
  wrong: string;
  total_submissions: string;
}

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /users/:username — public profile
  fastify.get<{ Params: { username: string } }>('/:username', async (request, reply) => {
    const { username } = request.params;

    const profile = await queryOne<DbUserProfile>(
      `SELECT u.id, u.username, u.email, u.rating, u.problems_solved, u.created_at,
              COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status='accepted') as accepted,
              COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status='wrong_answer') as wrong,
              COUNT(s.id) as total_submissions
       FROM users u
       LEFT JOIN submissions s ON s.user_id = u.id
       WHERE u.username = $1
       GROUP BY u.id`,
      [username]
    );

    if (!profile) return reply.code(404).send({ error: 'User not found' });

    const recentSubmissions = await query<{
      id: string;
      status: string;
      language_id: number;
      time_ms: number | null;
      memory_kb: number | null;
      created_at: string;
      problem_slug: string;
      problem_title: string;
      problem_difficulty: string;
    }>(
      `SELECT s.id, s.status, s.language_id, s.time_ms, s.memory_kb, s.created_at,
              p.slug as problem_slug, p.title as problem_title, p.difficulty as problem_difficulty
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 10`,
      [profile.id]
    );

    const accepted = parseInt(profile.accepted ?? '0', 10);
    const totalUnique = accepted + parseInt(profile.wrong ?? '0', 10);
    const acceptanceRate = totalUnique > 0 ? Math.round((accepted / totalUnique) * 100) : 0;

    return reply.send({
      data: {
        id: profile.id,
        username: profile.username,
        rating: profile.rating,
        problemsSolved: profile.problems_solved,
        createdAt: profile.created_at,
        accepted,
        wrong: parseInt(profile.wrong ?? '0', 10),
        totalSubmissions: parseInt(profile.total_submissions ?? '0', 10),
        acceptanceRate,
        recentSubmissions: recentSubmissions.map((s) => ({
          id: s.id,
          status: s.status,
          languageId: s.language_id,
          timeMs: s.time_ms,
          memoryKb: s.memory_kb,
          createdAt: s.created_at,
          problem: {
            slug: s.problem_slug,
            title: s.problem_title,
            difficulty: s.problem_difficulty,
          },
        })),
      },
    });
  });
}
