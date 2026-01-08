// apps/api/src/queues/scheduler.queue.js
const { Queue } = require('bullmq');
const { getRedisClient } = require('../lib/redis');

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
  console.log('[Scheduler Queue] Disabled via QUEUE_DISABLED=1');
  module.exports = null;
} else {
  const connection = getRedisClient();

  if (!connection) {
    console.warn('[Scheduler Queue] Redis client not available, scheduler queue disabled');
    module.exports = null;
  } else {

    // BullMQ can work with a Redis client that connects asynchronously
    // The queue will wait for Redis to be ready before processing jobs
    const schedulerQueue = new Queue('schedulerQueue', {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    // Log when queue is ready (after Redis connects)
    if (connection.status === 'ready') {
      console.log('[Scheduler Queue] Ready');
    } else {
      connection.once('ready', () => {
        console.log('[Scheduler Queue] Ready');
      });
    }

    console.log('[Scheduler Queue] Using Redis connection', { queue: 'schedulerQueue', redis: formatRedisInfo(connection) });

    module.exports = schedulerQueue;
  }
}
