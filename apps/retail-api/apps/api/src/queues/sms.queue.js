// apps/api/src/queues/sms.queue.js
const { Queue } = require('bullmq');
const { getRedisClient } = require('../lib/redis');

let smsQueue = null;
let queueReady = null;
let redisInfo = {};

function formatRedisInfo(connection) {
  if (!connection) {return {};}
  const opts = connection.options || connection.opts || connection.connector?.options || {};
  const host =
    opts.host ||
    opts.hostname ||
    (Array.isArray(opts.servers) ? opts.servers[0]?.host : undefined) ||
    opts.path ||
    'unknown';
  const port = opts.port || (Array.isArray(opts.servers) ? opts.servers[0]?.port : undefined);
  const db = typeof opts.db === 'number' ? opts.db : undefined;
  const tls = Boolean(opts.tls);
  return { host, port, db, tls };
}

if (process.env.QUEUE_DISABLED === '1') {
  console.log('[SMS Queue] Disabled via QUEUE_DISABLED=1');
  module.exports = null;
} else {
  try {
    const connection = getRedisClient();

    if (!connection) {
      const errMsg = '[SMS Queue] Redis client not available (check REDIS_* env or REDIS_URL)';
      console.error(errMsg);
      throw new Error(errMsg);
    } else {

      // Default to 1 attempt to avoid duplicate sends; adjust via env if needed
      const attempts = Number(process.env.QUEUE_ATTEMPTS || 1);
      const backoff = Number(process.env.QUEUE_BACKOFF_MS || 3000);
      const limiter = {
        max: Number(process.env.QUEUE_RATE_MAX || 20),
        duration: Number(process.env.QUEUE_RATE_DURATION_MS || 1000),
      };
      console.log('[SMS Queue] Startup', { attempts, backoff, limiter, redis: redisInfo, queue: 'smsQueue' });

      redisInfo = formatRedisInfo(connection);
      console.log('[QUEUE INIT] SMS Queue using Redis connection', { queue: 'smsQueue', redis: redisInfo, attempts, backoff, limiter });

      // BullMQ can work with a Redis client that connects asynchronously
      // The queue will wait for Redis to be ready before processing jobs
      smsQueue = new Queue('smsQueue', {
        connection,
        defaultJobOptions: {
          attempts,
          backoff: { type: 'exponential', delay: backoff },
          removeOnComplete: 1000,
          removeOnFail: false,
        },
        limiter,
      });

      queueReady = smsQueue.waitUntilReady()
        .then(() => {
          console.log('[QUEUE INIT] smsQueue ready');
          return true;
        })
        .catch((err) => {
          console.error('[QUEUE INIT] smsQueue waitUntilReady failed:', err.message);
          throw err;
        });

      // Log when queue is ready (after Redis connects)
      if (connection.status === 'ready') {
        console.log('[SMS Queue] Ready');
      } else {
        connection.once('ready', () => {
          console.log('[SMS Queue] Ready');
        });
      }
    }
  } catch (e) {
    console.warn('[SMS Queue] Initialization failed:', e.message);
    smsQueue = null;
    queueReady = null;
  }
}

module.exports = smsQueue;
if (smsQueue) {
  module.exports.queueReady = queueReady;
}
