import { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import type { Room, RoomStatus, CreateRoomRequest } from '@vyro/types';

// In-memory room WebSocket registry (store the raw WebSocket from SocketStream)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roomSockets = new Map<string, Set<any>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function broadcastToRoom(roomId: string, data: unknown, exclude?: any): void {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  const payload = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws !== exclude && ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

interface DbRoom {
  id: string;
  name: string;
  host_id: string;
  host_username: string;
  problem_id: string | null;
  problem_slug: string | null;
  problem_title: string | null;
  problem_difficulty: string | null;
  is_public: boolean;
  max_participants: number;
  status: string;
  participant_count: string;
  created_at: string;
}

function toRoom(row: DbRoom): Room {
  return {
    id: row.id,
    name: row.name,
    hostId: row.host_id,
    host: { id: row.host_id, username: row.host_username },
    problemId: row.problem_id ?? undefined,
    problem: row.problem_id
      ? {
          id: row.problem_id,
          slug: row.problem_slug!,
          title: row.problem_title!,
          difficulty: row.problem_difficulty as any,
        }
      : undefined,
    isPublic: row.is_public,
    maxParticipants: row.max_participants,
    status: row.status as RoomStatus,
    participantCount: parseInt(row.participant_count ?? '0', 10),
    createdAt: row.created_at,
  };
}

const ROOM_SELECT = `
  r.*,
  u.username as host_username,
  p.slug as problem_slug,
  p.title as problem_title,
  p.difficulty as problem_difficulty,
  COUNT(rp.user_id) as participant_count
FROM rooms r
JOIN users u ON u.id = r.host_id
LEFT JOIN problems p ON p.id = r.problem_id
LEFT JOIN room_participants rp ON rp.room_id = r.id
`;

// Pick 5 easy, 3 medium, 2 hard from the problems table
async function assignDefaultProblems(roomId: string): Promise<void> {
  const easyProblems = await query<{ id: string }>(
    `SELECT id FROM problems WHERE difficulty = 'easy' ORDER BY created_at LIMIT 5`
  );
  const mediumProblems = await query<{ id: string }>(
    `SELECT id FROM problems WHERE difficulty = 'medium' ORDER BY created_at LIMIT 3`
  );
  const hardProblems = await query<{ id: string }>(
    `SELECT id FROM problems WHERE difficulty = 'hard' ORDER BY created_at LIMIT 2`
  );

  const all = [...easyProblems, ...mediumProblems, ...hardProblems];
  for (let i = 0; i < all.length; i++) {
    await query(
      `INSERT INTO room_problems (room_id, problem_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [roomId, all[i].id, i]
    );
  }

  // Set first problem as the active room problem
  if (easyProblems.length > 0) {
    await query(`UPDATE rooms SET problem_id = $1 WHERE id = $2`, [
      easyProblems[0].id,
      roomId,
    ]);
  }
}

export async function roomsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /rooms — list public rooms
  fastify.get<{ Querystring: { status?: string; page?: string } }>(
    '/',
    async (request, reply) => {
      const { status = 'waiting', page = '1' } = request.query;
      const offset = (parseInt(page, 10) - 1) * 20;

      const rows = await query<DbRoom>(
        `SELECT ${ROOM_SELECT}
         WHERE r.is_public = true AND r.status = $1
         GROUP BY r.id, u.username, p.slug, p.title, p.difficulty
         ORDER BY r.created_at DESC
         LIMIT 20 OFFSET $2`,
        [status, offset]
      );

      return reply.send({ data: rows.map(toRoom) });
    }
  );

  // POST /rooms — create room with default problems
  fastify.post<{ Body: CreateRoomRequest }>(
    '/',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { name, isPublic = true, maxParticipants = 4 } = request.body;

      const [roomRow] = await query<{ id: string }>(
        `INSERT INTO rooms (name, host_id, is_public, max_participants)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, userId, isPublic, maxParticipants]
      );

      // Auto-join the host
      await query(
        `INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roomRow.id, userId]
      );

      // Assign 5 easy + 3 medium + 2 hard default problems
      await assignDefaultProblems(roomRow.id);

      const room = await queryOne<DbRoom>(
        `SELECT ${ROOM_SELECT}
         WHERE r.id = $1
         GROUP BY r.id, u.username, p.slug, p.title, p.difficulty`,
        [roomRow.id]
      );

      return reply.code(201).send({ data: toRoom(room!) });
    }
  );

  // GET /rooms/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const room = await queryOne<DbRoom>(
      `SELECT ${ROOM_SELECT}
       WHERE r.id = $1
       GROUP BY r.id, u.username, p.slug, p.title, p.difficulty`,
      [id]
    );
    if (!room) return reply.code(404).send({ error: 'Room not found' });

    const participants = await query<{
      user_id: string;
      username: string;
      joined_at: string;
      language_id: number;
    }>(
      `SELECT rp.user_id, u.username, rp.joined_at, rp.language_id
       FROM room_participants rp
       JOIN users u ON u.id = rp.user_id
       WHERE rp.room_id = $1`,
      [id]
    );

    // Fetch room's problem list
    const problems = await query<{
      id: string;
      slug: string;
      title: string;
      difficulty: string;
      sort_order: number;
    }>(
      `SELECT p.id, p.slug, p.title, p.difficulty, rp.sort_order
       FROM room_problems rp
       JOIN problems p ON p.id = rp.problem_id
       WHERE rp.room_id = $1
       ORDER BY rp.sort_order`,
      [id]
    );

    return reply.send({
      data: {
        ...toRoom(room),
        participants: participants.map((p) => ({
          roomId: id,
          userId: p.user_id,
          user: { id: p.user_id, username: p.username },
          joinedAt: p.joined_at,
          languageId: p.language_id,
        })),
        problems,
      },
    });
  });

  // GET /rooms/:id/problems
  fastify.get<{ Params: { id: string } }>('/:id/problems', async (request, reply) => {
    const { id } = request.params;
    const problems = await query<{
      id: string;
      slug: string;
      title: string;
      difficulty: string;
      sort_order: number;
    }>(
      `SELECT p.id, p.slug, p.title, p.difficulty, rp.sort_order
       FROM room_problems rp
       JOIN problems p ON p.id = rp.problem_id
       WHERE rp.room_id = $1
       ORDER BY rp.sort_order`,
      [id]
    );
    return reply.send({ data: problems });
  });

  // POST /rooms/:id/join
  fastify.post<{ Params: { id: string } }>(
    '/:id/join',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;

      const room = await queryOne<{ id: string; max_participants: number; status: string }>(
        'SELECT id, max_participants, status FROM rooms WHERE id = $1',
        [id]
      );
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.status === 'ended') return reply.code(400).send({ error: 'Room has ended' });

      const [countRow] = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM room_participants WHERE room_id = $1',
        [id]
      );
      if (parseInt(countRow.count, 10) >= room.max_participants) {
        return reply.code(400).send({ error: 'Room is full' });
      }

      await query(
        `INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, userId]
      );

      return reply.send({ data: { joined: true } });
    }
  );

  // DELETE /rooms/:id/leave
  fastify.delete<{ Params: { id: string } }>(
    '/:id/leave',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;

      await query(
        'DELETE FROM room_participants WHERE room_id = $1 AND user_id = $2',
        [id, userId]
      );

      return reply.send({ data: { left: true } });
    }
  );

  // DELETE /rooms/:id — host only
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;

      const room = await queryOne<{ host_id: string }>(
        'SELECT host_id FROM rooms WHERE id = $1',
        [id]
      );
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Only the host can delete this room' });

      // Cascade deletes room_participants and room_problems via FK
      await query('DELETE FROM rooms WHERE id = $1', [id]);

      return reply.send({ data: { deleted: true } });
    }
  );

  // PATCH /rooms/:id/active-problem — host only, broadcast WS message
  fastify.patch<{ Params: { id: string }; Body: { problemId: string } }>(
    '/:id/active-problem',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;
      const { problemId } = request.body;

      const room = await queryOne<{ host_id: string }>(
        'SELECT host_id FROM rooms WHERE id = $1',
        [id]
      );
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Only the host can change the active problem' });

      const problem = await queryOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM problems WHERE id = $1',
        [problemId]
      );
      if (!problem) return reply.code(404).send({ error: 'Problem not found' });

      await query('UPDATE rooms SET problem_id = $1 WHERE id = $2', [problemId, id]);

      broadcastToRoom(id, { type: 'problem-changed', problemId, slug: problem.slug });

      return reply.send({ data: { problemId, slug: problem.slug } });
    }
  );

  // GET /rooms/:id/scoreboard
  fastify.get<{ Params: { id: string } }>('/:id/scoreboard', async (request, reply) => {
    const { id } = request.params;
    const rows = await query<{
      id: string;
      status: string;
      time_ms: number | null;
      language_id: number;
      created_at: string;
      username: string;
      user_id: string;
    }>(
      `SELECT s.id, s.status, s.time_ms, s.language_id, s.created_at, u.username, u.id as user_id
       FROM submissions s JOIN users u ON u.id = s.user_id
       WHERE s.room_id = $1 AND s.problem_id = (SELECT problem_id FROM rooms WHERE id = $1)
       AND s.status = 'accepted'
       ORDER BY s.created_at ASC`,
      [id]
    );
    return reply.send({ data: rows });
  });

  // PATCH /rooms/:id/timer — host only
  fastify.patch<{ Params: { id: string }; Body: { durationMinutes: number } }>(
    '/:id/timer',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;
      const { durationMinutes } = request.body;

      const room = await queryOne<{ host_id: string }>(
        'SELECT host_id FROM rooms WHERE id = $1',
        [id]
      );
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Only the host can set the timer' });

      const endTime = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      await query('UPDATE rooms SET end_time = $1 WHERE id = $2', [endTime, id]);

      broadcastToRoom(id, { type: 'timer-start', endTime });

      return reply.send({ data: { endTime } });
    }
  );

  // PATCH /rooms/:id/status — update room status
  fastify.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/:id/status',
    { preHandler: authenticate },
    async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;
      const { status } = request.body;

      const room = await queryOne<{ host_id: string }>(
        'SELECT host_id FROM rooms WHERE id = $1',
        [id]
      );
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Only the host can update room status' });

      await query('UPDATE rooms SET status = $1 WHERE id = $2', [status, id]);

      broadcastToRoom(id, { type: 'room-status-changed', status });

      return reply.send({ data: { status } });
    }
  );

  // GET /rooms/:id/ws — WebSocket endpoint
  fastify.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/:id/ws',
    { websocket: true } as Parameters<typeof fastify.get>[1],
    (connection: SocketStream, request: FastifyRequest<{ Params: { id: string } }>) => {
      const roomId = request.params.id;
      const ws = connection.socket;

      if (!roomSockets.has(roomId)) {
        roomSockets.set(roomId, new Set());
      }
      roomSockets.get(roomId)!.add(ws);

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as unknown;
          broadcastToRoom(roomId, msg, ws);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        const sockets = roomSockets.get(roomId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) roomSockets.delete(roomId);
        }
      });
    }
  );
}
