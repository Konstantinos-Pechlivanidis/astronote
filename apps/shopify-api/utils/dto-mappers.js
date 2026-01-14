/**
 * DTO Mappers
 *
 * Maps Prisma models to stable DTOs for API responses.
 * Ensures no raw Prisma objects leak to frontend.
 * All mappers ensure:
 * - IDs are always non-empty strings
 * - Dates are serialized to ISO strings
 * - Optional fields are explicitly null/undefined
 * - No undefined values in arrays/objects
 */

import { normalizeCampaignStatus } from '../constants/campaign-status.js';

/**
 * Map Campaign Prisma model to DTO
 * @param {Object} campaign - Prisma Campaign model
 * @returns {Object} Campaign DTO
 */
export function mapCampaignToDTO(campaign) {
  if (!campaign) return null;

  // Ensure ID is non-empty string
  const id = String(campaign.id || '').trim();
  if (!id) {
    throw new Error('Campaign ID must be non-empty');
  }

  const normalized = normalizeCampaignStatus(campaign.status);

  return {
    id,
    name: campaign.name || '',
    message: campaign.message || '',
    status: normalized.status || 'draft',
    statusRaw: normalized.statusRaw ?? null,
    audience: campaign.audience || 'all',
    discountId: campaign.discountId || null,
    scheduleType: campaign.scheduleType || 'immediate',
    scheduleAt: campaign.scheduleAt ? campaign.scheduleAt.toISOString() : null,
    recurringDays: campaign.recurringDays || null,
    priority: campaign.priority || 'normal',
    createdAt: campaign.createdAt ? campaign.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: campaign.updatedAt ? campaign.updatedAt.toISOString() : new Date().toISOString(),
    startedAt: campaign.startedAt ? campaign.startedAt.toISOString() : null,
    finishedAt: campaign.finishedAt ? campaign.finishedAt.toISOString() : null,
    // Metrics (optional)
    recipientCount: campaign.recipientCount ?? 0,
    sentCount: campaign.sentCount ?? 0,
    deliveredCount: campaign.deliveredCount ?? 0,
    failedCount: campaign.failedCount ?? 0,
    totalRecipients: campaign.totalRecipients ?? campaign.recipientCount ?? 0,
    // Metrics from relation (if included)
    totalSent: campaign.metrics?.totalSent ?? campaign.sentCount ?? 0,
    totalDelivered: campaign.metrics?.totalDelivered ?? campaign.deliveredCount ?? 0,
    totalFailed: campaign.metrics?.totalFailed ?? campaign.failedCount ?? 0,
    totalProcessed: campaign.metrics?.totalProcessed ?? 0,
    totalClicked: campaign.metrics?.totalClicked ?? 0,
    // Meta (JSON field)
    meta: campaign.meta || null,
    // Canonical status/metrics contract (new; backward compatible)
    totals: campaign.totals || null,
    delivery: campaign.delivery || null,
    sourceOfTruth: campaign.sourceOfTruth || 'mitto',
  };
}

/**
 * Map Template Prisma model to DTO
 * @param {Object} template - Prisma Template model
 * @returns {Object} Template DTO
 */
export function mapTemplateToDTO(template) {
  if (!template) return null;

  // Ensure ID is non-empty string
  const id = String(template.id || '').trim();
  if (!id) {
    throw new Error('Template ID must be non-empty');
  }

  // Ensure category is non-empty string
  const category = String(template.category || '').trim();
  if (!category) {
    throw new Error('Template category must be non-empty');
  }

  return {
    id,
    name: template.name || template.title || '',
    title: template.title || template.name || '', // Legacy field
    category,
    text: template.text || template.content || '',
    content: template.content || template.text || '', // Legacy field
    language: template.language || 'en',
    goal: template.goal || null,
    suggestedMetrics: template.suggestedMetrics || null,
    eshopType: template.eshopType || 'generic',
    previewImage: template.previewImage || null,
    tags: Array.isArray(template.tags) ? template.tags : [],
    useCount: template.useCount ?? 0,
    conversionRate: template.conversionRate ?? null,
    productViewsIncrease: template.productViewsIncrease ?? null,
    clickThroughRate: template.clickThroughRate ?? null,
    averageOrderValue: template.averageOrderValue ?? null,
    customerRetention: template.customerRetention ?? null,
    createdAt: template.createdAt ? template.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: template.updatedAt ? template.updatedAt.toISOString() : new Date().toISOString(),
  };
}

/**
 * Map Automation Prisma model to DTO
 * @param {Object} automation - Prisma Automation model
 * @param {Object} userAutomation - Optional UserAutomation relation
 * @returns {Object} Automation DTO
 */
export function mapAutomationToDTO(automation, userAutomation = null) {
  if (!automation) return null;

  // Ensure ID is non-empty string
  const id = String(automation.id || '').trim();
  if (!id) {
    throw new Error('Automation ID must be non-empty');
  }

  return {
    id,
    title: automation.title || '',
    description: automation.description || null,
    triggerEvent: automation.triggerEvent || null,
    defaultMessage: automation.defaultMessage || '',
    isSystemDefault: automation.isSystemDefault ?? false,
    isActive: userAutomation?.isActive ?? true,
    userMessage: userAutomation?.userMessage || null,
    createdAt: automation.createdAt ? automation.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: automation.updatedAt ? automation.updatedAt.toISOString() : new Date().toISOString(),
  };
}

/**
 * Map Segment Prisma model to DTO (for audience select)
 * @param {Object} segment - Prisma Segment model
 * @returns {Object} Segment DTO
 */
export function mapSegmentToDTO(segment) {
  if (!segment) return null;

  // Ensure ID is non-empty string
  const id = String(segment.id || '').trim();
  if (!id) {
    throw new Error('Segment ID must be non-empty');
  }

  return {
    id,
    name: segment.name || '',
    type: segment.type || 'custom',
    count: segment.count ?? null,
  };
}

/**
 * Map Discount Prisma model to DTO (for discount select)
 * @param {Object} discount - Prisma DiscountLink model
 * @returns {Object} Discount DTO
 */
export function mapDiscountToDTO(discount) {
  if (!discount) return null;

  // Ensure ID is non-empty string
  const id = String(discount.id || '').trim();
  if (!id) {
    throw new Error('Discount ID must be non-empty');
  }

  return {
    id,
    code: discount.code || '',
    title: discount.title || null,
    value: discount.value || null,
    type: discount.type || null,
  };
}

/**
 * Map Contact Prisma model to DTO
 * @param {Object} contact - Prisma Contact model
 * @returns {Object} Contact DTO
 */
export function mapContactToDTO(contact) {
  if (!contact) return null;

  // Ensure ID is non-empty string
  const id = String(contact.id || '').trim();
  if (!id) {
    throw new Error('Contact ID must be non-empty');
  }

  return {
    id,
    phone: contact.phoneE164 || '',
    phoneE164: contact.phoneE164 || '', // Backward compatibility
    email: contact.email || null,
    firstName: contact.firstName || null,
    lastName: contact.lastName || null,
    gender: contact.gender || null,
    birthday: contact.birthDate ? contact.birthDate.toISOString().split('T')[0] : null,
    birthDate: contact.birthDate ? contact.birthDate.toISOString().split('T')[0] : null, // Backward compatibility
    isSubscribed: contact.isSubscribed ?? true,
    smsConsentStatus: contact.smsConsentStatus || (contact.smsConsent === 'opted_in' ? 'opted_in' : contact.smsConsent === 'opted_out' ? 'opted_out' : null),
    smsConsent: contact.smsConsent || null,
    smsConsentAt: contact.smsConsentAt ? contact.smsConsentAt.toISOString() : null,
    tags: Array.isArray(contact.tags) ? contact.tags : [],
    createdAt: contact.createdAt ? contact.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: contact.updatedAt ? contact.updatedAt.toISOString() : new Date().toISOString(),
  };
}

/**
 * Sanitize category name for Select component
 * @param {string} category - Category name
 * @returns {string|null} Sanitized category or null if invalid
 */
export function sanitizeCategoryForSelect(category) {
  if (!category || typeof category !== 'string') return null;
  const trimmed = category.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default {
  mapCampaignToDTO,
  mapTemplateToDTO,
  mapAutomationToDTO,
  mapSegmentToDTO,
  mapDiscountToDTO,
  mapContactToDTO,
  sanitizeCategoryForSelect,
};

