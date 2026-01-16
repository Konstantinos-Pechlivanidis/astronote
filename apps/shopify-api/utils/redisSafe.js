import crypto from 'crypto';

export function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

export async function redisGetMany(redis, keys) {
  if (!redis || !keys || keys.length === 0) return [];
  try {
    // Prefer native mget if available (ioredis)
    if (typeof redis.mget === 'function') {
      return await redis.mget(keys);
    }
    // cacheRedis wrapper: try connect() to get ioredis client
    if (typeof redis.connect === 'function') {
      const client = await redis.connect();
      if (client && typeof client.mget === 'function') {
        return await client.mget(keys);
      }
    }
  } catch {
    // fall through to per-key
  }
  return await Promise.all(keys.map(k => redis.get(k)));
}

export async function redisSetExBestEffort(redis, key, ttlSeconds, value) {
  if (!redis) return;
  try {
    if (typeof redis.setex === 'function') {
      await redis.setex(key, ttlSeconds, value);
      return;
    }
    if (typeof redis.setEx === 'function') {
      await redis.setEx(key, ttlSeconds, value);
      return;
    }
    if (typeof redis.set === 'function') {
      // ioredis supports options { EX, NX }
      try {
        await redis.set(key, value, { EX: ttlSeconds });
      } catch {
        await redis.set(key, value);
      }
    }
  } catch {
    // best-effort
  }
}

