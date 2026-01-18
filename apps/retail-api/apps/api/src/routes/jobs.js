// apps/api/src/routes/jobs.js
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const smsQueue = require('../queues/sms.queue');
const schedulerQueue = require('../queues/scheduler.queue');
const statusRefreshQueue = require('../queues/statusRefresh.queue');
const router = express.Router();

router.get('/jobs/health', requireAuth, async (_req, res, next) => {
  try {
    const out = {};
    const formatRedisInfo = (queue) => {
      if (!queue) {
        return null;
      }
      const conn = queue.opts?.connection || queue.client;
      const opts = conn?.options || conn?.opts || conn?.connector?.options || {};
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
    };

    if (smsQueue) {
      out.sms = {
        counts: await smsQueue.getJobCounts(),
        redis: formatRedisInfo(smsQueue),
      };
    } else {
      out.sms = 'disabled';
    }

    if (schedulerQueue) {
      const counts = await schedulerQueue.getJobCounts();
      out.scheduler = counts;

      // Also get waiting/delayed jobs for debugging
      const waiting = await schedulerQueue.getWaiting();
      const delayed = await schedulerQueue.getDelayed();
      const active = await schedulerQueue.getActive();
      const failed = await schedulerQueue.getFailed();

      out.schedulerDetails = {
        waiting: waiting.length,
        delayed: delayed.length,
        active: active.length,
        failed: failed.length,
        waitingJobs: waiting.slice(0, 5).map(j => ({
          id: j.id,
          name: j.name,
          data: j.data,
          opts: j.opts,
        })),
        delayedJobs: delayed.slice(0, 5).map(j => ({
          id: j.id,
          name: j.name,
          data: j.data,
          delay: j.opts?.delay,
          timestamp: j.timestamp,
        })),
      };
    } else {
      out.scheduler = 'disabled';
    }

    if (statusRefreshQueue) {
      const counts = await statusRefreshQueue.getJobCounts();
      out.statusRefresh = counts;
    } else {
      out.statusRefresh = 'disabled';
    }

    res.json(out);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
