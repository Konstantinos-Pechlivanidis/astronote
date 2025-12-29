/**
 * Metrics Endpoint (P1)
 * Exposes Prometheus-compatible metrics
 */

import { Router } from 'express';
import { metrics } from '../utils/metrics.js';
import { getQueueHealth } from '../queue/index.js';
import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
import { CampaignStatus } from '../utils/prismaEnums.js';

const r = Router();

/**
 * GET /metrics
 * Prometheus-compatible metrics endpoint
 */
r.get('/', async (req, res) => {
  try {
    const allMetrics = metrics.getAllMetrics();
    const queueHealth = await getQueueHealth();

    // Convert to Prometheus format
    const prometheusLines = [];

    // Counters
    for (const [key, value] of Object.entries(allMetrics.counters || {})) {
      prometheusLines.push(`# TYPE ${key} counter`);
      prometheusLines.push(`${key} ${value}`);
    }

    // Gauges
    for (const [key, value] of Object.entries(allMetrics.gauges || {})) {
      prometheusLines.push(`# TYPE ${key} gauge`);
      prometheusLines.push(`${key} ${value}`);
    }

    // Queue metrics
    if (queueHealth.sms) {
      prometheusLines.push('# TYPE queue_sms_waiting gauge');
      prometheusLines.push(`queue_sms_waiting ${queueHealth.sms.waiting || 0}`);
    }
    if (queueHealth.campaign) {
      prometheusLines.push('# TYPE queue_campaign_waiting gauge');
      prometheusLines.push(`queue_campaign_waiting ${queueHealth.campaign.waiting || 0}`);
    }
    if (queueHealth.automation) {
      prometheusLines.push('# TYPE queue_automation_waiting gauge');
      prometheusLines.push(`queue_automation_waiting ${queueHealth.automation.waiting || 0}`);
    }

    // Campaign status metrics
    try {
      const campaignCounts = await prisma.campaign.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      for (const count of campaignCounts) {
        prometheusLines.push('# TYPE campaigns_total gauge');
        prometheusLines.push(`campaigns_total{status="${count.status}"} ${count._count.id}`);
      }

      // Stuck campaigns (sending for > 15 minutes)
      const stuckThreshold = new Date(Date.now() - 15 * 60 * 1000);
      const stuckCount = await prisma.campaign.count({
        where: {
          status: CampaignStatus.sending,
          updatedAt: { lt: stuckThreshold },
        },
      });
      prometheusLines.push('# TYPE campaigns_stuck gauge');
      prometheusLines.push(`campaigns_stuck ${stuckCount}`);
    } catch (err) {
      logger.warn('Failed to fetch campaign metrics', { error: err.message });
    }

    // Credit reservation metrics
    try {
      const activeReservations = await prisma.creditReservation.count({
        where: { status: 'active' },
      });
      const expiredReservations = await prisma.creditReservation.count({
        where: {
          status: 'active',
          expiresAt: { lt: new Date() },
        },
      });

      prometheusLines.push('# TYPE credit_reservations_active gauge');
      prometheusLines.push(`credit_reservations_active ${activeReservations}`);
      prometheusLines.push('# TYPE credit_reservations_expired gauge');
      prometheusLines.push(`credit_reservations_expired ${expiredReservations}`);
    } catch (err) {
      logger.warn('Failed to fetch reservation metrics', { error: err.message });
    }

    // Webhook event metrics
    try {
      const webhookFailures = await prisma.webhookEvent.count({
        where: { status: 'failed' },
      });
      prometheusLines.push('# TYPE webhook_events_failed_total counter');
      prometheusLines.push(`webhook_events_failed_total ${webhookFailures}`);
    } catch (err) {
      // WebhookEvent table might not exist yet
    }

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(`${prometheusLines.join('\n')}\n`);
  } catch (error) {
    logger.error('Metrics endpoint error', { error: error.message });
    res.status(500).send(`# ERROR: ${error.message}\n`);
  }
});

export default r;

