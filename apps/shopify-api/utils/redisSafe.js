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

export async function redisSetNxWithTtl(redis, key, ttlSeconds, value = '1') {
  if (!redis) return true; // fail open to avoid blocking execution
  try {
    if (typeof redis.set === 'function') {
      // ioredis/new redis support options object
      const res = await redis.set(key, value, { NX: true, EX: ttlSeconds });
      return res === 'OK';
    }
    if (typeof redis.connect === 'function') {
      const client = await redis.connect();
      if (client?.set) {
        const res = await client.set(key, value, { NX: true, EX: ttlSeconds });
        return res === 'OK';
      }
    }
  } catch {
    // fall back to manual check for simple mocks (used in tests)
  }

  try {
    const exists =
      typeof redis.exists === 'function'
        ? await redis.exists(key)
        : typeof redis.get === 'function'
          ? (await redis.get(key)) !== null
          : false;
    if (exists) return false;
    if (typeof redis.setex === 'function') {
      await redis.setex(key, ttlSeconds, value);
      return true;
    }
    if (typeof redis.setEx === 'function') {
      await redis.setEx(key, ttlSeconds, value);
      return true;
    }
    if (typeof redis.set === 'function') {
      await redis.set(key, value);
      return true;
    }
  } catch {
    // best-effort, allow processing
  }
  return true;
}

export async function redisDelMany(redis, keys) {
  if (!redis || !keys || keys.length === 0) return;
  try {
    if (typeof redis.del === 'function') {
      await redis.del(...keys);
      return;
    }
    if (typeof redis.connect === 'function') {
      const client = await redis.connect();
      if (client?.del) {
        await client.del(...keys);
        return;
      }
    }
  } catch {
    // fall through
  }

  // Fallback loop
  try {
    await Promise.all(
      keys.map(async key => {
        try {
          if (typeof redis.del === 'function') {
            await redis.del(key);
          }
        } catch {
          // ignore
        }
      }),
    );
  } catch {
    // swallow
  }
}
