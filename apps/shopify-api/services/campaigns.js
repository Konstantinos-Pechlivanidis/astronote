import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError, SubscriptionRequiredError } from '../utils/errors.js';
import { InsufficientCreditsError } from './credit-validation.js';
import { smsQueue } from '../queue/index.js';
import { createHash } from 'crypto';
import {
  CampaignStatus,
  CampaignPriority,
  ScheduleType,
  SmsConsent,
} from '../utils/prismaEnums.js';
import { mapCampaignToDTO } from '../utils/dto-mappers.js';
import {
  CAMPAIGN_STATUS_SET,
  normalizeCampaignStatus,
} from '../constants/campaign-status.js';
import { getCanonicalMetricsForCampaignIds } from './campaign-metrics-batch.js';

/**
 * Campaigns Service
 * Handles campaign management, scheduling, sending, and metrics
 */

/**
 * Normalize audience query to Prisma where clause
 * @param {string} audience - Audience filter
 * @returns {Object|null} Prisma where clause
 */
function normalizeAudienceQuery(audience) {
  if (!audience || audience === 'all') {
    return { smsConsent: SmsConsent.opted_in };
  }
  if (audience === 'men' || audience === 'male') {
    return { smsConsent: SmsConsent.opted_in, gender: 'male' };
  }
  if (audience === 'women' || audience === 'female') {
    return { smsConsent: SmsConsent.opted_in, gender: 'female' };
  }
  if (audience.startsWith('segment:')) {
    return null; // Handle separately
  }
  return { smsConsent: SmsConsent.opted_in };
}

/**
 * Resolve recipients based on audience
 * @param {string} shopId - Store ID
 * @param {string} audience - Audience filter
 * @returns {Promise<Array>} Array of recipients
 */
async function resolveRecipients(shopId, audience) {
  logger.info('Resolving recipients', { shopId, audience });

  const base = normalizeAudienceQuery(audience);

  if (base) {
    const contacts = await prisma.contact.findMany({
      where: { shopId, ...base },
      select: { id: true, phoneE164: true, firstName: true, lastName: true },
    });
    return contacts.map(c => ({
      contactId: c.id,
      phoneE164: c.phoneE164,
      firstName: c.firstName,
      lastName: c.lastName,
    }));
  }

  // Handle segment-based audience (supports both "segment:ID" and direct segment ID)
  let segmentId = null;
  if (typeof audience === 'string' && audience.startsWith('segment:')) {
    segmentId = audience.split(':')[1];
  } else if (typeof audience === 'string' && audience !== 'all' && !['men', 'women', 'male', 'female'].includes(audience)) {
    // Direct segment ID (new format)
    segmentId = audience;
  }

  if (segmentId) {
    // ✅ Security: First validate segment belongs to shop
    const segment = await prisma.segment.findFirst({
      where: {
        id: segmentId,
        shopId, // ✅ Validate segment ownership
      },
    });

    if (!segment) {
      logger.warn('Segment not found or does not belong to shop', {
        segmentId,
        shopId,
      });
      return []; // Return empty if segment doesn't belong to shop
    }

    // For system segments, resolve using criteria
    if (segment.type === 'system') {
      const segmentsService = (await import('./segments.js')).default;
      const contacts = await segmentsService.resolveSegmentContacts(shopId, segment);
      return contacts.map(c => ({
        contactId: c.id,
        phoneE164: c.phoneE164,
        firstName: c.firstName,
        lastName: c.lastName,
      }));
    }

    // For custom segments, use memberships
    const members = await prisma.segmentMembership.findMany({
      where: {
        segmentId,
        contact: {
          shopId, // ✅ Filter at database level for efficiency and security
          smsConsent: 'opted_in',
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            phoneE164: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return members.map(m => ({
      contactId: m.contact.id,
      phoneE164: m.contact.phoneE164,
      firstName: m.contact.firstName,
      lastName: m.contact.lastName,
    }));
  }

  // Fallback to all opted-in contacts
  const contacts = await prisma.contact.findMany({
    where: { shopId, smsConsent: SmsConsent.opted_in },
    select: { id: true, phoneE164: true, firstName: true, lastName: true },
  });
  return contacts.map(c => ({
    contactId: c.id,
    phoneE164: c.phoneE164,
    firstName: c.firstName,
    lastName: c.lastName,
  }));
}

/**
 * Calculate recipient count without fetching all data
 * @param {string} shopId - Store ID
 * @param {string} audience - Audience filter
 * @returns {Promise<number>} Recipient count
 */
// Unused function - kept for potential future API use
// eslint-disable-next-line no-unused-vars
async function calculateRecipientCount(shopId, audience) {
  const base = normalizeAudienceQuery(audience);

  if (base) {
    return await prisma.contact.count({
      where: { shopId, ...base },
    });
  }

  if (audience.startsWith('segment:')) {
    const segmentId = audience.split(':')[1];

    // ✅ Security: Validate segment belongs to shop
    const segment = await prisma.segment.findFirst({
      where: {
        id: segmentId,
        shopId,
      },
      select: { id: true },
    });

    if (!segment) {
      return 0; // Segment doesn't belong to shop
    }

    // ✅ Security: Count with shopId filter at database level
    return await prisma.segmentMembership.count({
      where: {
        segmentId,
        contact: {
          shopId,
          smsConsent: 'opted_in',
        },
      },
    });
  }

  return 0;
}

/**
 * Validate campaign data
 * @param {Object} campaignData - Campaign data to validate
 * @throws {ValidationError} If validation fails
 */
function validateCampaignData(campaignData) {
  if (!campaignData.name || campaignData.name.trim().length === 0) {
    throw new ValidationError('Campaign name is required');
  }

  if (!campaignData.message || campaignData.message.trim().length === 0) {
    throw new ValidationError('Campaign message is required');
  }

  if (campaignData.message.length > 1600) {
    throw new ValidationError('Message is too long (max 1600 characters)');
  }

  if (
    ![
      ScheduleType.immediate,
      ScheduleType.scheduled,
      ScheduleType.recurring,
    ].includes(campaignData.scheduleType)
  ) {
    throw new ValidationError('Invalid schedule type');
  }

  if (
    campaignData.scheduleType === ScheduleType.scheduled &&
    !campaignData.scheduleAt
  ) {
    throw new ValidationError(
      'Schedule date is required for scheduled campaigns',
    );
  }

  if (
    campaignData.scheduleType === ScheduleType.recurring &&
    !campaignData.recurringDays
  ) {
    throw new ValidationError(
      'Recurring days is required for recurring campaigns',
    );
  }
}

/**
 * List campaigns with optional filtering and pagination
 * @param {string} storeId - Store ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Campaigns list
 */
export async function listCampaigns(storeId, filters = {}) {
  const {
    page = 1,
    pageSize = 20,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  logger.info('Listing campaigns', { storeId, filters });

  const where = { shopId: storeId };

  if (status && CAMPAIGN_STATUS_SET.has(status)) {
    // Treat legacy 'sent' as alias for canonical completion in filters.
    if (status === CampaignStatus.sent || status === CampaignStatus.completed) {
      where.status = { in: [CampaignStatus.completed, CampaignStatus.sent] };
    } else {
      where.status = status;
    }
  }

  const validSortFields = ['createdAt', 'updatedAt', 'name', 'scheduleAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      take: parseInt(pageSize),
      skip: (parseInt(page) - 1) * parseInt(pageSize),
      include: {
        metrics: true,
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  // Compute canonical metrics in batch (actual recipients table), then overlay estimates for draft/scheduled.
  const campaignIds = campaigns.map(c => c.id);
  const canonicalById = await getCanonicalMetricsForCampaignIds(campaignIds);

  // Estimate recipients for campaigns that haven't been enqueued yet (draft/scheduled).
  const estimateById = new Map();
  await Promise.all(
    campaigns.map(async campaign => {
      const rawStatus = String(campaign.status || '');
      const normalized = normalizeCampaignStatus(rawStatus);
      // For draft/scheduled, recipient rows might not exist yet: compute an audience estimate.
      if (normalized.status === CampaignStatus.draft || normalized.status === CampaignStatus.scheduled) {
        let estimate = 0;
        const base = normalizeAudienceQuery(campaign.audience);
        if (base) {
          estimate = await prisma.contact.count({
            where: { shopId: storeId, ...base },
          });
        } else {
          // Handle segment-based audience (supports both "segment:ID" and direct segment ID)
          let segmentId = null;
          if (typeof campaign.audience === 'string' && campaign.audience.startsWith('segment:')) {
            segmentId = campaign.audience.split(':')[1];
          } else if (typeof campaign.audience === 'string' && campaign.audience !== 'all') {
            segmentId = campaign.audience;
          }

          if (segmentId) {
            const segment = await prisma.segment.findFirst({
              where: { id: segmentId, shopId: storeId },
            });
            if (segment) {
              if (segment.type === 'system') {
                const segmentsService = (await import('./segments.js')).default;
                estimate = await segmentsService.getSegmentEstimatedCount(storeId, segment);
              } else {
                estimate = await prisma.segmentMembership.count({
                  where: {
                    segmentId,
                    contact: { shopId: storeId, smsConsent: 'opted_in' },
                  },
                });
              }
            }
          } else {
            estimate = await prisma.contact.count({
              where: { shopId: storeId, smsConsent: SmsConsent.opted_in },
            });
          }
        }
        estimateById.set(campaign.id, estimate);
      }
    }),
  );

  const campaignsWithStats = campaigns.map(campaign => {
    const canonical = canonicalById.get(campaign.id);
    const estimate = estimateById.get(campaign.id) || 0;
    const recipients = canonical?.totals?.recipients > 0 ? canonical.totals.recipients : estimate;
    const accepted = canonical?.totals?.accepted || 0;
    const delivered = canonical?.totals?.delivered || 0;
    const failed = canonical?.totals?.failed || 0;

    const dto = mapCampaignToDTO({
      ...campaign,
      // Backward-compatible counters
      recipientCount: recipients,
      totalRecipients: recipients,
      sentCount: accepted,
      deliveredCount: delivered,
      failedCount: failed,
      // New canonical sections
      totals: {
        recipients,
        accepted,
        sent: accepted,
        delivered,
        failed,
      },
      delivery: canonical?.delivery || {
        pendingDelivery: Math.max(accepted - delivered - failed, 0),
        delivered,
        failedDelivery: failed,
      },
      sourceOfTruth: 'mitto',
    });
    return dto;
  });

  const totalPages = Math.ceil(total / parseInt(pageSize));

  logger.info('Campaigns listed successfully', {
    storeId,
    total,
    returned: campaigns.length,
  });

  return {
    campaigns: campaignsWithStats,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
    },
  };
}

/**
 * Get campaign by ID
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Campaign data
 */
export async function getCampaignById(storeId, campaignId) {
  logger.info('Getting campaign by ID', { storeId, campaignId });

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      shopId: storeId,
    },
    include: {
      metrics: true,
      recipients: {
        take: 100, // Limit recipients for performance
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError('Campaign');
  }

  // Get recipient count
  // For sent campaigns, count actual CampaignRecipient records
  // For scheduled/draft campaigns, calculate based on audience
  let recipientCount = 0;

  if (
    campaign.status === CampaignStatus.sending ||
    campaign.status === CampaignStatus.sent ||
    campaign.status === CampaignStatus.failed ||
    campaign.status === CampaignStatus.completed
  ) {
    // Count actual recipients for campaigns that have been sent
    recipientCount = await prisma.campaignRecipient.count({
      where: { campaignId },
    });
  } else {
    // For draft/scheduled campaigns, calculate recipient count based on audience
    const base = normalizeAudienceQuery(campaign.audience);
    if (base) {
      recipientCount = await prisma.contact.count({
        where: { shopId: storeId, ...base },
      });
    } else {
      // Segment-based audience (supports both "segment:ID" and direct segment ID)
      let segmentId = null;
      if (typeof campaign.audience === 'string' && campaign.audience.startsWith('segment:')) {
        segmentId = campaign.audience.split(':')[1];
      } else if (typeof campaign.audience === 'string' && campaign.audience !== 'all') {
        segmentId = campaign.audience;
      }

      if (!segmentId) {
        recipientCount = 0;
      } else {
        // Validate segment belongs to shop
        const segment = await prisma.segment.findFirst({
          where: { id: segmentId, shopId: storeId },
        });

        if (!segment) {
          recipientCount = 0;
        } else if (segment.type === 'system') {
          const segmentsService = (await import('./segments.js')).default;
          recipientCount = await segmentsService.getSegmentEstimatedCount(storeId, segment);
        } else {
          recipientCount = await prisma.segmentMembership.count({
            where: {
              segmentId,
              contact: {
                shopId: storeId,
                smsConsent: 'opted_in',
              },
            },
          });
        }
      }
    }
  }

  logger.info('Campaign retrieved successfully', {
    storeId,
    campaignId,
    recipientCount,
    status: campaign.status,
  });

  const canonicalById = await getCanonicalMetricsForCampaignIds([campaignId]);
  const canonical = canonicalById.get(campaignId);
  const recipients = canonical?.totals?.recipients > 0 ? canonical.totals.recipients : recipientCount;
  const accepted = canonical?.totals?.accepted || 0;
  const delivered = canonical?.totals?.delivered || 0;
  const failed = canonical?.totals?.failed || 0;

  return mapCampaignToDTO({
    ...campaign,
    recipientCount: recipients,
    totalRecipients: recipients, // Alias for backward compatibility
    sentCount: accepted,
    deliveredCount: delivered,
    failedCount: failed,
    totals: {
      recipients,
      accepted,
      sent: accepted,
      delivered,
      failed,
    },
    delivery: canonical?.delivery || {
      pendingDelivery: Math.max(accepted - delivered - failed, 0),
      delivered,
      failedDelivery: failed,
    },
    sourceOfTruth: 'mitto',
  });
}

/**
 * Create new campaign
 * @param {string} storeId - Store ID
 * @param {Object} campaignData - Campaign data
 * @returns {Promise<Object>} Created campaign
 */
export async function createCampaign(storeId, campaignData) {
  logger.info('Creating campaign', { storeId, name: campaignData.name });

  // Validate campaign data
  validateCampaignData(campaignData);

  // Check if campaign with same name already exists for this shop
  const trimmedName = campaignData.name.trim();
  const existingCampaign = await prisma.campaign.findFirst({
    where: {
      shopId: storeId,
      name: trimmedName,
    },
    select: { id: true, name: true, status: true },
  });

  if (existingCampaign) {
    throw new ValidationError(
      `A campaign with the name "${trimmedName}" already exists for this store. Please choose a different name.`,
    );
  }

  // Validate and parse scheduleAt date if provided
  let scheduleAtDate = null;
  if (campaignData.scheduleAt) {
    try {
      scheduleAtDate = new Date(campaignData.scheduleAt);
      if (isNaN(scheduleAtDate.getTime())) {
        throw new ValidationError(
          'Invalid schedule date format. Please use ISO 8601 format.',
        );
      }
      // Validate that scheduled date is in the future
      if (scheduleAtDate <= new Date()) {
        throw new ValidationError('Schedule date must be in the future');
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid schedule date: ${error.message}`);
    }
  }

  // If scheduleType is scheduled/recurring, the campaign should be created as "scheduled" immediately.
  // This ensures the scheduler can pick it up without requiring an extra /schedule call.
  const requestedScheduleType = campaignData.scheduleType || ScheduleType.immediate;
  if (requestedScheduleType === ScheduleType.scheduled && !scheduleAtDate) {
    throw new ValidationError('Schedule date is required for scheduled campaigns');
  }
  if (requestedScheduleType === ScheduleType.recurring && !campaignData.recurringDays) {
    throw new ValidationError('Recurring days is required for recurring campaigns');
  }
  const initialStatus =
    requestedScheduleType === ScheduleType.scheduled ||
    requestedScheduleType === ScheduleType.recurring
      ? CampaignStatus.scheduled
      : CampaignStatus.draft;

  // Use transaction to ensure both campaign and metrics are created atomically
  try {
    const result = await prisma.$transaction(async tx => {
      // Double-check for duplicate name within transaction (race condition protection)
      const duplicateCheck = await tx.campaign.findFirst({
        where: {
          shopId: storeId,
          name: trimmedName,
        },
        select: { id: true },
      });

      if (duplicateCheck) {
        throw new ValidationError(
          `A campaign with the name "${trimmedName}" already exists for this store. Please choose a different name.`,
        );
      }

      // Handle audience format (support both string and object)
      let audienceValue = 'all';
      if (campaignData.audience) {
        if (typeof campaignData.audience === 'object' && campaignData.audience.type) {
          // New format: { type: "all" } or { type: "segment", segmentId: "..." }
          if (campaignData.audience.type === 'segment' && campaignData.audience.segmentId) {
            audienceValue = campaignData.audience.segmentId; // Store segment ID directly
          } else {
            audienceValue = campaignData.audience.type; // "all"
          }
        } else {
          // Legacy string format
          audienceValue = campaignData.audience;
        }
      }

      // Build meta object for additional data (discountValue, includeDiscount, etc.)
      const meta = {};
      if (campaignData.includeDiscount !== undefined) {
        meta.includeDiscount = campaignData.includeDiscount;
      }
      if (campaignData.discountValue) {
        meta.discountValue = campaignData.discountValue;
      }

      // Create campaign
      const campaign = await tx.campaign.create({
        data: {
          shopId: storeId,
          name: trimmedName,
          message: campaignData.message.trim(),
          audience: audienceValue,
          discountId: campaignData.discountId || null,
          meta: Object.keys(meta).length > 0 ? meta : null,
          scheduleType: requestedScheduleType,
          scheduleAt: scheduleAtDate,
          recurringDays: campaignData.recurringDays || null,
          status: initialStatus,
          priority: campaignData.priority || CampaignPriority.normal,
        },
      });

      // Create metrics record
      await tx.campaignMetrics.create({
        data: { campaignId: campaign.id },
      });

      return campaign;
    });

    logger.info('Campaign created successfully', {
      storeId,
      campaignId: result.id,
    });

    return result;
  } catch (error) {
    // Handle Prisma unique constraint violation (race condition)
    if (
      error.code === 'P2002' &&
      error.meta?.target?.includes('name') &&
      error.meta?.target?.includes('shopId')
    ) {
      throw new ValidationError(
        `A campaign with the name "${trimmedName}" already exists for this store. Please choose a different name.`,
      );
    }

    // Re-throw ValidationError as-is
    if (error instanceof ValidationError) {
      throw error;
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Update campaign
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @param {Object} campaignData - Updated campaign data
 * @returns {Promise<Object>} Updated campaign
 */
export async function updateCampaign(storeId, campaignId, campaignData) {
  logger.info('Updating campaign', { storeId, campaignId });

  // Check if campaign exists and belongs to store
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
  });

  if (!existing) {
    throw new NotFoundError('Campaign');
  }

  // Can't update sent or sending campaigns
  if (
    existing.status === CampaignStatus.sent ||
    existing.status === CampaignStatus.completed ||
    existing.status === CampaignStatus.sending
  ) {
    throw new ValidationError(
      'Cannot update a campaign that has already been sent or is currently sending',
    );
  }

  // Prepare update data
  const updateData = {};

  if (campaignData.name !== undefined) {
    if (!campaignData.name || campaignData.name.trim().length === 0) {
      throw new ValidationError('Campaign name is required');
    }
    updateData.name = campaignData.name.trim();
  }

  if (campaignData.message !== undefined) {
    if (!campaignData.message || campaignData.message.trim().length === 0) {
      throw new ValidationError('Campaign message is required');
    }
    if (campaignData.message.length > 1600) {
      throw new ValidationError('Message is too long (max 1600 characters)');
    }
    updateData.message = campaignData.message.trim();
  }

  if (campaignData.audience !== undefined)
    updateData.audience = campaignData.audience;
  if (campaignData.discountId !== undefined)
    updateData.discountId = campaignData.discountId;
  if (campaignData.priority !== undefined) {
    // Validate priority value
    const validPriorities = Object.values(CampaignPriority);
    if (!validPriorities.includes(campaignData.priority)) {
      throw new ValidationError(
        `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
      );
    }
    updateData.priority = campaignData.priority;
  }
  if (campaignData.scheduleType !== undefined) {
    updateData.scheduleType = campaignData.scheduleType;
    // If changing from scheduled to immediate, clear scheduleAt and set status to draft
    if (
      campaignData.scheduleType === ScheduleType.immediate &&
      existing.scheduleType === ScheduleType.scheduled
    ) {
      updateData.scheduleAt = null;
      updateData.status = CampaignStatus.draft;
    }
    // If changing to scheduled/recurring, we set status based on the final scheduleAt/recurringDays below.
  }
  if (campaignData.scheduleAt !== undefined) {
    if (campaignData.scheduleAt) {
      const scheduleAtDate = new Date(campaignData.scheduleAt);
      if (isNaN(scheduleAtDate.getTime())) {
        throw new ValidationError(
          'Invalid schedule date format. Please use ISO 8601 format.',
        );
      }
      if (scheduleAtDate <= new Date()) {
        throw new ValidationError('Schedule date must be in the future');
      }
      updateData.scheduleAt = scheduleAtDate;
    } else {
      updateData.scheduleAt = null;
    }
  }
  if (campaignData.recurringDays !== undefined)
    updateData.recurringDays = campaignData.recurringDays;

  // Normalize status for scheduled/recurring updates.
  // The create/edit flows in the web app use PUT /campaigns/:id (not /schedule), so we must set status here.
  const finalScheduleType =
    campaignData.scheduleType !== undefined ? campaignData.scheduleType : existing.scheduleType;
  const finalScheduleAt =
    campaignData.scheduleAt !== undefined ? updateData.scheduleAt : existing.scheduleAt;
  const finalRecurringDays =
    campaignData.recurringDays !== undefined ? updateData.recurringDays : existing.recurringDays;

  if (finalScheduleType === ScheduleType.scheduled) {
    if (!finalScheduleAt) {
      throw new ValidationError('Schedule date is required for scheduled campaigns');
    }
    updateData.status = CampaignStatus.scheduled;
  } else if (finalScheduleType === ScheduleType.recurring) {
    if (!finalRecurringDays) {
      throw new ValidationError('Recurring days is required for recurring campaigns');
    }
    // For recurring campaigns, treat them as scheduled (scheduler handles execution cadence).
    updateData.status = CampaignStatus.scheduled;
  }

  // Update campaign
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: updateData,
  });

  logger.info('Campaign updated successfully', { storeId, campaignId });

  return campaign;
}

/**
 * Delete campaign
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<void>}
 */
export async function deleteCampaign(storeId, campaignId) {
  logger.info('Deleting campaign', { storeId, campaignId });

  // Check if campaign exists and belongs to store
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
  });

  if (!existing) {
    throw new NotFoundError('Campaign');
  }

  // Can't delete sent campaigns
  if (
    existing.status === CampaignStatus.sent ||
    existing.status === CampaignStatus.completed ||
    existing.status === CampaignStatus.sending
  ) {
    throw new ValidationError(
      'Cannot delete a campaign that is sent or currently sending',
    );
  }

  // Delete campaign (metrics and recipients will cascade)
  await prisma.campaign.delete({
    where: { id: campaignId },
  });

  logger.info('Campaign deleted successfully', { storeId, campaignId });
}

/**
 * Prepare campaign for sending (calculate recipients and validate credits)
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Preparation result
 */
export async function prepareCampaign(storeId, campaignId) {
  logger.info('Preparing campaign', { storeId, campaignId });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
  });

  if (!campaign) {
    throw new NotFoundError('Campaign');
  }

  if (campaign.status !== CampaignStatus.draft) {
    throw new ValidationError('Only draft campaigns can be prepared');
  }

  // Calculate recipients
  const recipients = await resolveRecipients(storeId, campaign.audience);
  const recipientCount = recipients.length;

  if (recipientCount === 0) {
    throw new ValidationError('No recipients found for this campaign');
  }

  // Check credits (without consuming)
  const shop = await prisma.shop.findUnique({
    where: { id: storeId },
    select: { credits: true },
  });

  if (shop.credits < recipientCount) {
    throw new InsufficientCreditsError(recipientCount, shop.credits);
  }

  logger.info('Campaign prepared successfully', {
    storeId,
    campaignId,
    recipientCount,
    creditsAvailable: shop.credits,
  });

  return {
    recipientCount,
    creditsRequired: recipientCount,
    creditsAvailable: shop.credits,
    canSend: shop.credits >= recipientCount,
  };
}

/**
 * Enqueue campaign for bulk SMS sending (new bulk SMS architecture)
 * This function replaces the old sendCampaign logic for bulk campaigns
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Enqueue result
 */
export async function enqueueCampaign(
  storeId,
  campaignId,
  _idempotencyKey = null,
  options = {},
) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:747',message:'enqueueCampaign ENTRY',data:{storeId,campaignId,processId:process.pid,requestId:`req_${Date.now()}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
  // #endregion
  logger.info('Enqueuing campaign for bulk SMS', {
    storeId,
    campaignId,
    timestamp: new Date().toISOString(),
    processId: process.pid,
  });

  let creditReservation;
  const requestId = options?.requestId;
  let step = 'init';

  // Subscription gate (early) to avoid heavy work when inactive
  const { isSubscriptionActive } = await import('./subscription.js');
  const subscriptionActiveEarly = await isSubscriptionActive(storeId);
  if (!subscriptionActiveEarly) {
    logger.warn(
      { storeId, campaignId },
      'Inactive subscription - campaign enqueue blocked (early guard)',
    );
    return {
      ok: false,
      reason: 'subscription_required',
      enqueuedJobs: 0,
      message: 'Active subscription required to send SMS campaigns. Please subscribe to a plan to continue.',
      details: {
        actionable: true,
        action: 'subscribe',
      },
    };
  }

  // 0) CRITICAL: Atomically check and update status to prevent race conditions
  // This prevents multiple simultaneous requests from all passing the status check
  // Use a transaction with updateMany and WHERE condition for atomic operation
  let statusTransitionResult;
  try {
    step = 'update_campaign_status';
    statusTransitionResult = await prisma.$transaction(async tx => {
      // Get current campaign status
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId, shopId: storeId },
        select: { id: true, status: true },
      });

      if (!campaign) {
        return { ok: false, reason: 'not_found' };
      }

      // If campaign is already sending, check if there are pending recipients
      if (campaign.status === CampaignStatus.sending) {
        const pendingCount = await tx.campaignRecipient.count({
          where: {
            campaignId,
            status: 'pending',
            mittoMessageId: null,
          },
        });

        if (pendingCount === 0) {
          logger.warn(
            {
              storeId,
              campaignId,
              status: campaign.status,
              pendingCount,
            },
            'Campaign already sending with no pending recipients - duplicate enqueue attempt blocked',
          );
          return {
            ok: false,
            reason: 'already_sending_no_pending',
          };
        } else {
          logger.info(
            {
              storeId,
              campaignId,
              status: campaign.status,
              pendingCount,
            },
            'Campaign already sending but has pending recipients - will enqueue existing recipients only',
          );
          return { ok: true, statusUnchanged: true, pendingCount };
        }
      }

      // If campaign is not in an enqueueable status, reject
      // Aligned with Retail: draft, scheduled, paused can be enqueued
      if (
        ![
          CampaignStatus.draft,
          CampaignStatus.scheduled,
          CampaignStatus.paused,
        ].includes(campaign.status)
      ) {
        return {
          ok: false,
          reason: `invalid_status:${campaign.status}`,
        };
      }

      // CRITICAL: Atomically transition status from draft/scheduled to sending
      // This prevents race conditions where multiple requests try to enqueue the same campaign
      const previousStatus = campaign.status; // Store for potential rollback

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:814',message:'BEFORE atomic status update',data:{campaignId,currentStatus:campaign.status,previousStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
      // #endregion
      const updateResult = await tx.campaign.updateMany({
        where: {
          id: campaignId,
          shopId: storeId,
          status: {
            in: [CampaignStatus.draft, CampaignStatus.scheduled, CampaignStatus.paused],
          },
        },
        data: {
          status: CampaignStatus.sending,
          startedAt: new Date(), // Aligned with Retail: track when campaign started
          updatedAt: new Date(),
        },
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:830',message:'AFTER atomic status update',data:{campaignId,updateCount:updateResult.count,currentStatus:campaign.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
      // #endregion

      // If update count is 0, another request already updated the status
      if (updateResult.count === 0) {
        // Re-check status to see what happened
        const recheck = await tx.campaign.findUnique({
          where: { id: campaignId },
          select: { status: true },
        });

        if (recheck?.status === CampaignStatus.sending) {
          // Another request is handling this campaign
          return {
            ok: false,
            reason: 'already_sending_race_condition',
          };
        }

        return {
          ok: false,
          reason: 'status_changed_concurrently',
        };
      }

      return { ok: true, statusUnchanged: false, previousStatus };
    }, {
      timeout: 5000,
      maxWait: 5000,
    });
  } catch (txError) {
    txError.step = step;
    logger.error(
      {
        storeId,
        campaignId,
        requestId,
        step,
        error: txError.message,
        code: txError.code,
        meta: txError.meta,
        stack: txError.stack,
      },
      'Failed to atomically update campaign status',
    );
    const { toPublicError } = await import('../utils/errors.js');
    return {
      ok: false,
      reason: 'transaction_failed',
      enqueuedJobs: 0,
      message: 'transaction_failed',
      details: toPublicError(txError, { requestId, step }),
      error: txError,
    };
  }

  // If status transition failed, return early
  if (!statusTransitionResult.ok) {
    return { ...statusTransitionResult, enqueuedJobs: 0 };
  }

  // 1) Fetch full campaign data and build audience OUTSIDE transaction (heavy work)
  step = 'load_campaign';
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, shopId: storeId },
    select: {
      id: true,
      name: true,
      message: true,
      audience: true,
      status: true,
      priority: true,
    },
  });

  if (!campaign) {
    return { ok: false, reason: 'not_found', enqueuedJobs: 0 };
  }

  // Build audience OUTSIDE transaction (this can be slow with many contacts)
  let contacts = [];
  try {
    step = 'resolve_audience';
    contacts = await resolveRecipients(storeId, campaign.audience);
  } catch (error) {
    error.step = 'resolve_audience';
    logger.error(
      { storeId, campaignId, requestId, step: 'resolve_audience', error: error.message, stack: error.stack },
      'Failed to resolve recipients',
    );

    // Release credit reservation if it exists
    if (creditReservation) {
      try {
        const { releaseCredits } = await import('./wallet.js');
        await releaseCredits(creditReservation.id, {
          reason: 'audience_resolution_failed',
        });
      } catch (releaseError) {
        logger.error(
          { storeId, campaignId, reservationId: creditReservation.id, error: releaseError.message },
          'Failed to release credit reservation after audience resolution failure',
        );
      }
    }

    await prisma.campaign.updateMany({
      where: { id: campaign.id, shopId: storeId },
      data: { status: 'failed', updatedAt: new Date() },
    });
    const { toPublicError } = await import('../utils/errors.js');
    return {
      ok: false,
      reason: 'audience_resolution_failed',
      enqueuedJobs: 0,
      message: 'audience_resolution_failed',
      details: toPublicError(error, { requestId, step: 'resolve_audience' }),
      error,
    };
  }

  if (!contacts.length) {
    logger.warn(
      { storeId, campaignId },
      'No eligible recipients found',
    );

    // Release credit reservation
    if (creditReservation) {
      try {
        const { releaseCredits } = await import('./wallet.js');
        await releaseCredits(creditReservation.id, {
          reason: 'no_recipients',
        });
      } catch (releaseError) {
        logger.error(
          { storeId, campaignId, reservationId: creditReservation.id, error: releaseError.message },
          'Failed to release credit reservation after no recipients',
        );
      }
    }

    await prisma.campaign.updateMany({
      where: { id: campaign.id, shopId: storeId },
      data: { status: 'failed', updatedAt: new Date() },
    });
    return {
      ok: false,
      reason: 'no_recipients',
      enqueuedJobs: 0,
      message: 'No eligible recipients found for this campaign. Please check your audience filters or contact list.',
      details: {
        actionable: true,
        action: 'check_audience',
      },
    };
  }

  logger.info(
    { storeId, campaignId, recipientCount: contacts.length },
    'Audience built, checking subscription and credits',
  );

  // 1) Re-check subscription status before reserving credits
  const subscriptionActive = await isSubscriptionActive(storeId);
  if (!subscriptionActive) {
    logger.warn(
      { storeId, campaignId },
      'Inactive subscription - campaign enqueue blocked',
    );
    // Revert campaign status back to scheduled/draft
    await prisma.campaign.updateMany({
      where: {
        id: campaignId,
        shopId: storeId,
        status: CampaignStatus.sending,
      },
      data: {
        status:
          statusTransitionResult.previousStatus || CampaignStatus.draft,
        updatedAt: new Date(),
      },
    });
    return {
      ok: false,
      reason: 'subscription_required',
      enqueuedJobs: 0,
      message: 'Active subscription required to send SMS campaigns. Please subscribe to a plan to continue.',
      details: {
        actionable: true,
        action: 'subscribe',
      },
    };
  }

  // 2) Check allowance and credits (allowance first, then credits)
  const { getAvailableBalance, reserveCredits } = await import('./wallet.js');
  const shop = await prisma.shop.findUnique({
    where: { id: storeId },
    select: {
      includedSmsPerPeriod: true,
      usedSmsThisPeriod: true,
    },
  });

  const requiredCredits = contacts.length;
  const remainingAllowance = shop?.includedSmsPerPeriod
    ? Math.max(0, shop.includedSmsPerPeriod - (shop.usedSmsThisPeriod || 0))
    : 0;
  const availableBalance = await getAvailableBalance(storeId);
  const totalAvailable = remainingAllowance + availableBalance;

  if (totalAvailable < requiredCredits) {
    logger.warn(
      {
        storeId,
        campaignId,
        remainingAllowance,
        availableBalance,
        totalAvailable,
        requiredCredits,
      },
      'Insufficient allowance + credits',
    );
    // Revert campaign status back to scheduled/draft
    await prisma.campaign.updateMany({
      where: {
        id: campaignId,
        shopId: storeId,
        status: CampaignStatus.sending,
      },
      data: {
        status:
          statusTransitionResult.previousStatus || CampaignStatus.draft,
        updatedAt: new Date(),
      },
    });
    return {
      ok: false,
      reason: 'insufficient_credits',
      enqueuedJobs: 0,
      message: `Insufficient balance. You have ${remainingAllowance} free SMS remaining and ${availableBalance} paid credits (total: ${totalAvailable}), but need ${requiredCredits} to send this campaign.`,
      details: {
        remainingAllowance,
        availableCredits: availableBalance,
        totalAvailable,
        requiredCredits,
        missingCredits: requiredCredits - totalAvailable,
        actionable: true,
        action: 'purchase_credits',
      },
    };
  }

  // Calculate how many credits to reserve (after allowance is used)
  const creditsToReserve = Math.max(0, requiredCredits - remainingAllowance);

  // Reserve credits for this campaign (prevents depletion mid-campaign)
  // P0: Use reservationKey for idempotency
  const idempotencyService = (await import('./idempotency.js')).default;
  const reservationKey = idempotencyService.generateReservationKey(storeId, campaignId);
  if (creditsToReserve > 0) {
    try {
      creditReservation = await reserveCredits(storeId, creditsToReserve, {
        campaignId,
        reservationKey, // P0: Idempotency key
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiration
        meta: {
          campaignName: campaign.name,
          recipientCount: contacts.length,
          allowanceUsed: Math.min(requiredCredits, remainingAllowance),
        },
      });
      logger.info(
        {
          storeId,
          campaignId,
          reservationId: creditReservation.id,
          amount: creditsToReserve,
        },
        'Credits reserved for campaign',
      );
    } catch (reservationError) {
      logger.error(
        {
          storeId,
          campaignId,
          error: reservationError.message,
        },
        'Failed to reserve credits',
      );
      // Revert campaign status
      await prisma.campaign.updateMany({
        where: {
          id: campaignId,
          shopId: storeId,
          status: CampaignStatus.sending,
        },
        data: {
          status:
            statusTransitionResult.previousStatus || CampaignStatus.draft,
          updatedAt: new Date(),
        },
      });
      return {
        ok: false,
        reason: 'credit_reservation_failed',
        enqueuedJobs: 0,
      };
    }
  }

  // If status was already 'sending', skip recipient creation and only enqueue existing pending recipients
  let existingRecipients = [];
  let recipientsData = [];

  if (statusTransitionResult.statusUnchanged) {
    logger.info(
      {
        storeId,
        campaignId,
        pendingCount: statusTransitionResult.pendingCount,
      },
      'Campaign already in sending status - skipping recipient creation, will enqueue existing pending recipients only',
    );
    // Skip to enqueue step (step 6) - recipients already exist
    // Fetch existing recipients for logging purposes
    existingRecipients = await prisma.campaignRecipient.findMany({
      where: {
        campaignId: campaign.id,
      },
      select: {
        phoneE164: true,
      },
    });
  } else {
    // 4) Check if recipients already exist (idempotency check)
    // This prevents duplicate recipients if enqueueCampaign is called multiple times
    existingRecipients = await prisma.campaignRecipient.findMany({
      where: {
        campaignId: campaign.id,
      },
      select: {
        phoneE164: true,
      },
    });

    const existingPhones = new Set(existingRecipients.map(r => r.phoneE164));

    // Filter out contacts that already have recipients (idempotency)
    const newContacts = contacts.filter(
      contact => !existingPhones.has(contact.phoneE164),
    );

    if (newContacts.length === 0 && existingRecipients.length > 0) {
      logger.warn(
        {
          storeId,
          campaignId,
          existingCount: existingRecipients.length,
          requestedCount: contacts.length,
        },
        'All recipients already exist, skipping creation (idempotency)',
      );
      // Continue to enqueue existing recipients
    } else if (newContacts.length < contacts.length) {
      logger.info(
        {
          storeId,
          campaignId,
          newCount: newContacts.length,
          existingCount: existingRecipients.length,
          totalRequested: contacts.length,
        },
        'Some recipients already exist, creating only new ones (idempotency)',
      );
    }

    // 5) Create recipient records and prepare messages
    // Note: Credits are NOT debited here - they will be debited per message after successful send
    const messageTemplate = campaign.message;

    if (!messageTemplate || !messageTemplate.trim()) {
      logger.error({ storeId, campaignId }, 'Campaign has no message text');

      // Release credit reservation
      if (creditReservation) {
        try {
          const { releaseCredits } = await import('./wallet.js');
          await releaseCredits(creditReservation.id, {
            reason: 'no_message_text',
          });
        } catch (releaseError) {
          logger.error(
            { storeId, campaignId, reservationId: creditReservation.id, error: releaseError.message },
            'Failed to release credit reservation after no message text',
          );
        }
      }

      await prisma.campaign.updateMany({
        where: { id: campaign.id, shopId: storeId },
        data: { status: CampaignStatus.failed, updatedAt: new Date() },
      });
      return { ok: false, reason: 'no_message_text', enqueuedJobs: 0 };
    }

    // Generate recipient records (only for new contacts)
    // Note: Message personalization (including discount codes) and unsubscribe links
    // are added in the worker (see queue/jobs/bulkSms.js) to avoid storing
    // full message text in DB
    recipientsData = newContacts.map(contact => {
      // Note: Message personalization and unsubscribe links are added in the worker
      // (see queue/jobs/bulkSms.js) to avoid storing full message text in DB
      return {
        campaignId: campaign.id,
        contactId: contact.contactId,
        phoneE164: contact.phoneE164,
        status: 'pending', // Will be updated to 'sent' or 'failed' by worker
        retryCount: 0,
      };
    });

    try {
      // For large campaigns (>10k recipients), batch the createMany operation
      const BATCH_SIZE = 10000;
      const recipientCount = recipientsData.length;

      if (recipientCount > BATCH_SIZE) {
        logger.info(
          { storeId, campaignId, recipientCount },
          'Large campaign detected, using batched inserts',
        );

        // Batch create recipients
        for (let i = 0; i < recipientsData.length; i += BATCH_SIZE) {
          const batch = recipientsData.slice(i, i + BATCH_SIZE);
          await prisma.campaignRecipient.createMany({
            data: batch,
            skipDuplicates: true,
          });
          logger.debug(
            {
              storeId,
              campaignId,
              batch: Math.floor(i / BATCH_SIZE) + 1,
              totalBatches: Math.ceil(recipientCount / BATCH_SIZE),
            },
            'Batch inserted',
          );
        }
      } else {
        // For smaller campaigns, use single createMany
        await prisma.campaignRecipient.createMany({
          data: recipientsData,
          skipDuplicates: true,
        });
      }
    } catch (e) {
      logger.error(
        { storeId, campaignId, err: e.message, contactCount: contacts.length },
        'Failed to create campaign recipients',
      );

      // Release credit reservation
      if (creditReservation) {
        try {
          const { releaseCredits } = await import('./wallet.js');
          await releaseCredits(creditReservation.id, {
            reason: 'recipient_creation_failed',
          });
        } catch (releaseError) {
          logger.error(
            { storeId, campaignId, reservationId: creditReservation.id, error: releaseError.message },
            'Failed to release credit reservation after recipient creation failure',
          );
        }
      }

      // Revert campaign status
      await prisma.campaign.updateMany({
        where: { id: campaign.id, shopId: storeId },
        data: { status: CampaignStatus.draft, updatedAt: new Date() },
      });
      throw e;
    }
  }

  // 6) Enqueue jobs to Redis (OUTSIDE transaction, non-blocking)
  // Campaigns always use bulk SMS with fixed batch size
  // CRITICAL: Only enqueue recipients that are pending and haven't been sent yet
  const toEnqueue = await prisma.campaignRecipient.findMany({
    where: {
      campaignId: campaign.id,
      status: 'pending',
      mittoMessageId: null, // Idempotency: only process unsent
    },
    select: { id: true },
  });

  // Additional safety check: log if we find recipients that should not be enqueued
  if (toEnqueue.length === 0 && existingRecipients.length > 0) {
    const alreadySent = await prisma.campaignRecipient.count({
      where: {
        campaignId: campaign.id,
        status: { in: ['sent', 'failed'] },
      },
    });
    logger.info(
      {
        storeId,
        campaignId,
        totalRecipients: existingRecipients.length,
        alreadySent,
        pending: 0,
      },
      'No pending recipients to enqueue (all already processed)',
    );
  }

  /**
   * Generate unique job ID based on recipient IDs hash
   * This ensures that even if the same batchIndex is used, different recipientIds
   * will create different jobIds, preventing duplicate sends
   */
  function generateJobId(campaignId, recipientIds) {
    // Sort recipientIds to ensure consistent hash regardless of order
    const sortedIds = [...recipientIds].sort((a, b) => a.localeCompare(b));
    const idsString = sortedIds.join(',');
    // Create short hash (first 8 chars of SHA256) for jobId
    const hash = createHash('sha256').update(idsString).digest('hex').substring(0, 8);
    return `batch:${campaignId}:${hash}`;
  }

  /**
   * Check if a job with the same recipientIds already exists (waiting, active, delayed, or recently completed)
   * This prevents duplicate enqueues even if the jobId doesn't match
   */
  async function checkExistingJob(campaignId, recipientIds) {
    try {
      // Get all active jobs (waiting, active, delayed) and recently completed jobs
      const [waiting, active, delayed, completed] = await Promise.all([
        smsQueue.getWaiting(),
        smsQueue.getActive(),
        smsQueue.getDelayed(),
        smsQueue.getCompleted(0, 100), // Check last 100 completed jobs (recently completed might still be processing)
      ]);

      const allActiveJobs = [...waiting, ...active, ...delayed, ...completed];

      // Check if any job has the same recipientIds
      for (const job of allActiveJobs) {
        if (
          job.name === 'sendBulkSMS' &&
          job.data?.campaignId === campaignId &&
          job.data?.recipientIds &&
          Array.isArray(job.data.recipientIds)
        ) {
          // Compare recipientIds (sorted for comparison)
          const jobRecipientIds = [...job.data.recipientIds].sort((a, b) =>
            a.localeCompare(b),
          );
          const currentRecipientIds = [...recipientIds].sort((a, b) =>
            a.localeCompare(b),
          );

          if (
            jobRecipientIds.length === currentRecipientIds.length &&
            jobRecipientIds.every((id, idx) => id === currentRecipientIds[idx])
          ) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1356',message:'DUPLICATE FOUND in checkExistingJob',data:{campaignId,jobId:job.id,jobState:job.state||'unknown',recipientCount:recipientIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(() => {});
            // #endregion
            logger.warn(
              {
                campaignId,
                jobId: job.id,
                jobState: job.state || 'unknown',
                recipientCount: recipientIds.length,
              },
              'Duplicate batch job found (same recipients already enqueued or processed)',
            );
            return true; // Duplicate job found
          }
        }
      }

      return false; // No duplicate found
    } catch (err) {
      logger.warn(
        { campaignId, err: err.message },
        'Failed to check for existing jobs, continuing anyway',
      );
      return false; // On error, allow enqueue (fail open)
    }
  }

  let enqueuedJobs = 0;
  if (smsQueue && toEnqueue.length > 0) {
    // Fixed batch size for bulk SMS
    const SMS_BATCH_SIZE = Number(process.env.SMS_BATCH_SIZE || 5000);

    // Group recipients into fixed-size batches
    const batches = [];
    for (let i = 0; i < toEnqueue.length; i += SMS_BATCH_SIZE) {
      batches.push(toEnqueue.slice(i, i + SMS_BATCH_SIZE).map(r => r.id));
    }

    logger.info(
      {
        storeId,
        campaignId,
        totalRecipients: toEnqueue.length,
        batchCount: batches.length,
        batchSize: SMS_BATCH_SIZE,
      },
      'Enqueuing bulk SMS batch jobs',
    );

    // Enqueue batch jobs with duplicate checking
    const enqueuePromises = batches.map(async (recipientIds, batchIndex) => {
      // CRITICAL: Check if a job with the same recipientIds already exists
      const isDuplicate = await checkExistingJob(campaign.id, recipientIds);
      if (isDuplicate) {
        logger.warn(
          {
            storeId,
            campaignId,
            batchIndex,
            recipientCount: recipientIds.length,
            recipientIds: recipientIds.slice(0, 5), // Log first 5 for debugging
          },
          'Duplicate batch job detected (same recipients already enqueued), skipping',
        );
        return { enqueued: false, skipped: true, recipientCount: recipientIds.length };
      }

      // Generate unique jobId based on recipientIds hash
      const jobId = generateJobId(campaign.id, recipientIds);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1422',message:'Generated jobId',data:{campaignId,batchIndex,jobId,recipientCount:recipientIds.length,first5Recipients:recipientIds.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(() => {});
      // #endregion

      try {
        // CRITICAL: Check if job already exists using atomic getJob
        // This prevents race conditions where multiple requests try to add the same job
        const existingJob = await smsQueue.getJob(jobId);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1427',message:'getJob result',data:{campaignId,jobId,existingJobFound:!!existingJob},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(() => {});
        // #endregion
        if (existingJob) {
          const jobState = await existingJob.getState();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1429',message:'Existing job state',data:{campaignId,jobId,jobState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(() => {});
          // #endregion
          if (['waiting', 'active', 'delayed', 'completed'].includes(jobState)) {
            logger.warn(
              {
                storeId,
                campaignId,
                batchIndex,
                jobId,
                jobState,
                recipientCount: recipientIds.length,
              },
              'Job with same jobId already exists, skipping duplicate',
            );
            return { enqueued: false, skipped: true, recipientCount: recipientIds.length };
          }
        }

        // Map campaign priority to BullMQ priority (higher number = higher priority)
        const priorityMap = {
          low: 1,
          normal: 5,
          high: 10,
          urgent: 20,
        };
        const queuePriority = priorityMap[campaign.priority || 'normal'] || 5;

        await smsQueue.add(
          'sendBulkSMS',
          {
            campaignId: campaign.id,
            shopId: storeId,
            recipientIds,
          },
          {
            // CRITICAL: Use hash of recipientIds in jobId for true idempotency
            // This ensures that even if removeOnComplete removes a job,
            // the same recipients won't be enqueued again with a different jobId
            jobId,
            priority: queuePriority, // Higher priority campaigns processed first
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: {
              age: 3600, // Keep completed jobs for 1 hour to prevent duplicates
              count: 1000, // Keep last 1000 completed jobs
            },
            removeOnFail: false, // Keep failed jobs for debugging
          },
        );

        logger.debug(
          {
            storeId,
            campaignId,
            batchIndex,
            jobId,
            recipientCount: recipientIds.length,
          },
          'Batch job enqueued',
        );
        return { enqueued: true, skipped: false, recipientCount: recipientIds.length };
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1489',message:'smsQueue.add ERROR',data:{campaignId,batchIndex,jobId,error:err.message,errorCode:err.code,isDuplicate:err.message?.includes('already exists')||err.code==='DUPLICATE_JOB'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(() => {});
        // #endregion
        // Check if error is due to duplicate jobId (BullMQ throws error for duplicate jobIds)
        if (err.message?.includes('already exists') || err.code === 'DUPLICATE_JOB') {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1491',message:'DUPLICATE JOB ERROR caught',data:{campaignId,batchIndex,jobId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(() => {});
          // #endregion
          logger.warn(
            {
              storeId,
              campaignId,
              batchIndex,
              jobId,
              recipientCount: recipientIds.length,
            },
            'Job with same jobId already exists, skipping duplicate',
          );
          return { enqueued: false, skipped: true, recipientCount: recipientIds.length };
        } else {
          logger.error(
            {
              storeId,
              campaignId,
              batchIndex,
              jobId,
              err: err.message,
            },
            'Failed to enqueue batch job',
          );
          // Continue even if some batches fail to enqueue
          return { enqueued: false, skipped: false, error: err.message, recipientCount: recipientIds.length };
        }
      }
    });

    // Wait for all batches to complete and calculate enqueuedJobs from results
    // This prevents race conditions in the counter and ensures accurate tracking
    try {
      const results = await Promise.allSettled(enqueuePromises);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1526',message:'Promise.allSettled results',data:{campaignId,totalBatches:batches.length,resultsCount:results.length,fulfilled:results.filter(r => r.status==='fulfilled').length,rejected:results.filter(r => r.status==='rejected').length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
      // #endregion

      // Calculate enqueuedJobs from results (no race condition)
      enqueuedJobs = results.reduce((total, result) => {
        if (result.status === 'fulfilled' && result.value?.enqueued) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1530',message:'Batch ENQUEUED in results',data:{campaignId,recipientCount:result.value.recipientCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
          // #endregion
          return total + (result.value.recipientCount || 0);
        }
        if (result.status === 'fulfilled' && result.value?.skipped) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1533',message:'Batch SKIPPED in results',data:{campaignId,recipientCount:result.value.recipientCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
          // #endregion
        }
        return total;
      }, 0);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/72a17531-4a03-4868-9574-6d14ee68fc32',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'campaigns.js:1534',message:'Total enqueuedJobs calculated',data:{campaignId,enqueuedJobs,totalBatches:batches.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(() => {});
      // #endregion

      // Log skipped and failed batches for debugging
      const skippedBatches = results.filter(r => r.status === 'fulfilled' && r.value?.skipped).length;
      const failedBatches = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)).length;

      if (skippedBatches > 0 || failedBatches > 0) {
        logger.info(
          {
            storeId,
            campaignId,
            totalBatches: batches.length,
            skippedBatches,
            failedBatches,
            enqueuedJobs,
          },
          'Batch enqueue completed with some skipped/failed batches',
        );
      }
    } catch (err) {
      logger.error(
        { storeId, campaignId, err: err.message },
        'Error waiting for batch jobs to enqueue',
      );
    }
  } else {
    logger.warn(
      'SMS queue not available — recipients created but not enqueued',
    );
  }

  logger.info(
    {
      storeId,
      campaignId,
      queued: recipientsData.length,
      enqueuedJobs,
    },
    'Campaign enqueued successfully',
  );

  return {
    ok: true,
    queued: recipientsData.length,
    enqueuedJobs,
    campaignId: campaign.id,
  };
}

/**
 * Send campaign immediately (now uses bulk SMS via enqueueCampaign)
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Send result
 */
export async function sendCampaign(storeId, campaignId) {
  logger.info('Sending campaign (bulk SMS)', { storeId, campaignId });

  // Use new bulk SMS enqueue function
  const result = await enqueueCampaign(storeId, campaignId);

  if (!result.ok) {
    // Map error reasons to appropriate errors
    if (result.reason === 'not_found') {
      throw new NotFoundError('Campaign');
    }
    if (
      result.reason === 'subscription_required' ||
      result.reason === 'inactive_subscription'
    ) {
      throw new SubscriptionRequiredError(
        'Active subscription required to send SMS. Please subscribe to a plan.',
      );
    }
    if (result.reason === 'insufficient_credits') {
      throw new InsufficientCreditsError(0, 0); // Will be handled by caller
    }
    throw new ValidationError(
      `Campaign cannot be sent: ${result.reason}`,
    );
  }

  return {
    campaignId: result.campaignId,
    recipientCount: result.queued,
    status: CampaignStatus.sending,
    queuedAt: new Date(),
  };
}

/**
 * Cancel a campaign that is currently sending
 * Stops processing remaining batches and releases credit reservation
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Cancel result
 */
export async function cancelCampaign(storeId, campaignId) {
  logger.info('Cancelling campaign', { storeId, campaignId });

  // 1. Verify campaign exists and belongs to store
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
    select: { id: true, status: true },
  });

  if (!campaign) {
    return { ok: false, reason: 'not_found' };
  }

  // 2. Only allow cancellation if campaign is in 'sending' status
  if (campaign.status !== CampaignStatus.sending) {
    return {
      ok: false,
      reason: `invalid_status:${campaign.status}`,
      message: `Campaign cannot be cancelled in ${campaign.status} status`,
    };
  }

  // 3. Update campaign status to 'cancelled'
  await prisma.campaign.updateMany({
    where: { id: campaignId, shopId: storeId, status: CampaignStatus.sending },
    data: { status: CampaignStatus.cancelled, updatedAt: new Date() },
  });

  // 4. Remove pending jobs from queue
  let removedJobs = 0;
  if (smsQueue) {
    try {
      const [waiting, delayed] = await Promise.all([
        smsQueue.getWaiting(),
        smsQueue.getDelayed(),
      ]);

      const allPendingJobs = [...waiting, ...delayed];

      for (const job of allPendingJobs) {
        if (
          job.name === 'sendBulkSMS' &&
          job.data?.campaignId === campaignId
        ) {
          await job.remove();
          removedJobs++;
        }
      }

      logger.info(
        { storeId, campaignId, removedJobs },
        'Removed pending jobs from queue',
      );
    } catch (queueError) {
      logger.error(
        {
          storeId,
          campaignId,
          error: queueError.message,
        },
        'Failed to remove jobs from queue',
      );
      // Continue even if queue removal fails
    }
  }

  // 5. Mark pending recipients as cancelled
  const cancelledCount = await prisma.campaignRecipient.updateMany({
    where: {
      campaignId,
      status: 'pending',
    },
    data: {
      status: 'cancelled',
    },
  });

  logger.info(
    { storeId, campaignId, cancelledRecipients: cancelledCount.count },
    'Marked pending recipients as cancelled',
  );

  // 6. Release credit reservation
  try {
    const { releaseCredits } = await import('./wallet.js');
    const reservation = await prisma.creditReservation.findFirst({
      where: {
        campaignId,
        shopId: storeId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (reservation) {
      await releaseCredits(reservation.id, {
        reason: 'campaign_cancelled',
      });
      logger.info(
        { storeId, campaignId, reservationId: reservation.id },
        'Credit reservation released after campaign cancellation',
      );
    }
  } catch (releaseError) {
    logger.error(
      {
        storeId,
        campaignId,
        error: releaseError.message,
      },
      'Failed to release credit reservation after cancellation',
    );
    // Continue even if release fails
  }

  // 7. Update campaign aggregates
  try {
    const { updateCampaignAggregates } = await import('./campaignAggregates.js');
    await updateCampaignAggregates(campaignId, storeId);
  } catch (aggError) {
    logger.warn(
      { storeId, campaignId, error: aggError.message },
      'Failed to update campaign aggregates after cancellation',
    );
  }

  return {
    ok: true,
    campaignId,
    cancelledRecipients: cancelledCount.count,
    removedJobs,
  };
}

/**
 * Get campaign preview (recipient count and estimated cost)
 * Does not modify campaign status - safe to call multiple times
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Preview data with recipient count and estimated cost
 */
export async function getCampaignPreview(storeId, campaignId) {
  logger.info('Getting campaign preview', { storeId, campaignId });

  // 1. Verify campaign exists and belongs to store
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
    select: {
      id: true,
      name: true,
      message: true,
      audience: true,
      status: true,
      discountId: true,
    },
  });

  if (!campaign) {
    return { ok: false, reason: 'not_found' };
  }

  // 2. Check subscription status
  const { isSubscriptionActive } = await import('./subscription.js');
  const subscriptionActive = await isSubscriptionActive(storeId);
  if (!subscriptionActive) {
    return {
      ok: false,
      reason: 'subscription_required',
      message: 'Active subscription required to send SMS',
    };
  }

  // 3. Resolve recipients (same logic as enqueueCampaign)
  let contacts = [];
  try {
    contacts = await resolveRecipients(storeId, campaign.audience);
  } catch (error) {
    logger.error(
      { storeId, campaignId, error: error.message },
      'Failed to resolve recipients for preview',
    );
    return {
      ok: false,
      reason: 'audience_resolution_failed',
      message: 'Failed to resolve recipients',
    };
  }

  // 4. Get available balance and allowance
  const { getAvailableBalance } = await import('./wallet.js');
  const [availableBalance, shop] = await Promise.all([
    getAvailableBalance(storeId),
    prisma.shop.findUnique({
      where: { id: storeId },
      select: {
        includedSmsPerPeriod: true,
        usedSmsThisPeriod: true,
      },
    }),
  ]);
  const requiredCredits = contacts.length;
  const remainingAllowance = shop?.includedSmsPerPeriod
    ? Math.max(0, shop.includedSmsPerPeriod - (shop.usedSmsThisPeriod || 0))
    : 0;
  const totalAvailable = remainingAllowance + availableBalance;

  // 4.5 Best-effort message preview that matches the send pipeline (includes shortened unsubscribe).
  // Uses the first resolved recipient as the preview contact.
  let renderedMessage = null;
  try {
    if (contacts.length > 0) {
      const previewContact = contacts[0];
      const { replacePlaceholders } = await import('../utils/personalization.js');
      const { shortenUrlsInText } = await import('../utils/urlShortener.js');
      const { appendUnsubscribeLink } = await import('../utils/unsubscribe.js');

      // Optional discount code (best-effort)
      let discountCode = '';
      if (campaign.discountId) {
        try {
          const { getDiscountCode } = await import('./shopify.js');
          const shop = await prisma.shop.findUnique({
            where: { id: storeId },
            select: { shopDomain: true },
          });
          if (shop?.shopDomain) {
            const discount = await getDiscountCode(shop.shopDomain, campaign.discountId);
            discountCode = discount?.code || '';
          }
        } catch {
          discountCode = '';
        }
      }

      let messageText = campaign.message || '';
      messageText = replacePlaceholders(messageText, {
        firstName: previewContact.firstName || '',
        lastName: previewContact.lastName || '',
        discountCode,
      });
      messageText = await shortenUrlsInText(messageText, {
        shopId: storeId,
        campaignId,
        contactId: previewContact.contactId,
      });
      renderedMessage = await appendUnsubscribeLink(
        messageText,
        previewContact.contactId,
        storeId,
        previewContact.phoneE164,
        null,
        { campaignId, recipientId: null },
      );
    }
  } catch {
    renderedMessage = null;
  }

  // 5. Return preview data
  return {
    ok: true,
    recipientCount: contacts.length,
    estimatedCost: requiredCredits, // 1 credit per SMS
    availableCredits: availableBalance,
    remainingAllowance,
    totalAvailable,
    canSend: contacts.length > 0 && totalAvailable >= requiredCredits,
    insufficientCredits: totalAvailable < requiredCredits,
    missingCredits: Math.max(0, requiredCredits - totalAvailable),
    renderedMessage,
  };
}

/**
 * Schedule campaign for later
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @param {Object} scheduleData - Schedule data
 * @returns {Promise<Object>} Updated campaign
 *
 * Note: scheduleAt should be provided as an ISO 8601 datetime string in UTC.
 * The frontend should convert the user's selected time (in their shop's timezone)
 * to UTC before sending to this endpoint. When a scheduler processes scheduled
 * campaigns, it should use the shop's timezone setting to determine the correct
 * send time.
 */
export async function scheduleCampaign(storeId, campaignId, scheduleData) {
  logger.info('Scheduling campaign', { storeId, campaignId, scheduleData });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
  });

  if (!campaign) {
    throw new NotFoundError('Campaign');
  }

  if (!scheduleData.scheduleAt) {
    throw new ValidationError('Schedule date is required');
  }

  const scheduleAt = new Date(scheduleData.scheduleAt);

  if (isNaN(scheduleAt.getTime())) {
    throw new ValidationError(
      'Invalid schedule date format. Please use ISO 8601 format.',
    );
  }

  if (scheduleAt <= new Date()) {
    throw new ValidationError('Schedule date must be in the future');
  }

  // Get shop timezone for logging and future scheduler implementation
  const shopSettings = await prisma.shopSettings.findUnique({
    where: { shopId: storeId },
    select: { timezone: true },
  });
  const shopTimezone = shopSettings?.timezone || 'UTC';

  // Update campaign
  // Note: scheduleAt is stored in UTC. When a scheduler processes scheduled campaigns,
  // it should check campaigns where status='scheduled' and scheduleAt <= now(),
  // then call sendCampaign() for each. The scheduler should respect the shop's
  // timezone setting when determining the correct send time (though scheduleAt is in UTC).
  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      scheduleType: scheduleData.scheduleType || ScheduleType.scheduled,
      scheduleAt,
      status: CampaignStatus.scheduled,
    },
  });

  logger.info('Campaign scheduled successfully', {
    storeId,
    campaignId,
    scheduleAt: scheduleAt.toISOString(),
    shopTimezone,
    note: 'scheduleAt is stored in UTC. Frontend converts shop timezone to UTC before sending.',
  });

  return updated;
}

/**
 * Retry failed SMS for a campaign
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Retry result
 */
export async function retryFailedSms(storeId, campaignId) {
  logger.info('Retrying failed SMS for campaign', { storeId, campaignId });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
    include: {
      shop: {
        include: {
          settings: {
            select: { senderName: true, senderNumber: true },
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError('Campaign');
  }

  // Get all failed recipients for this campaign
  const failedRecipients = await prisma.campaignRecipient.findMany({
    where: {
      campaignId,
      status: 'failed',
    },
  });

  if (failedRecipients.length === 0) {
    return {
      campaignId,
      retried: 0,
      message: 'No failed recipients to retry',
    };
  }

  // Get sender configuration
  const shopSettings = await prisma.shopSettings.findUnique({
    where: { shopId: storeId },
    select: { senderName: true, senderNumber: true },
  });
  const sender =
    shopSettings?.senderName ||
    shopSettings?.senderNumber ||
    process.env.MITTO_SENDER_NAME ||
    'Astronote';

  // Reset failed recipients to pending status
  await prisma.campaignRecipient.updateMany({
    where: {
      campaignId,
      status: 'failed',
    },
    data: {
      status: 'pending',
      error: null,
    },
  });

  // Queue retry jobs for failed recipients
  const retryJobs = failedRecipients.map(recipient => ({
    name: 'sms-send',
    data: {
      campaignId,
      shopId: storeId,
      phoneE164: recipient.phoneE164,
      message: campaign.message,
      sender,
    },
  }));

  // Use bulk add for better performance
  const BATCH_SIZE = 1000;
  let totalQueued = 0;

  for (let i = 0; i < retryJobs.length; i += BATCH_SIZE) {
    const batch = retryJobs.slice(i, i + BATCH_SIZE);
    const jobsToAdd = batch.map(job => ({
      name: job.name,
      data: job.data,
    }));

    await smsQueue.addBulk(jobsToAdd);
    totalQueued += batch.length;
  }

  logger.info('Failed SMS queued for retry', {
    storeId,
    campaignId,
    retried: totalQueued,
  });

  return {
    campaignId,
    retried: totalQueued,
    message: `Queued ${totalQueued} failed SMS for retry`,
  };
}

/**
 * Get campaign metrics
 * @param {string} storeId - Store ID
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>} Campaign metrics
 */
export async function getCampaignMetrics(storeId, campaignId) {
  // Return metrics with sent/delivered/failed fields for API compatibility
  logger.info('Getting campaign metrics', { storeId, campaignId });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, shopId: storeId },
    include: { metrics: true },
  });

  if (!campaign) {
    throw new NotFoundError('Campaign');
  }

  logger.info('Campaign metrics retrieved', { storeId, campaignId });

  const metrics = campaign.metrics || {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalClicked: 0,
    totalProcessed: 0,
  };

  // Canonical delivery metrics (provider truth mirrored in DB)
  const canonicalById = await getCanonicalMetricsForCampaignIds([campaignId]);
  const canonical = canonicalById.get(campaignId);
  const canonicalTotals = canonical?.totals || {
    recipients: 0,
    accepted: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
  };
  const canonicalDelivery = canonical?.delivery || {
    pendingDelivery: 0,
    delivered: 0,
    failedDelivery: 0,
  };

  const totalRecipients = canonicalTotals.recipients || 0;

  // Calculate percentages
  const sentPercentage =
    totalRecipients > 0
      ? Math.round((canonicalTotals.accepted / totalRecipients) * 100 * 100) / 100
      : 0;
  const failedPercentage =
    totalRecipients > 0
      ? Math.round((canonicalTotals.failed / totalRecipients) * 100 * 100) / 100
      : 0;
  const deliveredPercentage =
    totalRecipients > 0
      ? Math.round((canonicalTotals.delivered / totalRecipients) * 100 * 100) / 100
      : 0;

  // Return with both old and new field names for API compatibility
  return {
    ...metrics,
    // Canonical fields (preferred by FE)
    totals: canonicalTotals,
    delivery: canonicalDelivery,
    accepted: canonicalTotals.accepted,
    pendingDelivery: canonicalDelivery.pendingDelivery,
    // Backward-compatible aliases (now explicitly defined)
    sent: canonicalTotals.accepted,
    delivered: canonicalTotals.delivered,
    failed: canonicalTotals.failed,
    totalRecipients,
    sentPercentage,
    failedPercentage,
    deliveredPercentage,
  };
}

/**
 * Get campaign statistics for store
 * @param {string} storeId - Store ID
 * @returns {Promise<Object>} Campaign statistics
 */
export async function getCampaignStats(storeId) {
  logger.info('Getting campaign stats', { storeId });

  const [total, statusStats, recentCampaigns] = await Promise.all([
    prisma.campaign.count({ where: { shopId: storeId } }),
    prisma.campaign.groupBy({
      by: ['status'],
      where: { shopId: storeId },
      _count: { status: true },
    }),
    prisma.campaign.findMany({
      where: { shopId: storeId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { metrics: true },
    }),
  ]);

  const completedCount =
    (statusStats.find(s => s.status === CampaignStatus.completed)?._count?.status || 0) +
    (statusStats.find(s => s.status === CampaignStatus.sent)?._count?.status || 0);

  const stats = {
    total,
    totalCampaigns: total, // Alias for consistency with expected response structure
    byStatus: {
      draft:
        statusStats.find(s => s.status === CampaignStatus.draft)?._count
          ?.status || 0,
      scheduled:
        statusStats.find(s => s.status === CampaignStatus.scheduled)?._count
          ?.status || 0,
      sending:
        statusStats.find(s => s.status === CampaignStatus.sending)?._count
          ?.status || 0,
      paused:
        statusStats.find(s => s.status === CampaignStatus.paused)?._count
          ?.status || 0,
      completed: completedCount,
      // Backward compatibility: older UI expects `sent` bucket
      sent: completedCount,
      failed:
        statusStats.find(s => s.status === CampaignStatus.failed)?._count
          ?.status || 0,
      cancelled:
        statusStats.find(s => s.status === CampaignStatus.cancelled)?._count
          ?.status || 0,
    },
    recent: recentCampaigns,
    recentCampaigns, // Alias for backward compatibility
  };

  logger.info('Campaign stats retrieved', { storeId, stats });

  return stats;
}

export default {
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  prepareCampaign,
  sendCampaign,
  enqueueCampaign,
  scheduleCampaign,
  cancelCampaign,
  getCampaignPreview,
  getCampaignMetrics,
  getCampaignStats,
  retryFailedSms,
};
