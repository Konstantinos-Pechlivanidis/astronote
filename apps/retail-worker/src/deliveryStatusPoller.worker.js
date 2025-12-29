// apps/worker/src/deliveryStatusPoller.worker.js
// Fallback poller job for delivery status updates
// Polls Mitto API for messages with status='submitted' that haven't received DLR

require('dotenv').config();

const pino = require('pino');
const logger = pino({ name: 'delivery-status-poller' });

if (process.env.QUEUE_DISABLED === '1') {
  logger.warn('Disabled via QUEUE_DISABLED=1');
  process.exit(0);
}

const { Worker } = require('bullmq');
const { getRedisClient } = require('../../retail-api/src/lib/redis');
const prisma = require('../../retail-api/src/lib/prisma');
const { getMessageStatus } = require('../../retail-api/src/services/mitto.service');

const connection = getRedisClient();

if (!connection) {
  logger.warn('Redis client could not be created, delivery status poller disabled');
  process.exit(0);
}

logger.info('Starting delivery status poller worker (Redis will connect on first use)...');

const concurrency = Number(process.env.DELIVERY_STATUS_POLLER_CONCURRENCY || 1);

// Map Mitto deliveryStatus to our internal status
function mapMittoStatus(mittoStatus) {
  if (!mittoStatus) return 'unknown';
  const s = String(mittoStatus).toLowerCase().trim();
  if (s === 'delivered' || s === 'delivrd' || s === 'completed' || s === 'ok') {
    return 'sent';
  }
  if (s === 'failure' || s === 'failed' || s === 'undelivered' || s === 'expired' || s === 'rejected' || s === 'error') {
    return 'failed';
  }
  if (s === 'sent' || s === 'queued' || s === 'accepted' || s === 'submitted' || s === 'enroute') {
    return 'sent';
  }
  return 'unknown';
}

const worker = new Worker(
  'deliveryStatusPollerQueue',
  async (job) => {
    if (job.name !== 'pollDeliveryStatus') {
      logger.warn({ jobId: job.id, jobName: job.name }, 'Unknown job name, skipping');
      return;
    }

    const { limit = 50, olderThanMinutes = 10 } = job.data || {};
    
    logger.info({ 
      jobId: job.id, 
      limit, 
      olderThanMinutes 
    }, 'Polling delivery status for submitted messages');

    try {
      // Find messages with status='submitted' older than X minutes
      const olderThan = new Date(Date.now() - olderThanMinutes * 60 * 1000);
      
      const messages = await prisma.campaignMessage.findMany({
        where: {
          status: 'submitted',
          providerMessageId: { not: null },
          submittedAt: { lte: olderThan }
        },
        take: limit,
        orderBy: { submittedAt: 'asc' },
        select: {
          id: true,
          campaignId: true,
          ownerId: true,
          providerMessageId: true,
          deliveryStatus: true
        }
      });

      if (messages.length === 0) {
        logger.info({ jobId: job.id }, 'No submitted messages to poll');
        return;
      }

      logger.info({ 
        jobId: job.id, 
        messageCount: messages.length 
      }, 'Polling delivery status from Mitto');

      let updated = 0;
      let errors = 0;
      const affectedCampaigns = new Set();

      // Poll each message (with rate limiting)
      for (const msg of messages) {
        try {
          // Rate limit: wait 100ms between requests
          if (messages.indexOf(msg) > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const mittoStatus = await getMessageStatus(msg.providerMessageId);
          const mappedStatus = mapMittoStatus(mittoStatus.deliveryStatus);
          
          if (mappedStatus === 'sent') {
            const updateData = {
              status: 'sent',
              sentAt: mittoStatus.updatedAt ? new Date(mittoStatus.updatedAt) : new Date(),
              deliveryStatus: mittoStatus.deliveryStatus?.toLowerCase() || null,
              updatedAt: new Date()
            };
            
            if (mittoStatus.deliveryStatus && (mittoStatus.deliveryStatus.toLowerCase() === 'delivered' || mittoStatus.deliveryStatus.toLowerCase() === 'delivrd')) {
              updateData.deliveredAt = mittoStatus.updatedAt ? new Date(mittoStatus.updatedAt) : new Date();
            }
            
            await prisma.campaignMessage.updateMany({
              where: {
                id: msg.id,
                campaignId: msg.campaignId,
                ownerId: msg.ownerId,
                status: 'submitted' // Only update if still submitted
              },
              data: updateData
            });
            updated++;
            affectedCampaigns.add(`${msg.campaignId}:${msg.ownerId}`);
            
            logger.debug({ 
              messageId: msg.id, 
              providerMessageId: msg.providerMessageId,
              deliveryStatus: mittoStatus.deliveryStatus 
            }, 'Updated message status from poller');
          } else if (mappedStatus === 'failed') {
            await prisma.campaignMessage.updateMany({
              where: {
                id: msg.id,
                campaignId: msg.campaignId,
                ownerId: msg.ownerId,
                status: 'submitted' // Only update if still submitted
              },
              data: {
                status: 'failed',
                failedAt: mittoStatus.updatedAt ? new Date(mittoStatus.updatedAt) : new Date(),
                deliveryStatus: mittoStatus.deliveryStatus?.toLowerCase() || null,
                error: 'FAILED_POLLER',
                updatedAt: new Date()
              }
            });
            updated++;
            affectedCampaigns.add(`${msg.campaignId}:${msg.ownerId}`);
            
            logger.debug({ 
              messageId: msg.id, 
              providerMessageId: msg.providerMessageId,
              deliveryStatus: mittoStatus.deliveryStatus 
            }, 'Updated message to failed from poller');
          } else {
            // Unknown status - just update deliveryStatus
            await prisma.campaignMessage.updateMany({
              where: {
                id: msg.id,
                campaignId: msg.campaignId,
                ownerId: msg.ownerId,
                status: 'submitted'
              },
              data: {
                deliveryStatus: mittoStatus.deliveryStatus?.toLowerCase() || null,
                updatedAt: new Date()
              }
            });
            logger.debug({ 
              messageId: msg.id, 
              providerMessageId: msg.providerMessageId,
              deliveryStatus: mittoStatus.deliveryStatus 
            }, 'Updated deliveryStatus only (unknown status)');
          }
        } catch (err) {
          errors++;
          logger.warn({ 
            messageId: msg.id, 
            providerMessageId: msg.providerMessageId,
            err: err.message 
          }, 'Failed to poll message status');
          
          // If message not found in Mitto, mark as failed
          if (err.message && err.message.includes('not found')) {
            await prisma.campaignMessage.updateMany({
              where: {
                id: msg.id,
                campaignId: msg.campaignId,
                ownerId: msg.ownerId,
                status: 'submitted'
              },
              data: {
                status: 'failed',
                failedAt: new Date(),
                deliveryStatus: 'not_found',
                error: 'Message not found in Mitto',
                updatedAt: new Date()
              }
            });
            updated++;
            affectedCampaigns.add(`${msg.campaignId}:${msg.ownerId}`);
          }
        }
      }

      // Update campaign aggregates for affected campaigns
      if (affectedCampaigns.size > 0) {
        const { updateCampaignAggregates } = require('../../retail-api/src/services/campaignAggregates.service');
        const updatePromises = Array.from(affectedCampaigns).map(key => {
          const [campaignId, ownerId] = key.split(':').map(Number);
          return updateCampaignAggregates(campaignId, ownerId).catch(err => {
            logger.warn({ campaignId, ownerId, err: err.message }, 'Failed to update campaign aggregates from poller');
          });
        });
        await Promise.all(updatePromises);
      }

      logger.info({ 
        jobId: job.id, 
        total: messages.length,
        updated, 
        errors 
      }, 'Delivery status poll completed');

    } catch (err) {
      logger.error({ 
        jobId: job.id, 
        err: err.message 
      }, 'Delivery status poller job failed');
      throw err;
    }
  },
  { connection, concurrency }
);

worker.on('ready', () => {
  logger.info('Ready and listening for delivery status poll jobs');
});

worker.on('active', (job) => {
  logger.info({ jobId: job.id }, `Processing ${job.name}`);
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, `Completed ${job.name}`);
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err?.message }, `Failed ${job?.name}`);
});

worker.on('error', (err) => {
  logger.error({ err: err.message }, 'Worker error');
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

