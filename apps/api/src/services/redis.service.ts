import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('Redis error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected');
    });
  }
  return redisClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const val = await redis.get(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  const redis = getRedis();
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export async function incrementRoomUsers(roomId: string): Promise<number> {
  const redis = getRedis();
  return redis.incr(`room:${roomId}:users`);
}

export async function decrementRoomUsers(roomId: string): Promise<number> {
  const redis = getRedis();
  const val = await redis.decr(`room:${roomId}:users`);
  if (val <= 0) {
    await redis.del(`room:${roomId}:users`);
    return 0;
  }
  return val;
}

export async function getRoomUserCount(roomId: string): Promise<number> {
  const redis = getRedis();
  const val = await redis.get(`room:${roomId}:users`);
  return val ? parseInt(val, 10) : 0;
}
