const { Router } = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/requireAuth');
const pino = require('pino');
const logger = pino({ name: 'tracking-route' });

// Rate limit helpers (Redis-backed if REDIS_URL set, else per-process memory)
const { createLimiter, rateLimitByIp, rateLimitByKey } = require('../lib/ratelimit');

const router = Router();

// ---- Rate limiters ----
const redeemIpLimiter = createLimiter({ keyPrefix: 'rl:track:ip', points: 60, duration: 60 });         // 60/min/IP
const redeemIdLimiter = createLimiter({ keyPrefix: 'rl:track:id', points: 10, duration: 60 });         // 10/min/trackingId
const redeemPostIpLimiter = createLimiter({ keyPrefix: 'rl:track:post:ip', points: 30, duration: 60 }); // 30/min/IP
const publicRedeemLimiter = createLimiter({ keyPrefix: 'rl:redeem:public', points: 5, duration: 60 }); // 5/min/IP

// OPTIONAL: tiny sanity check to avoid crazy inputs
function isPlausibleTrackingId(s) {
  if (!s || typeof s !== 'string') {return false;}
  // your generator makes ~12-char base64url; allow 6..64 for safety
  return s.length >= 6 && s.length <= 64;
}

/**
 * PUBLIC: GET /tracking/offer/:trackingId
 * Returns offer details for public redemption page (store name, offer text)
 */
router.get(
  '/offer/:trackingId',
  rateLimitByIp(redeemIpLimiter),
  rateLimitByKey(redeemIdLimiter, (req) => `tid:${req.params.trackingId}`),
  async (req, res, next) => {
    try {
      const { trackingId } = req.params;
      if (!isPlausibleTrackingId(trackingId)) {
        return res.status(404).json({
          message: 'Invalid tracking ID',
          code: 'INVALID_TRACKING_ID',
        });
      }

      // Try to find in CampaignMessage first
      const msg = await prisma.campaignMessage.findUnique({
        where: { trackingId },
        include: {
          campaign: {
            include: {
              owner: {
                select: {
                  company: true,
                  senderName: true,
                },
              },
            },
          },
          redemption: {
            select: {
              redeemedAt: true,
            },
          },
        },
      });

      let storeName, offerText, isRedeemed, campaignId, automationId;

      if (msg) {
        // Campaign message found
        // isAutomation = false; // Redundant - already initialized as false
        storeName = msg.campaign.owner.company ||
                   msg.campaign.owner.senderName ||
                   'Store';
        offerText = msg.campaign.name || msg.text || 'Special offer';
        isRedeemed = !!msg.redemption;
        campaignId = msg.campaignId;
        automationId = null;

        // Record offer view event for campaign
        recordOfferViewEvent({
          campaignMessageId: msg.id,
          campaignId: msg.campaignId,
          contactId: msg.contactId,
          ownerId: msg.ownerId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }).catch(err => {
          logger.warn({ trackingId, campaignMessageId: msg.id, err: err.message }, 'Failed to record offer view event');
        });
      } else {
        // Try AutomationMessage
        const autoMsg = await prisma.automationMessage.findUnique({
          where: { trackingId },
          include: {
            automation: {
              include: {
                owner: {
                  select: {
                    company: true,
                    senderName: true,
                  },
                },
              },
            },
            redemption: {
              select: {
                redeemedAt: true,
              },
            },
          },
        });

        if (!autoMsg) {
          logger.debug({ trackingId }, 'Offer not found for trackingId');
          return res.status(404).json({
            message: 'Offer not found',
            code: 'RESOURCE_NOT_FOUND',
          });
        }

        // Automation message found
        storeName = autoMsg.automation.owner.company ||
                   autoMsg.automation.owner.senderName ||
                   'Store';
        offerText = autoMsg.automation.messageBody || autoMsg.text || 'Special offer';
        isRedeemed = !!autoMsg.redemption;
        campaignId = null;
        automationId = autoMsg.automationId;

        logger.debug({
          trackingId,
          automationId: autoMsg.automationId,
          contactId: autoMsg.contactId,
          ownerId: autoMsg.ownerId,
          isRedeemed: !!autoMsg.redemption,
        }, 'Automation offer retrieved successfully');
      }

      res.json({
        trackingId,
        storeName,
        offerText,
        isRedeemed,
        campaignId,
        automationId,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Record offer view event (non-blocking, optional analytics)
 * @param {Object} params
 * @param {number} params.campaignMessageId
 * @param {number} params.campaignId
 * @param {number} params.contactId
 * @param {number} params.ownerId
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 */
async function recordOfferViewEvent({ campaignMessageId, campaignId, contactId, ownerId, ipAddress, userAgent }) {
  try {
    const dedupeWindowMs = 10 * 60 * 1000; // 10 minutes
    const dedupeAfter = new Date(Date.now() - dedupeWindowMs);
    if (ipAddress || userAgent) {
      const existing = await prisma.offerViewEvent.findFirst({
        where: {
          campaignMessageId,
          viewedAt: { gte: dedupeAfter },
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
        },
        select: { id: true },
      });
      if (existing) {
        return;
      }
    }

    // Simple device type detection from user agent
    let deviceType = null;
    if (userAgent) {
      if (/mobile|android|iphone|ipad/i.test(userAgent)) {
        deviceType = 'mobile';
      } else if (/tablet/i.test(userAgent)) {
        deviceType = 'tablet';
      } else {
        deviceType = 'desktop';
      }
    }

    await prisma.offerViewEvent.create({
      data: {
        campaignMessageId,
        campaignId,
        contactId,
        ownerId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        deviceType,
      },
    });
  } catch (err) {
    // If table doesn't exist yet or other error, just log and continue
    // This is optional analytics, so we don't want it to break the main flow
    // Check for common errors (table doesn't exist, constraint violations, etc.)
    const errorCode = err?.code || '';
    const errorMessage = err?.message || '';
    if (errorCode === 'P2021' || errorCode === 'P2001' ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('not exist')) {
      // Table doesn't exist yet - this is fine, just log at debug level
      logger.debug({ campaignMessageId, err: err.message }, 'OfferViewEvent table does not exist yet (non-critical)');
    } else {
      // Other errors - log at warn level but don't throw
      logger.warn({ campaignMessageId, err: err.message, code: errorCode }, 'Offer view event recording failed (non-critical)');
    }
  }
}

/**
 * PUBLIC: GET /tracking/redeem/:trackingId
 * Returns only existence & redemption state — no IDs are leaked.
 */
router.get(
  '/redeem/:trackingId',
  rateLimitByIp(redeemIpLimiter),
  rateLimitByKey(redeemIdLimiter, (req) => `tid:${req.params.trackingId}`),
  async (req, res, next) => {
    try {
      const { trackingId } = req.params;
      if (!isPlausibleTrackingId(trackingId)) {
        // return 404 to avoid info leak patterns
        return res.status(404).json({ exists: false });
      }

      // Try CampaignMessage first
      const msg = await prisma.campaignMessage.findUnique({
        where: { trackingId },
        include: { redemption: true },
      });

      // If not found, try AutomationMessage
      if (!msg) {
        const autoMsg = await prisma.automationMessage.findUnique({
          where: { trackingId },
          include: { redemption: true },
        });

        if (!autoMsg) {
          return res.status(404).json({ exists: false });
        }

        res.json({
          exists: true,
          alreadyRedeemed: !!autoMsg.redemption,
        });
      } else {
        res.json({
          exists: true,
          alreadyRedeemed: !!msg.redemption,
        });
      }
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUBLIC: POST /tracking/redeem-public/:trackingId
 * Idempotent redeem endpoint (no auth)
 */
router.post(
  '/redeem-public/:trackingId',
  rateLimitByKey(redeemIdLimiter, (req) => `tid:${req.params.trackingId}`),
  rateLimitByIp(publicRedeemLimiter),
  async (req, res, next) => {
    try {
      const { trackingId } = req.params;
      if (!trackingId || !isPlausibleTrackingId(trackingId)) {
        return res.status(400).json({ message: 'Invalid tracking ID', code: 'INVALID_TRACKING_ID' });
      }

      const msg = await prisma.campaignMessage.findUnique({
        where: { trackingId },
        select: { id: true, campaignId: true, contactId: true, ownerId: true },
      });

      if (!msg) {
        return res.status(404).json({ message: 'Offer not found', code: 'NOT_FOUND' });
      }

      const existing = await prisma.redemption.findUnique({ where: { messageId: msg.id } });
      if (existing) {
        return res.json({ status: 'already_redeemed', redeemedAt: existing.redeemedAt });
      }

      const evidence = {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || null,
        publicRedeem: true,
      };

      let redemption;
      try {
        redemption = await prisma.redemption.create({
          data: {
            messageId: msg.id,
            campaignId: msg.campaignId,
            contactId: msg.contactId,
            ownerId: msg.ownerId,
            evidenceJson: evidence,
          },
        });
      } catch (createErr) {
        if (createErr?.code === 'P2002' || createErr?.code === 'P2003') {
          const existingRedeem = await prisma.redemption.findUnique({ where: { messageId: msg.id } });
          if (existingRedeem) {
            return res.json({ status: 'already_redeemed', redeemedAt: existingRedeem.redeemedAt });
          }
        }
        throw createErr;
      }

      // Update aggregates (non-blocking)
      try {
        const { updateCampaignAggregates } = require('../services/campaignAggregates.service');
        updateCampaignAggregates(msg.campaignId, msg.ownerId);
      } catch (_error) {
        // Best-effort update; ignore aggregate errors.
      }

      return res.json({ status: 'redeemed', redeemedAt: redemption.redeemedAt });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * PROTECTED: POST /tracking/redeem
 * Body: { trackingId }
 * - Only the message owner can redeem.
 * - Idempotent: prevents double redemptions.
 */
router.post(
  '/redeem',
  requireAuth,
  rateLimitByIp(redeemPostIpLimiter),
  async (req, res, next) => {
    try {
      const { trackingId } = req.body || {};
      if (!trackingId) {
        return res.status(400).json({
          message: 'Tracking ID is required',
          code: 'VALIDATION_ERROR',
        });
      }
      if (!isPlausibleTrackingId(trackingId)) {
        return res.status(400).json({
          message: 'Invalid tracking ID format',
          code: 'VALIDATION_ERROR',
        });
      }

      // Find message by trackingId - try CampaignMessage first
      const msg = await prisma.campaignMessage.findUnique({ where: { trackingId } });
      let isAutomation = false;
      let autoMsg = null;

      if (!msg) {
        // Try AutomationMessage
        autoMsg = await prisma.automationMessage.findUnique({ where: { trackingId } });
        if (!autoMsg) {
          // do not leak existence across tenants
          logger.info({ trackingId, ownerId: req.user.id }, 'Redeem attempt: message not found');
          return res.json({ status: 'not_found_or_forbidden', trackingId });
        }
        isAutomation = true;
      }

      // OWNER SCOPE: allow redeem only if message belongs to the user
      const ownerId = isAutomation ? autoMsg.ownerId : msg.ownerId;
      if (ownerId !== req.user.id) {
        logger.warn({ trackingId, messageOwnerId: ownerId, requestOwnerId: req.user.id }, 'Redeem attempt: ownership mismatch');
        return res.json({ status: 'not_found_or_forbidden', trackingId });
      }

      if (isAutomation) {
        logger.debug({ trackingId, automationId: autoMsg.automationId, contactId: autoMsg.contactId }, 'Redeem request validated (automation)');

        // Idempotent check for automation
        const existing = await prisma.automationRedemption.findUnique({ where: { messageId: autoMsg.id } });
        if (existing) {
          logger.info({ trackingId, automationId: autoMsg.automationId, contactId: autoMsg.contactId }, 'Redeem attempt: already redeemed');
          return res.json({
            status: 'already_redeemed',
            trackingId,
            messageId: autoMsg.id,
            automationId: autoMsg.automationId,
            contactId: autoMsg.contactId,
            redeemedAt: existing.redeemedAt,
          });
        }

        // Create automation redemption (scoped)
        let rdm;
        try {
          rdm = await prisma.automationRedemption.create({
            data: {
              ownerId: req.user.id,
              messageId: autoMsg.id,
              automationId: autoMsg.automationId,
              contactId: autoMsg.contactId,
              redeemedByUserId: req.user.id,
              evidenceJson: { ip: req.ip, userAgent: req.get('user-agent') || null },
            },
          });
        } catch (createErr) {
          if (createErr?.code === 'P2002' || createErr?.code === 'P2003') {
            const existingRedeem = await prisma.automationRedemption.findUnique({ where: { messageId: autoMsg.id } });
            if (existingRedeem) {
              return res.json({
                status: 'already_redeemed',
                trackingId,
                messageId: autoMsg.id,
                automationId: autoMsg.automationId,
                contactId: autoMsg.contactId,
                redeemedAt: existingRedeem.redeemedAt,
              });
            }
          }
          throw createErr;
        }

        logger.info({
          trackingId,
          automationId: autoMsg.automationId,
          contactId: autoMsg.contactId,
          redemptionId: rdm.messageId,
        }, 'Automation redemption created');

        return res.json({
          status: 'redeemed',
          trackingId,
          messageId: autoMsg.id,
          automationId: autoMsg.automationId,
          contactId: autoMsg.contactId,
          redeemedAt: rdm.redeemedAt,
        });
      } else {
        // Campaign message redemption (existing logic)
        logger.debug({ trackingId, campaignId: msg.campaignId, contactId: msg.contactId }, 'Redeem request validated');

        // Idempotent
        const existing = await prisma.redemption.findUnique({ where: { messageId: msg.id } });
        if (existing) {
          logger.info({ trackingId, campaignId: msg.campaignId, contactId: msg.contactId }, 'Redeem attempt: already redeemed');
          return res.json({
            status: 'already_redeemed',
            trackingId,
            messageId: msg.id,
            campaignId: msg.campaignId,
            contactId: msg.contactId,
            redeemedAt: existing.redeemedAt,
          });
        }

        // Create redemption (scoped)
        let rdm;
        try {
          rdm = await prisma.redemption.create({
            data: {
              ownerId: req.user.id,
              messageId: msg.id,
              campaignId: msg.campaignId,
              contactId: msg.contactId,
              redeemedByUserId: req.user.id,
              evidenceJson: { ip: req.ip, userAgent: req.get('user-agent') || null },
            },
          });
        } catch (createErr) {
          if (createErr?.code === 'P2002' || createErr?.code === 'P2003') {
            const existingRedeem = await prisma.redemption.findUnique({ where: { messageId: msg.id } });
            if (existingRedeem) {
              return res.json({
                status: 'already_redeemed',
                trackingId,
                messageId: msg.id,
                campaignId: msg.campaignId,
                contactId: msg.contactId,
                redeemedAt: existingRedeem.redeemedAt,
              });
            }
          }
          throw createErr;
        }

        logger.info({
          trackingId,
          campaignId: msg.campaignId,
          contactId: msg.contactId,
          ownerId: req.user.id,
          redeemedAt: rdm.redeemedAt,
        }, 'Redemption created successfully');

        res.json({
          status: 'redeemed',
          trackingId,
          messageId: msg.id,
          campaignId: msg.campaignId,
          contactId: msg.contactId,
          redeemedAt: rdm.redeemedAt,
        });
      }
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
