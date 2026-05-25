import { FastifyInstance, FastifyRequest } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import { query, queryOne } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import type { Room, RoomStatus, CreateRoomRequest } from '@vyro/types';
import {
  publishToRoom,
  subscribeToRoom,
  setPresence,
  getPresence,
  removePresence,
  getRoomState,
  setRoomState,
  type UserPresence,
} from '../services/pubsub.service.js';

// ── Avatar colors for live cursors ────────────────────────────────────────────

const CURSOR_COLORS = [
  '#828fff', '#27a644', '#f59e0b', '#e5534b', '#06b6d4',
  '#a78bfa', '#fb7185', '#34d399', '#fbbf24', '#60a5fa',
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// ── In-process WebSocket registry (per API instance) ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roomSockets = new Map<string, Map<string, any>>(); // roomId → Map<userId, ws>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function broadcastLocal(roomId: string, data: unknown, excludeUserId?: string): void {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  const payload = JSON.stringify(data);
  for (const [uid, ws] of sockets) {
    if (uid !== excludeUserId && ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToUser(roomId: string, userId: string, data: unknown): void {
  const ws = roomSockets.get(roomId)?.get(userId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// ── DB helpers ─────────────────────────────────────────────────────────────────

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          difficulty: row.problem_difficulty as never,
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

async function assignDefaultProblems(roomId: string): Promise<void> {
  const easy   = await query<{ id: string }>(`SELECT id FROM problems WHERE difficulty = 'easy'   ORDER BY created_at LIMIT 5`);
  const medium = await query<{ id: string }>(`SELECT id FROM problems WHERE difficulty = 'medium' ORDER BY created_at LIMIT 3`);
  const hard   = await query<{ id: string }>(`SELECT id FROM problems WHERE difficulty = 'hard'   ORDER BY created_at LIMIT 2`);
  const all = [...easy, ...medium, ...hard];
  for (let i = 0; i < all.length; i++) {
    await query(
      `INSERT INTO room_problems (room_id, problem_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [roomId, all[i].id, i]
    );
  }
  if (easy.length > 0) {
    await query(`UPDATE rooms SET problem_id = $1 WHERE id = $2`, [easy[0].id, roomId]);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function roomsRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /rooms
  fastify.get<{ Querystring: { status?: string; page?: string } }>('/', async (request, reply) => {
    const { status = 'waiting', page = '1' } = request.query;
    const offset = (parseInt(page, 10) - 1) * 20;
    const rows = await query<DbRoom>(
      `SELECT ${ROOM_SELECT} WHERE r.is_public = true AND r.status = $1
       GROUP BY r.id, u.username, p.slug, p.title, p.difficulty
       ORDER BY r.created_at DESC LIMIT 20 OFFSET $2`,
      [status, offset]
    );
    return reply.send({ data: rows.map(toRoom) });
  });

  // POST /rooms
  fastify.post<{ Body: CreateRoomRequest }>('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { name, isPublic = true, maxParticipants = 4 } = request.body;
    const [roomRow] = await query<{ id: string }>(
      `INSERT INTO rooms (name, host_id, is_public, max_participants) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, userId, isPublic, maxParticipants]
    );
    await query(`INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [roomRow.id, userId]);
    await assignDefaultProblems(roomRow.id);
    const room = await queryOne<DbRoom>(
      `SELECT ${ROOM_SELECT} WHERE r.id = $1 GROUP BY r.id, u.username, p.slug, p.title, p.difficulty`,
      [roomRow.id]
    );
    return reply.code(201).send({ data: toRoom(room!) });
  });

  // GET /rooms/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const room = await queryOne<DbRoom>(
      `SELECT ${ROOM_SELECT} WHERE r.id = $1 GROUP BY r.id, u.username, p.slug, p.title, p.difficulty`,
      [id]
    );
    if (!room) return reply.code(404).send({ error: 'Room not found' });

    const participants = await query<{ user_id: string; username: string; joined_at: string; language_id: number }>(
      `SELECT rp.user_id, u.username, rp.joined_at, rp.language_id
       FROM room_participants rp JOIN users u ON u.id = rp.user_id WHERE rp.room_id = $1`,
      [id]
    );
    const problems = await query<{ id: string; slug: string; title: string; difficulty: string; sort_order: number }>(
      `SELECT p.id, p.slug, p.title, p.difficulty, rp.sort_order
       FROM room_problems rp JOIN problems p ON p.id = rp.problem_id WHERE rp.room_id = $1 ORDER BY rp.sort_order`,
      [id]
    );

    // Include Redis room state
    const state = await getRoomState(id);

    return reply.send({
      data: {
        ...toRoom(room),
        participants: participants.map((p) => ({
          roomId: id, userId: p.user_id,
          user: { id: p.user_id, username: p.username },
          joinedAt: p.joined_at, languageId: p.language_id,
        })),
        problems,
        state,
      },
    });
  });

  // GET /rooms/:id/problems
  fastify.get<{ Params: { id: string } }>('/:id/problems', async (request, reply) => {
    const { id } = request.params;
    const problems = await query<{ id: string; slug: string; title: string; difficulty: string; sort_order: number }>(
      `SELECT p.id, p.slug, p.title, p.difficulty, rp.sort_order
       FROM room_problems rp JOIN problems p ON p.id = rp.problem_id WHERE rp.room_id = $1 ORDER BY rp.sort_order`,
      [id]
    );
    return reply.send({ data: problems });
  });

  // GET /rooms/:id/presence — live user presence
  fastify.get<{ Params: { id: string } }>('/:id/presence', async (request, reply) => {
    const { id } = request.params;
    const presence = await getPresence(id);
    return reply.send({ data: presence });
  });

  // GET /rooms/:id/state — room state from Redis
  fastify.get<{ Params: { id: string } }>('/:id/state', async (request, reply) => {
    const { id } = request.params;
    const state = await getRoomState(id);
    return reply.send({ data: state });
  });

  // POST /rooms/:id/join
  fastify.post<{ Params: { id: string } }>('/:id/join', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params;
    const room = await queryOne<{ id: string; max_participants: number; status: string }>(
      'SELECT id, max_participants, status FROM rooms WHERE id = $1', [id]
    );
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.status === 'ended') return reply.code(400).send({ error: 'Room has ended' });
    const [countRow] = await query<{ count: string }>('SELECT COUNT(*) as count FROM room_participants WHERE room_id = $1', [id]);
    if (parseInt(countRow.count, 10) >= room.max_participants) return reply.code(400).send({ error: 'Room is full' });
    await query(`INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId]);
    return reply.send({ data: { joined: true } });
  });

  // DELETE /rooms/:id/leave
  fastify.delete<{ Params: { id: string } }>('/:id/leave', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params;
    await query('DELETE FROM room_participants WHERE room_id = $1 AND user_id = $2', [id, userId]);
    await removePresence(id, userId);
    await publishToRoom(id, { type: 'room-leave', userId });
    return reply.send({ data: { left: true } });
  });

  // DELETE /rooms/:id
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params;
    const room = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE id = $1', [id]);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.host_id !== userId) return reply.code(403).send({ error: 'Only the host can delete this room' });
    await query('DELETE FROM rooms WHERE id = $1', [id]);
    await publishToRoom(id, { type: 'room-closed' });
    return reply.send({ data: { deleted: true } });
  });

  // PATCH /rooms/:id/active-problem
  fastify.patch<{ Params: { id: string }; Body: { problemId: string } }>(
    '/:id/active-problem', { preHandler: authenticate }, async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;
      const { problemId } = request.body;
      const room = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE id = $1', [id]);
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Host only' });
      const problem = await queryOne<{ id: string; slug: string }>('SELECT id, slug FROM problems WHERE id = $1', [problemId]);
      if (!problem) return reply.code(404).send({ error: 'Problem not found' });
      await query('UPDATE rooms SET problem_id = $1 WHERE id = $2', [problemId, id]);
      await setRoomState(id, { activeProblemId: problemId, sharedCode: {} });
      await publishToRoom(id, { type: 'problem-changed', problemId, slug: problem.slug });
      return reply.send({ data: { problemId, slug: problem.slug } });
    }
  );

  // PATCH /rooms/:id/timer
  fastify.patch<{ Params: { id: string }; Body: { durationMinutes: number } }>(
    '/:id/timer', { preHandler: authenticate }, async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;
      const { durationMinutes } = request.body;
      const room = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE id = $1', [id]);
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Host only' });
      const timerEnd = Date.now() + durationMinutes * 60 * 1000;
      await setRoomState(id, { timerEnd });
      await publishToRoom(id, { type: 'timer-start', timerEnd });
      return reply.send({ data: { endTime: new Date(timerEnd).toISOString() } });
    }
  );

  // PATCH /rooms/:id/status
  fastify.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/:id/status', { preHandler: authenticate }, async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;
      const { status } = request.body;
      const room = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE id = $1', [id]);
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Host only' });
      await query('UPDATE rooms SET status = $1 WHERE id = $2', [status, id]);
      await publishToRoom(id, { type: 'room-status-changed', status });
      return reply.send({ data: { status } });
    }
  );

  // PATCH /rooms/:id/mode — set room mode (practice/contest/pair)
  fastify.patch<{ Params: { id: string }; Body: { mode: 'practice' | 'contest' | 'pair' } }>(
    '/:id/mode', { preHandler: authenticate }, async (request, reply) => {
      const { userId } = request.user as { userId: string };
      const { id } = request.params;
      const { mode } = request.body;
      const room = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE id = $1', [id]);
      if (!room) return reply.code(404).send({ error: 'Room not found' });
      if (room.host_id !== userId) return reply.code(403).send({ error: 'Host only' });
      await setRoomState(id, { mode });
      await publishToRoom(id, { type: 'mode-changed', mode });
      return reply.send({ data: { mode } });
    }
  );

  // GET /rooms/:id/scoreboard
  fastify.get<{ Params: { id: string } }>('/:id/scoreboard', async (request, reply) => {
    const { id } = request.params;
    const rows = await query<{
      id: string; status: string; time_ms: number | null;
      language_id: number; created_at: string; username: string; user_id: string;
    }>(
      `SELECT s.id, s.status, s.time_ms, s.language_id, s.created_at, u.username, u.id as user_id
       FROM submissions s JOIN users u ON u.id = s.user_id
       WHERE s.room_id = $1 AND s.problem_id = (SELECT problem_id FROM rooms WHERE id = $1)
       AND s.status = 'accepted' ORDER BY s.created_at ASC`,
      [id]
    );
    return reply.send({ data: rows });
  });

  // ── WebSocket /:id/ws ────────────────────────────────────────────────────────

  fastify.get<{ Params: { id: string }; Querystring: { token?: string } }>(
    '/:id/ws',
    { websocket: true } as Parameters<typeof fastify.get>[1],
    async (connection: SocketStream, request: FastifyRequest<{ Params: { id: string }; Querystring: { token?: string } }>) => {
      const roomId = request.params.id;
      const ws = connection.socket;

      // ── Auth via token query param ─────────────────────────────────────────
      let userId = 'anon';
      let username = 'Anonymous';
      const token = request.query.token;
      if (token) {
        try {
          const decoded = fastify.jwt.verify(token) as { userId: string; username?: string };
          userId = decoded.userId;
          // Fetch username from DB
          const u = await queryOne<{ username: string }>('SELECT username FROM users WHERE id = $1', [userId]);
          if (u) username = u.username;
        } catch {
          // Invalid token — allow as anon
        }
      }

      const userColor = pickColor(userId);

      // ── Register socket ─────────────────────────────────────────────────────
      if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Map());
      roomSockets.get(roomId)!.set(userId, ws);

      // ── Set initial presence ────────────────────────────────────────────────
      const initialPresence: UserPresence = {
        userId, username, color: userColor,
        language: 93, isTyping: false, lastSeen: Date.now(),
      };
      await setPresence(roomId, initialPresence);

      // ── Subscribe to Redis pub/sub for this room ────────────────────────────
      // (forwards events published from OTHER API instances to local WS clients)
      const unsubscribe = subscribeToRoom(roomId, (event) => {
        // Don't re-broadcast events that came from this socket
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(event));
        }
      });

      // ── Announce join to room ───────────────────────────────────────────────
      const joinEvent = { type: 'room-join', userId, username, color: userColor };
      broadcastLocal(roomId, joinEvent, userId); // local
      await publishToRoom(roomId, joinEvent);    // other instances

      // ── Send current room state to the new joiner ───────────────────────────
      const [roomState, presence] = await Promise.all([
        getRoomState(roomId),
        getPresence(roomId),
      ]);
      ws.send(JSON.stringify({
        type: 'room-state',
        state: roomState,
        presence,
      }));

      // ── Heartbeat — refresh presence every 10s ──────────────────────────────
      const heartbeatInterval = setInterval(async () => {
        if (ws.readyState !== ws.OPEN) { clearInterval(heartbeatInterval); return; }
        await setPresence(roomId, { ...initialPresence, lastSeen: Date.now() });
      }, 10_000);

      // ── Message handler ─────────────────────────────────────────────────────
      ws.on('message', async (raw: Buffer) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(raw.toString()) as Record<string, unknown>; }
        catch { return; }

        const type = msg.type as string;

        switch (type) {
          // ── Code sync (Yjs delta or full snapshot) ─────────────────────────
          case 'code-update': {
            const { code, language: lang } = msg as { code: string; language: number };
            // Store in Redis room state
            const state = await getRoomState(roomId);
            state.sharedCode[String(lang)] = code;
            await setRoomState(roomId, { sharedCode: state.sharedCode });
            // Broadcast delta to others
            const broadcast = { type: 'code-update', code, language: lang, userId, username };
            broadcastLocal(roomId, broadcast, userId);
            await publishToRoom(roomId, broadcast);
            break;
          }

          // ── Cursor position ────────────────────────────────────────────────
          case 'cursor-update': {
            const { line, column, language: lang } = msg as { line: number; column: number; language: number };
            const broadcast = { type: 'cursor-update', userId, username, color: userColor, line, column, language: lang };
            broadcastLocal(roomId, broadcast, userId);
            // Cursor updates are high-frequency — don't Redis-broadcast to avoid flooding
            break;
          }

          // ── Typing indicator ───────────────────────────────────────────────
          case 'typing': {
            const { isTyping } = msg as { isTyping: boolean };
            await setPresence(roomId, { ...initialPresence, isTyping, lastSeen: Date.now() });
            const broadcast = { type: 'typing', userId, username, isTyping };
            broadcastLocal(roomId, broadcast, userId);
            await publishToRoom(roomId, broadcast);
            break;
          }

          // ── Chat message ───────────────────────────────────────────────────
          case 'chat': {
            const { text } = msg as { text: string };
            if (!text?.trim() || text.length > 500) break;
            const broadcast = {
              type: 'chat', userId, username, color: userColor,
              text: text.trim(), ts: Date.now(),
            };
            broadcastLocal(roomId, broadcast, userId);
            await publishToRoom(roomId, broadcast);
            break;
          }

          // ── Execution events ───────────────────────────────────────────────
          case 'execution-start': {
            const broadcast = { type: 'execution-start', userId, username };
            broadcastLocal(roomId, broadcast, userId);
            await publishToRoom(roomId, broadcast);
            break;
          }

          case 'execution-complete': {
            const { status, testsPassed, testsTotal, timeMs } = msg as {
              status: string; testsPassed: number; testsTotal: number; timeMs?: number;
            };
            const broadcast = { type: 'execution-complete', userId, username, status, testsPassed, testsTotal, timeMs };
            broadcastLocal(roomId, broadcast, userId);
            await publishToRoom(roomId, broadcast);
            break;
          }

          case 'submission-result': {
            const { submissionId, status, timeMs, memoryKb } = msg as {
              submissionId: string; status: string; timeMs?: number; memoryKb?: number;
            };
            const broadcast = { type: 'submission-result', userId, username, submissionId, status, timeMs, memoryKb };
            broadcastLocal(roomId, broadcast, userId);
            await publishToRoom(roomId, broadcast);
            break;
          }

          // ── Voice/WebRTC signaling ──────────────────────────────────────────
          case 'voice-join': {
            const broadcast = { type: 'voice-join', userId, username };
            broadcastLocal(roomId, broadcast, userId);
            break;
          }
          case 'voice-leave': {
            const broadcast = { type: 'voice-leave', userId };
            broadcastLocal(roomId, broadcast, userId);
            break;
          }
          case 'voice-offer': {
            const { to, payload } = msg as { to: string; payload: unknown };
            sendToUser(roomId, to, { type: 'voice-offer', from: userId, payload });
            break;
          }
          case 'voice-answer': {
            const { to, payload } = msg as { to: string; payload: unknown };
            sendToUser(roomId, to, { type: 'voice-answer', from: userId, payload });
            break;
          }
          case 'voice-ice': {
            const { to, payload } = msg as { to: string; payload: unknown };
            sendToUser(roomId, to, { type: 'voice-ice', from: userId, payload });
            break;
          }
          case 'voice-mute': {
            const { muted } = msg as { muted: boolean };
            broadcastLocal(roomId, { type: 'voice-mute', userId, muted }, userId);
            break;
          }

          // ── Language change ────────────────────────────────────────────────
          case 'language-change': {
            const { language: lang } = msg as { language: number };
            await setPresence(roomId, { ...initialPresence, language: lang });
            broadcastLocal(roomId, { type: 'language-change', userId, language: lang }, userId);
            break;
          }

          // ── Heartbeat ping ─────────────────────────────────────────────────
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
            await setPresence(roomId, { ...initialPresence, lastSeen: Date.now() });
            break;
          }

          // ── Reaction ───────────────────────────────────────────────────────
          case 'reaction': {
            const { emoji } = msg as { emoji: string };
            if (!emoji) break;
            broadcastLocal(roomId, { type: 'reaction', userId, username, emoji }, userId);
            break;
          }

          default:
            // Forward unknown event types as-is (extensible)
            broadcastLocal(roomId, { ...msg, userId }, userId);
        }
      });

      // ── Close handler ───────────────────────────────────────────────────────
      ws.on('close', async () => {
        clearInterval(heartbeatInterval);
        unsubscribe();

        const sockets = roomSockets.get(roomId);
        if (sockets) {
          sockets.delete(userId);
          if (sockets.size === 0) roomSockets.delete(roomId);
        }

        await removePresence(roomId, userId);

        const leaveEvent = { type: 'room-leave', userId, username };
        broadcastLocal(roomId, leaveEvent);
        await publishToRoom(roomId, leaveEvent);
      });

      ws.on('error', () => {
        // Handled by close event
      });
    }
  );
}
