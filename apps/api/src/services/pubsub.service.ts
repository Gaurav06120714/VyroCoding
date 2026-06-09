import { env } from '../config/env.js';

import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const REDIS_URL = env.REDIS_URL;

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export function getPubClient(): Redis {
  if (!pubClient) {
    pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
    pubClient.on('error', (e) => console.error('[pub] Redis error:', e.message));
  }
  return pubClient;
}

export function getSubClient(): Redis {
  if (!subClient) {
    subClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
    subClient.on('error', (e) => console.error('[sub] Redis error:', e.message));
  }
  return subClient;
}

export function roomChannel(roomId: string): string {
  return `room:${roomId}:events`;
}

export async function publishToRoom(roomId: string, event: object): Promise<void> {
  try {
    await getPubClient().publish(roomChannel(roomId), JSON.stringify(event));
  } catch (err) {
    console.error('[pubsub] publish error:', err);
  }
}

export function subscribeToRoom(
  roomId: string,
  handler: (event: unknown) => void
): () => void {
  const channel = roomChannel(roomId);
  const sub = getSubClient();

  sub.subscribe(channel, (err) => {
    if (err) console.error('[pubsub] subscribe error:', err);
  });

  const listener = (ch: string, msg: string) => {
    if (ch !== channel) return;
    try {
      handler(JSON.parse(msg));
    } catch {
      
    }
  };

  sub.on('message', listener);

  return () => {
    sub.unsubscribe(channel);
    sub.off('message', listener);
  };
}

export interface RoomStateRedis {
  activeProblemId: string | null;
  timerEnd: number | null;          
  mode: 'practice' | 'contest' | 'pair';
  sharedCode: Record<string, string>; 
  lockedBy: string | null;           
}

const STATE_TTL = 60 * 60 * 4; 

export async function getRoomState(roomId: string): Promise<RoomStateRedis> {
  const { getRedis } = await import('./redis.service.js');
  const raw = await getRedis().get(`room:${roomId}:state`);
  if (raw) {
    try { return JSON.parse(raw) as RoomStateRedis; } catch {  }
  }
  return {
    activeProblemId: null,
    timerEnd: null,
    mode: 'practice',
    sharedCode: {},
    lockedBy: null,
  };
}

export async function setRoomState(
  roomId: string,
  patch: Partial<RoomStateRedis>
): Promise<RoomStateRedis> {
  const { getRedis } = await import('./redis.service.js');
  const current = await getRoomState(roomId);
  const next = { ...current, ...patch };
  await getRedis().setex(`room:${roomId}:state`, STATE_TTL, JSON.stringify(next));
  return next;
}

export interface UserPresence {
  userId: string;
  username: string;
  color: string;
  language: number;
  isTyping: boolean;
  lastSeen: number;
}

const PRESENCE_TTL = 30; 

export async function setPresence(roomId: string, presence: UserPresence): Promise<void> {
  const { getRedis } = await import('./redis.service.js');
  await getRedis().setex(
    `room:${roomId}:presence:${presence.userId}`,
    PRESENCE_TTL,
    JSON.stringify(presence)
  );
}

export async function getPresence(roomId: string): Promise<UserPresence[]> {
  const { getRedis } = await import('./redis.service.js');
  const redis = getRedis();
  const keys = await redis.keys(`room:${roomId}:presence:*`);
  if (!keys.length) return [];
  const vals = await redis.mget(...keys);
  return vals
    .filter(Boolean)
    .map((v) => {
      try { return JSON.parse(v!) as UserPresence; } catch { return null; }
    })
    .filter(Boolean) as UserPresence[];
}

export async function removePresence(roomId: string, userId: string): Promise<void> {
  const { getRedis } = await import('./redis.service.js');
  await getRedis().del(`room:${roomId}:presence:${userId}`);
}
