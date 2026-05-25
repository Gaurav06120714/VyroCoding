import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

// ── Auto-sync contest statuses based on real time ─────────────────────────
async function syncContestStatuses(): Promise<void> {
  const now = new Date().toISOString();
  await query(
    `UPDATE contests
     SET status = CASE
       WHEN start_time > $1 THEN 'upcoming'
       WHEN end_time   > $1 THEN 'active'
       ELSE 'ended'
     END
     WHERE status != CASE
       WHEN start_time > $1 THEN 'upcoming'
       WHEN end_time   > $1 THEN 'active'
       ELSE 'ended'
     END`,
    [now]
  );
}

// ── Get next Monday at 9:00 AM IST (UTC+5:30 = UTC+5h30m) ────────────────
function nextMondayIST(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  const daysUntilMonday = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7) || 7;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntilMonday);
  // 9:00 AM IST = 03:30 UTC
  next.setUTCHours(3, 30, 0, 0);
  const end = new Date(next);
  end.setUTCHours(next.getUTCHours() + 2); // 2-hour contest
  return { start: next, end };
}

// ── Pick random non-repeating problems (1 easy + 1 medium + 1 hard) ──────
async function pickWeeklyProblems(): Promise<string[] | null> {
  // Get all problem IDs already used in past/upcoming contests
  const used = await query<{ problem_id: string }>(
    `SELECT DISTINCT cp.problem_id FROM contest_problems cp
     JOIN contests c ON c.id = cp.contest_id`
  );
  const usedIds = used.map(r => r.problem_id);

  const pick = async (diff: string): Promise<string | null> => {
    const exclude = usedIds.length > 0
      ? `AND id NOT IN (${usedIds.map((_, i) => `$${i + 2}`).join(',')})`
      : '';
    const rows = await query<{ id: string }>(
      `SELECT id FROM problems WHERE difficulty = $1 ${exclude} ORDER BY RANDOM() LIMIT 1`,
      [diff, ...usedIds]
    );
    return rows[0]?.id ?? null;
  };

  const easy   = await pick('easy');
  const medium = await pick('medium');
  const hard   = await pick('hard');

  if (!easy || !medium || !hard) return null;
  return [easy, medium, hard];
}

// ── Create the next weekly Monday contest ─────────────────────────────────
export async function createWeeklyContest(): Promise<{ id: string; title: string } | null> {
  const { start, end } = nextMondayIST();

  // Don't duplicate if one already exists for that Monday
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM contests WHERE start_time::date = $1::date`,
    [start.toISOString()]
  );
  if (existing) return null;

  const problemIds = await pickWeeklyProblems();
  if (!problemIds) return null;

  // Week number within year
  const week = Math.ceil(
    (start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 604800000
  );
  const title = `Weekly Challenge — Week ${week}, ${start.getFullYear()}`;

  const [contest] = await query<{ id: string }>(
    `INSERT INTO contests (title, start_time, end_time, status)
     VALUES ($1, $2, $3, 'upcoming') RETURNING id`,
    [title, start.toISOString(), end.toISOString()]
  );

  const points = [100, 200, 300]; // easy, medium, hard
  for (let i = 0; i < problemIds.length; i++) {
    await query(
      `INSERT INTO contest_problems (contest_id, problem_id, points, order_index)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [contest.id, problemIds[i], points[i], i]
    );
  }

  return { id: contest.id, title };
}

export async function contestsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /contests ──────────────────────────────────────────────────────
  fastify.get('/', async (_request, reply) => {
    await syncContestStatuses();

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

  // ── POST /contests/:id/join ────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/:id/join',
    { preHandler: authenticate },
    async (request, reply) => {
      await syncContestStatuses();

      const { userId } = request.user as { userId: string };
      const { id } = request.params;

      const contest = await queryOne<{ id: string; status: string }>(
        'SELECT id, status FROM contests WHERE id = $1',
        [id]
      );
      if (!contest) return reply.code(404).send({ error: 'Contest not found' });
      if (contest.status === 'ended') {
        return reply.code(400).send({ error: 'Contest has already ended' });
      }

      await query(
        `INSERT INTO contest_participants (contest_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, userId]
      );

      return reply.send({ data: { joined: true } });
    }
  );

  // ── GET /contests/:id ─────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const contest = await queryOne<{
      id: string; title: string; start_time: string;
      end_time: string; status: string; created_at: string;
    }>('SELECT * FROM contests WHERE id = $1', [id]);

    if (!contest) return reply.code(404).send({ error: 'Contest not found' });

    const problems = await query<{
      contest_id: string; problem_id: string; slug: string;
      title: string; difficulty: string; points: number; order_index: number;
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

  // ── GET /contests/:id/leaderboard ─────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id/leaderboard', async (request, reply) => {
    const { id } = request.params;
    const entries = await query<{
      user_id: string; username: string;
      total_score: string; problems_solved: string;
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

  // ── POST /contests — create contest (admin only) ──────────────────────
  fastify.post<{
    Body: { title: string; startTime: string; endTime: string; problemIds: string[] };
  }>('/', { preHandler: authenticate }, async (request, reply) => {
    const { title, startTime, endTime, problemIds } = request.body;
    const [contest] = await query<{ id: string }>(
      `INSERT INTO contests (title, start_time, end_time)
       VALUES ($1, $2, $3) RETURNING id`,
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

  // ── POST /contests/weekly — auto-create next Monday's contest ─────────
  fastify.post('/weekly', { preHandler: authenticate }, async (_request, reply) => {
    const result = await createWeeklyContest();
    if (!result) {
      return reply.code(409).send({ error: 'Weekly contest already exists or no unused problems available' });
    }
    return reply.code(201).send({ data: result });
  });
}
