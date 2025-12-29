/**
 * Enum Validation Utility
 *
 * Runtime validation that enum values match Prisma schema.
 * Use this to validate API inputs against Prisma enums.
 *
 * @example
 * import { validateEnum } from '../utils/enumValidation.js';
 * import { CampaignStatus } from '../utils/prismaEnums.js';
 *
 * const status = validateEnum(CampaignStatus, req.body.status, 'status');
 */

import {
  CampaignStatus,
  ScheduleType,
  SmsConsent,
  MessageDirection,
  MessageStatus,
  TransactionType,
  SubscriptionPlanType,
  SubscriptionStatus,
  CreditTxnType,
  AutomationTrigger,
  PaymentStatus,
} from './prismaEnums.js';
import { ValidationError } from './errors.js';

/**
 * Validate that a value is a valid enum value
 * @param {Object} enumObject - The enum object (e.g., CampaignStatus)
 * @param {string} value - The value to validate
 * @param {string} fieldName - The field name for error messages
 * @returns {string} The validated enum value
 * @throws {ValidationError} If value is not a valid enum value
 */
export function validateEnum(enumObject, value, fieldName = 'field') {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const validValues = Object.values(enumObject);
  if (!validValues.includes(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}: "${value}". Must be one of: ${validValues.join(', ')}`,
    );
  }

  return value;
}

/**
 * Validate that a value is a valid enum value (optional)
 * @param {Object} enumObject - The enum object (e.g., CampaignStatus)
 * @param {string|null|undefined} value - The value to validate (can be null/undefined)
 * @param {string} fieldName - The field name for error messages
 * @returns {string|null|undefined} The validated enum value or null/undefined
 * @throws {ValidationError} If value is provided but not a valid enum value
 */
export function validateEnumOptional(enumObject, value, fieldName = 'field') {
  if (value === undefined || value === null) {
    return value;
  }

  return validateEnum(enumObject, value, fieldName);
}

/**
 * Validate campaign status
 * @param {string} status - Campaign status value
 * @returns {string} Validated status
 */
export function validateCampaignStatus(status) {
  return validateEnum(CampaignStatus, status, 'campaign status');
}

/**
 * Validate schedule type
 * @param {string} scheduleType - Schedule type value
 * @returns {string} Validated schedule type
 */
export function validateScheduleType(scheduleType) {
  return validateEnum(ScheduleType, scheduleType, 'schedule type');
}

/**
 * Validate SMS consent
 * @param {string} smsConsent - SMS consent value
 * @returns {string} Validated SMS consent
 */
export function validateSmsConsent(smsConsent) {
  return validateEnum(SmsConsent, smsConsent, 'SMS consent');
}

/**
 * Validate message direction
 * @param {string} direction - Message direction value
 * @returns {string} Validated direction
 */
export function validateMessageDirection(direction) {
  return validateEnum(MessageDirection, direction, 'message direction');
}

/**
 * Validate message status
 * @param {string} status - Message status value
 * @returns {string} Validated status
 */
export function validateMessageStatus(status) {
  return validateEnum(MessageStatus, status, 'message status');
}

/**
 * Validate subscription plan type
 * @param {string} planType - Plan type value
 * @returns {string} Validated plan type
 */
export function validateSubscriptionPlanType(planType) {
  return validateEnum(SubscriptionPlanType, planType, 'subscription plan type');
}

/**
 * Validate subscription status
 * @param {string} status - Subscription status value
 * @returns {string} Validated status
 */
export function validateSubscriptionStatus(status) {
  return validateEnum(SubscriptionStatus, status, 'subscription status');
}

/**
 * Validate payment status
 * @param {string} status - Payment status value
 * @returns {string} Validated status
 */
export function validatePaymentStatus(status) {
  return validateEnum(PaymentStatus, status, 'payment status');
}

/**
 * Validate automation trigger
 * @param {string} trigger - Automation trigger value
 * @returns {string} Validated trigger
 */
export function validateAutomationTrigger(trigger) {
  return validateEnum(AutomationTrigger, trigger, 'automation trigger');
}

/**
 * Validate credit transaction type
 * @param {string} type - Credit transaction type value
 * @returns {string} Validated type
 */
export function validateCreditTxnType(type) {
  return validateEnum(CreditTxnType, type, 'credit transaction type');
}

/**
 * Validate transaction type
 * @param {string} type - Transaction type value
 * @returns {string} Validated type
 */
export function validateTransactionType(type) {
  return validateEnum(TransactionType, type, 'transaction type');
}

export default {
  validateEnum,
  validateEnumOptional,
  validateCampaignStatus,
  validateScheduleType,
  validateSmsConsent,
  validateMessageDirection,
  validateMessageStatus,
  validateSubscriptionPlanType,
  validateSubscriptionStatus,
  validatePaymentStatus,
  validateAutomationTrigger,
  validateCreditTxnType,
  validateTransactionType,
};
