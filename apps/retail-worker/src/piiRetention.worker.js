// apps/worker/src/piiRetention.worker.js
// PII Retention Worker - Runs scheduled cleanup to anonymize old PII data

require('dotenv').config();

const pino = require('pino');
const logger = pino({ name: 'pii-retention-worker' });

const { runPiiRetentionCleanup } = require('../../retail-api/src/services/piiRetention.service');
const env = require('../../retail-api/src/config/env');

/**
 * Run PII retention cleanup
 * Should be called daily via cron or scheduled task
 */
async function runPiiRetention() {
  const retentionDays = env.PII_RETENTION_DAYS || 90;

  logger.info({ retentionDays }, 'Starting PII retention cleanup job');

  try {
    const results = await runPiiRetentionCleanup(retentionDays);

    logger.info({
      retentionDays,
      results: {
        offerViewEvents: results.offerViewEvents,
        conversionEvents: results.conversionEvents,
        nfcScans: results.nfcScans,
        durationMs: results.durationMs
      }
    }, 'PII retention cleanup job completed successfully');

    return results;
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'PII retention cleanup job failed');
    throw err;
  }
}

// Run immediately on startup (for testing/manual runs)
if (process.env.RUN_PII_RETENTION_ON_START === '1') {
  runPiiRetention()
    .then(() => {
      logger.info('PII retention cleanup completed');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'PII retention cleanup failed');
      process.exit(1);
    });
} else {
  // For production, this should be called via a cron job or scheduled task
  // Example cron: 0 2 * * * (2 AM daily)
  // Or use node-cron, node-schedule, or a cloud scheduler (AWS EventBridge, etc.)
  logger.info('PII retention worker started. Use RUN_PII_RETENTION_ON_START=1 for manual run, or schedule via cron.');
  
  // Keep process alive if needed for cron integration
  // For now, exit (cron will restart it)
  process.exit(0);
}

module.exports = { runPiiRetention };

