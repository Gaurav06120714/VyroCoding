import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

async function requireAdmin(fastify: FastifyInstance, request: Parameters<typeof authenticate>[0], reply: Parameters<typeof authenticate>[1]): Promise<boolean> {
  await authenticate(request, reply);
  if (reply.sent) return false;

  const { userId } = request.user as { userId: string };
  const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
  if (!user?.is_admin) {
    reply.code(403).send({ error: 'Admin access required' });
    return false;
  }
  return true;
}

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /admin/stats
  fastify.get('/stats', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!user?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const [totalUsers] = await query<{ count: string }>('SELECT COUNT(*) as count FROM users');
    const [totalProblems] = await query<{ count: string }>('SELECT COUNT(*) as count FROM problems');
    const [totalSubmissions] = await query<{ count: string }>('SELECT COUNT(*) as count FROM submissions');
    const [totalRooms] = await query<{ count: string }>('SELECT COUNT(*) as count FROM rooms');

    return reply.send({
      data: {
        totalUsers: parseInt(totalUsers.count, 10),
        totalProblems: parseInt(totalProblems.count, 10),
        totalSubmissions: parseInt(totalSubmissions.count, 10),
        totalRooms: parseInt(totalRooms.count, 10),
      },
    });
  });

  // GET /admin/problems
  fastify.get('/problems', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!user?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const problems = await query<{
      id: string; title: string; slug: string; difficulty: string; tags: string[]; created_at: string;
    }>('SELECT id, title, slug, difficulty, tags, created_at FROM problems ORDER BY created_at DESC');

    return reply.send({ data: problems });
  });

  // POST /admin/problems
  fastify.post<{
    Body: {
      title: string;
      slug: string;
      difficulty: string;
      description: string;
      tags: string[];
      starterCode: Record<string, string>;
      testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
      constraints?: string[];
    };
  }>('/problems', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!user?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const { title, slug, difficulty, description, tags, starterCode, testCases, constraints = [] } = request.body;

    const [row] = await query<{ id: string }>(
      `INSERT INTO problems (title, slug, difficulty, description, tags, starter_code, test_cases, constraints)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [title, slug, difficulty, description, JSON.stringify(tags), JSON.stringify(starterCode), JSON.stringify(testCases), JSON.stringify(constraints)]
    );

    return reply.code(201).send({ data: { id: row.id } });
  });

  // PATCH /admin/problems/:id
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      slug?: string;
      difficulty?: string;
      description?: string;
      tags?: string[];
      starterCode?: Record<string, string>;
      testCases?: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
      constraints?: string[];
    };
  }>('/problems/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const adminUser = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!adminUser?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const { id } = request.params;
    const { title, slug, difficulty, description, tags, starterCode, testCases, constraints } = request.body;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (slug !== undefined) { fields.push(`slug = $${idx++}`); values.push(slug); }
    if (difficulty !== undefined) { fields.push(`difficulty = $${idx++}`); values.push(difficulty); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(JSON.stringify(tags)); }
    if (starterCode !== undefined) { fields.push(`starter_code = $${idx++}`); values.push(JSON.stringify(starterCode)); }
    if (testCases !== undefined) { fields.push(`test_cases = $${idx++}`); values.push(JSON.stringify(testCases)); }
    if (constraints !== undefined) { fields.push(`constraints = $${idx++}`); values.push(JSON.stringify(constraints)); }

    if (fields.length === 0) return reply.code(400).send({ error: 'No fields to update' });

    values.push(id);
    await query(`UPDATE problems SET ${fields.join(', ')} WHERE id = $${idx}`, values);

    return reply.send({ data: { updated: true } });
  });

  // DELETE /admin/problems/:id
  fastify.delete<{ Params: { id: string } }>('/problems/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!user?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const { id } = request.params;
    await query('DELETE FROM problems WHERE id = $1', [id]);

    return reply.send({ data: { deleted: true } });
  });

  // GET /admin/rooms
  fastify.get('/rooms', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!user?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const rooms = await query<{
      id: string; name: string; status: string; host_username: string; participant_count: string; created_at: string;
    }>(
      `SELECT r.id, r.name, r.status, u.username as host_username, COUNT(rp.user_id) as participant_count, r.created_at
       FROM rooms r
       JOIN users u ON u.id = r.host_id
       LEFT JOIN room_participants rp ON rp.room_id = r.id
       GROUP BY r.id, u.username
       ORDER BY r.created_at DESC
       LIMIT 50`
    );

    return reply.send({ data: rooms });
  });

  // DELETE /admin/rooms/:id
  fastify.delete<{ Params: { id: string } }>('/rooms/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!user?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const { id } = request.params;
    await query('DELETE FROM rooms WHERE id = $1', [id]);

    return reply.send({ data: { deleted: true } });
  });

  // GET /admin/submissions
  fastify.get('/submissions', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await queryOne<{ is_admin: boolean }>('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!user?.is_admin) return reply.code(403).send({ error: 'Admin access required' });

    const submissions = await query<{
      id: string; status: string; language_id: number; created_at: string; username: string; problem_title: string;
    }>(
      `SELECT s.id, s.status, s.language_id, s.created_at, u.username, p.title as problem_title
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN problems p ON p.id = s.problem_id
       ORDER BY s.created_at DESC
       LIMIT 50`
    );

    return reply.send({ data: submissions });
  });
}
