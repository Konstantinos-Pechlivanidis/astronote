import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';
import { automationQueue } from '../queue/index.js';
import { hasActiveAutomation } from './automations.js';
import { normalizePhoneToE164, isValidPhone } from '../lib/phone.js';
import crypto from 'crypto';

/**
 * Contacts Service
 * Handles all contact-related business logic including CRUD operations,
 * validation, duplicate detection, and import/export functionality
 */

/**
 * Validate phone number format (E.164) using libphonenumber-js
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhoneE164(phone) {
  if (!phone) return false;
  // Use libphonenumber-js for robust validation (aligned with Retail)
  return isValidPhone(phone, 'GR'); // Default to Greece, can be made configurable
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  if (!email) return true; // Email is optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize phone number to E.164 format using libphonenumber-js
 * @param {string} phone - Phone number to normalize
 * @returns {string|null} Normalized phone number or null if invalid
 */
function normalizePhone(phone) {
  if (!phone) return null;
  // Use libphonenumber-js for robust normalization (aligned with Retail)
  return normalizePhoneToE164(phone);
}

/**
 * Create a random raw token and return its SHA-256 hex hash (for storage)
 * Aligned with Retail implementation
 * @returns {Object} { raw, hash }
 */
function newUnsubTokenHash() {
  const raw = crypto.randomBytes(16).toString('hex'); // 32-char raw token
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

/**
 * Check for duplicate contacts
 * @param {string} storeId - Store ID
 * @param {string} phoneE164 - Phone number
 * @param {string} email - Email address
 * @param {string} excludeId - Contact ID to exclude from check
 * @returns {Promise<Object>} Duplicate check result
 */
async function checkDuplicates(storeId, phoneE164, email, excludeId = null) {
  const where = {
    shopId: storeId,
    OR: [],
  };

  // Only add phone to OR if it's provided and not null
  if (phoneE164) {
    where.OR.push({ phoneE164 });
  }

  // Only add email to OR if it's provided and not null
  if (email) {
    where.OR.push({ email });
  }

  // If no OR conditions, return no duplicates
  if (where.OR.length === 0) {
    return {
      hasDuplicate: false,
      duplicate: null,
    };
  }

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const duplicates = await prisma.contact.findFirst({
    where,
    select: { id: true, phoneE164: true, email: true },
  });

  return {
    hasDuplicate: !!duplicates,
    duplicate: duplicates,
  };
}

/**
 * List contacts with filtering, search, and pagination
 * @param {string} storeId - Store ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Contacts list with pagination
 */
export async function listContacts(storeId, filters = {}) {
  const {
    page = 1,
    pageSize = 20,
    filter = 'all',
    q: searchTerm,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    gender,
    smsConsent,
    hasBirthDate,
  } = filters;

  logger.info('Listing contacts', { storeId, filters });

  // Build where clause
  const where = { shopId: storeId };

  // Gender filter
  if (gender && ['male', 'female', 'other'].includes(gender)) {
    where.gender = gender;
  }

  // SMS consent filter
  if (smsConsent && ['opted_in', 'opted_out', 'unknown'].includes(smsConsent)) {
    where.smsConsent = smsConsent;
    // Also filter by smsConsentStatus for consistency (aligned with Retail)
    where.smsConsentStatus = smsConsent === 'opted_in' ? 'opted_in' : smsConsent === 'opted_out' ? 'opted_out' : null;
  }

  // isSubscribed filter (aligned with Retail)
  const isSubscribedParam = filters.isSubscribed;
  if (isSubscribedParam === 'true' || isSubscribedParam === true) {
    where.isSubscribed = true;
  } else if (isSubscribedParam === 'false' || isSubscribedParam === false) {
    where.isSubscribed = false;
  }

  // listId filter (aligned with Retail) - if lists/segments exist
  const listIdParam = filters.listId;
  if (listIdParam) {
    // Note: This assumes SegmentMembership exists. If not, this will need to be implemented.
    // For now, we'll add the filter structure but it may need segment/list support
    const memberships = await prisma.segmentMembership.findMany({
      where: { segmentId: listIdParam },
      select: { contactId: true },
    });
    const contactIds = memberships.map(m => m.contactId);
    if (contactIds.length === 0) {
      // Return empty result if no memberships (Retail-aligned shape)
      return {
        items: [],
        contacts: [],
        total: 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }
    where.id = { in: contactIds };
  }

  // Birth date filter
  if (hasBirthDate === 'true' || hasBirthDate === true) {
    where.birthDate = { not: null };
  } else if (hasBirthDate === 'false' || hasBirthDate === false) {
    where.birthDate = null;
  }

  // Legacy filter support
  if (filter === 'male') {
    where.gender = 'male';
  } else if (filter === 'female') {
    where.gender = 'female';
  } else if (filter === 'consented') {
    where.smsConsent = 'opted_in';
  } else if (filter === 'nonconsented') {
    where.smsConsent = { in: ['opted_out', 'unknown'] };
  }

  // Search functionality
  if (searchTerm) {
    where.OR = [
      { firstName: { contains: searchTerm, mode: 'insensitive' } },
      { lastName: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } },
      { phoneE164: { contains: searchTerm } },
      { tags: { hasSome: [searchTerm] } },
    ];
  }

  // Validate sort parameters
  const validSortFields = [
    'createdAt',
    'updatedAt',
    'firstName',
    'lastName',
    'birthDate',
  ];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';

  // Execute paginated query
  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { [sortField]: sortDirection },
      take: parseInt(pageSize),
      skip: (parseInt(page) - 1) * parseInt(pageSize),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneE164: true,
        email: true,
        gender: true,
        birthDate: true,
        smsConsent: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.contact.count({ where }),
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / parseInt(pageSize));

  logger.info('Contacts listed successfully', {
    storeId,
    total,
    page: parseInt(page),
    returned: contacts.length,
  });

  // Transform response to match Retail shape (aligned with Retail)
  // Map phoneE164 -> phone, birthDate -> birthday for Retail compatibility
  const transformedContacts = contacts.map(contact => ({
    id: contact.id,
    phone: contact.phoneE164, // Map phoneE164 to phone for Retail compatibility
    phoneE164: contact.phoneE164, // Keep for backward compatibility
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    gender: contact.gender,
    birthday: contact.birthDate, // Map birthDate to birthday for Retail compatibility
    birthDate: contact.birthDate, // Keep for backward compatibility
    isSubscribed: contact.isSubscribed ?? true, // Default to true if null
    smsConsentStatus: contact.smsConsentStatus || (contact.smsConsent === 'opted_in' ? 'opted_in' : contact.smsConsent === 'opted_out' ? 'opted_out' : null),
    smsConsent: contact.smsConsent, // Keep enum for backward compatibility
    smsConsentAt: contact.smsConsentAt,
    tags: contact.tags,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  }));

  // Return Retail-aligned shape: { items, total, page, pageSize }
  return {
    items: transformedContacts, // Retail uses "items" not "contacts"
    contacts: transformedContacts, // Keep for backward compatibility
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
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
 * Get contact by ID
 * @param {string} storeId - Store ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<Object>} Contact data
 */
export async function getContactById(storeId, contactId) {
  logger.info('Getting contact by ID', { storeId, contactId });

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      shopId: storeId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneE164: true,
      email: true,
      gender: true,
      birthDate: true,
      smsConsent: true,
      smsConsentStatus: true, // Include for Retail alignment
      smsConsentAt: true,
      isSubscribed: true, // Include for Retail alignment
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!contact) {
    throw new NotFoundError('Contact');
  }

  logger.info('Contact retrieved successfully', { storeId, contactId });

  return contact;
}

/**
 * Create new contact
 * @param {string} storeId - Store ID
 * @param {Object} contactData - Contact data
 * @returns {Promise<Object>} Created contact
 */
export async function createContact(storeId, contactData) {
  logger.info('Creating contact', { storeId, phone: contactData.phoneE164 });

  // Validate required fields
  if (!contactData.phoneE164) {
    throw new ValidationError('Phone number is required');
  }

  // Normalize phone number using libphonenumber-js (aligned with Retail)
  // Support both "phone" (Retail) and "phoneE164" (Shopify) field names
  const phoneInput = contactData.phone || contactData.phoneE164;
  if (!phoneInput) {
    throw new ValidationError('Phone number is required');
  }

  const phoneE164 = normalizePhone(phoneInput);

  // Validate phone format (normalizePhone returns null if invalid)
  if (!phoneE164 || !isValidPhoneE164(phoneE164)) {
    throw new ValidationError(
      'Invalid phone number format. Please enter a valid international phone number (e.g., +306912345678).',
    );
  }

  // Validate email if provided
  if (
    contactData.email &&
    contactData.email.trim() &&
    !isValidEmail(contactData.email.trim())
  ) {
    throw new ValidationError('Invalid email format');
  }

  // Validate gender if provided
  if (
    contactData.gender &&
    !['male', 'female', 'other'].includes(contactData.gender)
  ) {
    throw new ValidationError('Gender must be one of: male, female, other');
  }

  // Validate SMS consent
  if (
    contactData.smsConsent &&
    !['opted_in', 'opted_out', 'unknown'].includes(contactData.smsConsent)
  ) {
    throw new ValidationError(
      'SMS consent must be one of: opted_in, opted_out, unknown',
    );
  }

  // Check for duplicates
  const { hasDuplicate, duplicate } = await checkDuplicates(
    storeId,
    phoneE164,
    contactData.email,
  );

  if (hasDuplicate) {
    throw new ConflictError(
      `Contact already exists with ${duplicate.phoneE164 === phoneE164 ? 'phone' : 'email'}: ${duplicate.phoneE164 === phoneE164 ? phoneE164 : contactData.email}`,
    );
  }

  // Prepare unsubscribe token hash (aligned with Retail)
  const { hash: unsubscribeTokenHash } = newUnsubTokenHash();

  // Determine isSubscribed and smsConsentStatus (aligned with Retail)
  let isSubscribed = true; // Default to subscribed
  let smsConsentStatus = null;
  const smsConsentValue = contactData.smsConsent || 'unknown';

  // Map consent to isSubscribed and smsConsentStatus
  if (smsConsentValue === 'opted_in') {
    isSubscribed = true;
    smsConsentStatus = 'opted_in';
  } else if (smsConsentValue === 'opted_out') {
    isSubscribed = false;
    smsConsentStatus = 'opted_out';
  } else {
    // unknown - default to subscribed but no explicit consent
    isSubscribed = true;
    smsConsentStatus = null;
  }

  // Support both "birthday" (Retail) and "birthDate" (Shopify) field names
  const birthdayInput = contactData.birthday || contactData.birthDate;

  // Prepare contact data for Prisma
  const prismaData = {
    shopId: storeId,
    phoneE164,
    firstName:
      contactData.firstName && contactData.firstName.trim()
        ? contactData.firstName.trim()
        : null,
    lastName:
      contactData.lastName && contactData.lastName.trim()
        ? contactData.lastName.trim()
        : null,
    email:
      contactData.email && contactData.email.trim()
        ? contactData.email.trim()
        : null,
    gender: contactData.gender || null,
    smsConsent: smsConsentValue, // Keep enum for backward compatibility
    smsConsentStatus, // Add string field (aligned with Retail)
    smsConsentAt: smsConsentStatus ? new Date() : null,
    smsConsentSource: 'manual', // Default source
    isSubscribed, // Add boolean field (aligned with Retail)
    unsubscribeTokenHash, // Add token hash (aligned with Retail)
    tags: contactData.tags || [],
  };

  // Handle birthDate/birthday conversion (support both field names)
  if (birthdayInput) {
    if (
      typeof birthdayInput === 'string' &&
      birthdayInput.trim()
    ) {
      const birthDate = new Date(birthdayInput);
      if (!isNaN(birthDate.getTime())) {
        // Validate birth date is not in the future
        if (birthDate > new Date()) {
          throw new ValidationError('Birth date cannot be in the future');
        }
        prismaData.birthDate = birthDate;
      } else {
        throw new ValidationError('Invalid birth date format');
      }
    } else if (birthdayInput instanceof Date) {
      if (birthdayInput > new Date()) {
        throw new ValidationError('Birth date cannot be in the future');
      }
      prismaData.birthDate = birthdayInput;
    }
  } else {
    prismaData.birthDate = null;
  }

  // Log data before creation for debugging
  logger.info('Creating contact with data', {
    storeId,
    phoneE164,
    firstName: prismaData.firstName,
    lastName: prismaData.lastName,
    gender: prismaData.gender,
    birthDate: prismaData.birthDate,
    smsConsent: prismaData.smsConsent,
  });

  // Create contact
  const contact = await prisma.contact.create({
    data: prismaData,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneE164: true,
      email: true,
      gender: true,
      birthDate: true,
      smsConsent: true,
      smsConsentStatus: true,
      smsConsentAt: true,
      isSubscribed: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info('Contact created successfully', {
    storeId,
    contactId: contact.id,
  });

  // Return contact as-is (Retail alignment transformation not needed here)

  // Trigger welcome automation if contact has opted in and welcome automation is active
  if (contact.smsConsent === 'opted_in') {
    try {
      const hasWelcomeAutomation = await hasActiveAutomation(
        storeId,
        'welcome',
      );

      if (hasWelcomeAutomation) {
        logger.info('Queueing welcome automation for new contact', {
          storeId,
          contactId: contact.id,
          phoneE164: contact.phoneE164,
        });

        // Queue welcome automation job
        await automationQueue.add(
          'welcome',
          {
            shopId: storeId,
            contactId: contact.id,
            welcomeData: {
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email,
              phoneE164: contact.phoneE164,
            },
          },
          {
            jobId: `welcome-${storeId}-${contact.id}-${Date.now()}`,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        );

        logger.info('Welcome automation queued successfully', {
          storeId,
          contactId: contact.id,
        });
      } else {
        logger.debug('No active welcome automation found for shop', {
          storeId,
          contactId: contact.id,
        });
      }
    } catch (automationError) {
      // Log error but don't fail contact creation
      logger.error('Failed to trigger welcome automation', {
        storeId,
        contactId: contact.id,
        error: automationError.message,
        stack: automationError.stack,
      });
    }
  } else {
    logger.debug(
      'Contact does not have SMS consent, skipping welcome automation',
      {
        storeId,
        contactId: contact.id,
        smsConsent: contact.smsConsent,
      },
    );
  }

  return contact;
}

/**
 * Update contact
 * @param {string} storeId - Store ID
 * @param {string} contactId - Contact ID
 * @param {Object} contactData - Updated contact data
 * @returns {Promise<Object>} Updated contact
 */
export async function updateContact(storeId, contactId, contactData) {
  logger.info('Updating contact', { storeId, contactId });

  // Check if contact exists
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, shopId: storeId },
  });

  if (!existing) {
    throw new NotFoundError('Contact');
  }

  // Prepare update data
  const updateData = {};

  // Validate and normalize phone if provided (support both field names)
  const phoneInput = contactData.phone !== undefined ? contactData.phone : contactData.phoneE164;
  if (phoneInput) {
    const phoneE164 = normalizePhone(phoneInput);
    if (!phoneE164 || !isValidPhoneE164(phoneE164)) {
      throw new ValidationError(
        'Invalid phone number format. Please enter a valid international phone number (e.g., +306912345678).',
      );
    }

    // Check for duplicates
    const { hasDuplicate } = await checkDuplicates(
      storeId,
      phoneE164,
      null,
      contactId,
    );
    if (hasDuplicate) {
      throw new ConflictError(
        `Contact already exists with phone: ${phoneE164}`,
      );
    }

    updateData.phoneE164 = phoneE164;
  }

  // Validate and update email if provided
  if (contactData.email !== undefined) {
    const emailValue =
      contactData.email && contactData.email.trim()
        ? contactData.email.trim()
        : null;
    if (emailValue && !isValidEmail(emailValue)) {
      throw new ValidationError('Invalid email format');
    }

    if (emailValue) {
      const { hasDuplicate } = await checkDuplicates(
        storeId,
        null,
        emailValue,
        contactId,
      );
      if (hasDuplicate) {
        throw new ConflictError(
          `Contact already exists with email: ${emailValue}`,
        );
      }
    }

    updateData.email = emailValue;
  }

  // Validate gender if provided
  if (contactData.gender !== undefined) {
    if (
      contactData.gender &&
      !['male', 'female', 'other'].includes(contactData.gender)
    ) {
      throw new ValidationError('Gender must be one of: male, female, other');
    }
    updateData.gender = contactData.gender;
  }

  // Validate SMS consent if provided (aligned with Retail)
  if (contactData.smsConsent !== undefined) {
    if (
      !['opted_in', 'opted_out', 'unknown'].includes(contactData.smsConsent)
    ) {
      throw new ValidationError(
        'SMS consent must be one of: opted_in, opted_out, unknown',
      );
    }
    updateData.smsConsent = contactData.smsConsent;

    // Update isSubscribed and smsConsentStatus based on consent (aligned with Retail)
    if (contactData.smsConsent === 'opted_in') {
      updateData.isSubscribed = true;
      updateData.smsConsentStatus = 'opted_in';
      updateData.smsConsentAt = new Date();
      updateData.unsubscribedAt = null;
    } else if (contactData.smsConsent === 'opted_out') {
      updateData.isSubscribed = false;
      updateData.smsConsentStatus = 'opted_out';
      updateData.unsubscribedAt = new Date();
    } else {
      // unknown - keep current state but clear explicit consent
      updateData.smsConsentStatus = null;
    }
  }

  // Support isSubscribed field directly (aligned with Retail)
  if (contactData.isSubscribed !== undefined) {
    updateData.isSubscribed = Boolean(contactData.isSubscribed);
    if (updateData.isSubscribed === false) {
      updateData.unsubscribedAt = new Date();
      // If unsubscribing, also update consent
      if (!updateData.smsConsent) {
        updateData.smsConsent = 'opted_out';
        updateData.smsConsentStatus = 'opted_out';
      }
    } else {
      updateData.unsubscribedAt = null;
    }
  }

  // Update other fields
  if (contactData.firstName !== undefined) {
    updateData.firstName =
      contactData.firstName && contactData.firstName.trim()
        ? contactData.firstName.trim()
        : null;
  }
  if (contactData.lastName !== undefined) {
    updateData.lastName =
      contactData.lastName && contactData.lastName.trim()
        ? contactData.lastName.trim()
        : null;
  }
  // Support both "birthday" (Retail) and "birthDate" (Shopify) field names
  const birthdayInput = contactData.birthday !== undefined ? contactData.birthday : contactData.birthDate;
  if (birthdayInput !== undefined) {
    if (
      birthdayInput &&
      typeof birthdayInput === 'string' &&
      birthdayInput.trim()
    ) {
      const birthDate = new Date(birthdayInput);
      if (isNaN(birthDate.getTime())) {
        throw new ValidationError('Invalid birth date format');
      }
      // Ensure birth date is not in the future
      if (birthDate > new Date()) {
        throw new ValidationError('Birth date cannot be in the future');
      }
      updateData.birthDate = birthDate;
    } else if (birthdayInput === null) {
      updateData.birthDate = null;
    } else if (!birthdayInput) {
      // Empty string or falsy value
      updateData.birthDate = null;
    } else {
      // Try to parse as Date object if it's already a Date
      const birthDate =
        birthdayInput instanceof Date
          ? birthdayInput
          : new Date(birthdayInput);
      if (isNaN(birthDate.getTime())) {
        throw new ValidationError('Invalid birth date format');
      }
      if (birthDate > new Date()) {
        throw new ValidationError('Birth date cannot be in the future');
      }
      updateData.birthDate = birthDate;
    }
  }
  if (contactData.tags !== undefined) updateData.tags = contactData.tags || [];

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    logger.warn('No fields to update', { storeId, contactId });
    // Return existing contact if no updates (transform to Retail-aligned shape)
    const transformed = {
      id: existing.id,
      phone: existing.phoneE164,
      phoneE164: existing.phoneE164,
      email: existing.email,
      firstName: existing.firstName,
      lastName: existing.lastName,
      gender: existing.gender,
      birthday: existing.birthDate,
      birthDate: existing.birthDate,
      isSubscribed: existing.isSubscribed ?? true,
      smsConsentStatus: existing.smsConsentStatus || (existing.smsConsent === 'opted_in' ? 'opted_in' : existing.smsConsent === 'opted_out' ? 'opted_out' : null),
      smsConsent: existing.smsConsent,
      smsConsentAt: existing.smsConsentAt,
      tags: existing.tags,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
    return transformed;
  }

  // Update contact
  try {
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneE164: true,
        email: true,
        gender: true,
        birthDate: true,
        smsConsent: true,
        smsConsentStatus: true,
        smsConsentAt: true,
        isSubscribed: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Contact updated successfully', { storeId, contactId });

    // Transform to Retail-aligned shape for return
    const transformed = {
      id: contact.id,
      phone: contact.phoneE164,
      phoneE164: contact.phoneE164,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      gender: contact.gender,
      birthday: contact.birthDate,
      birthDate: contact.birthDate,
      isSubscribed: contact.isSubscribed ?? true,
      smsConsentStatus: contact.smsConsentStatus || (contact.smsConsent === 'opted_in' ? 'opted_in' : contact.smsConsent === 'opted_out' ? 'opted_out' : null),
      smsConsent: contact.smsConsent,
      smsConsentAt: contact.smsConsentAt,
      tags: contact.tags,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };

    return transformed;
  } catch (error) {
    // Handle Prisma-specific errors
    if (error.code === 'P2002') {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      logger.error('Duplicate contact detected during update', {
        storeId,
        contactId,
        field,
        updateData,
        error: error.message,
      });
      throw new ConflictError(`Contact already exists with this ${field}`);
    } else if (error.code === 'P2025') {
      // Record not found
      logger.error('Contact not found during update', {
        storeId,
        contactId,
        updateData,
        error: error.message,
      });
      throw new NotFoundError('Contact');
    }

    logger.error('Failed to update contact in database', {
      storeId,
      contactId,
      updateData,
      error: error.message,
      errorCode: error.code,
      errorMeta: error.meta,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Delete contact
 * @param {string} storeId - Store ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<void>}
 */
export async function deleteContact(storeId, contactId) {
  logger.info('Deleting contact', { storeId, contactId });

  // Check if contact exists
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, shopId: storeId },
  });

  if (!existing) {
    throw new NotFoundError('Contact');
  }

  // Delete contact
  await prisma.contact.delete({
    where: { id: contactId },
  });

  logger.info('Contact deleted successfully', { storeId, contactId });
}

/**
 * Get contact statistics
 * @param {string} storeId - Store ID
 * @returns {Promise<Object>} Contact statistics
 */
export async function getContactStats(storeId) {
  logger.info('Getting contact stats', { storeId });

  const [total, genderStats, consentStats, withBirthday] = await Promise.all([
    prisma.contact.count({ where: { shopId: storeId } }),
    prisma.contact.groupBy({
      by: ['gender'],
      where: { shopId: storeId },
      _count: { gender: true },
    }),
    prisma.contact.groupBy({
      by: ['smsConsent'],
      where: { shopId: storeId },
      _count: { smsConsent: true },
    }),
    prisma.contact.count({
      where: { shopId: storeId, birthDate: { not: null } },
    }),
  ]);

  const stats = {
    total,
    byGender: {
      male: genderStats.find(s => s.gender === 'male')?._count?.gender || 0,
      female: genderStats.find(s => s.gender === 'female')?._count?.gender || 0,
      other: genderStats.find(s => s.gender === 'other')?._count?.gender || 0,
      unknown: total - genderStats.reduce((sum, s) => sum + s._count.gender, 0),
    },
    byConsent: {
      opted_in:
        consentStats.find(s => s.smsConsent === 'opted_in')?._count
          ?.smsConsent || 0,
      opted_out:
        consentStats.find(s => s.smsConsent === 'opted_out')?._count
          ?.smsConsent || 0,
      unknown:
        consentStats.find(s => s.smsConsent === 'unknown')?._count
          ?.smsConsent || 0,
    },
    withBirthday,
  };

  logger.info('Contact stats retrieved', { storeId, stats });

  return stats;
}

/**
 * Get birthday contacts (upcoming birthdays)
 * @param {string} storeId - Store ID
 * @param {number} daysAhead - Number of days to look ahead (default: 7)
 * @returns {Promise<Array>} Contacts with upcoming birthdays
 */
export async function getBirthdayContacts(storeId, daysAhead = 7) {
  logger.info('Getting birthday contacts', { storeId, daysAhead });

  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  // Get all contacts with birthdays
  const contacts = await prisma.contact.findMany({
    where: {
      shopId: storeId,
      birthDate: { not: null },
      smsConsent: 'opted_in',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneE164: true,
      email: true,
      birthDate: true,
    },
  });

  // Filter contacts with birthdays in the next N days
  const upcomingBirthdays = contacts.filter(contact => {
    const birthDate = new Date(contact.birthDate);
    const thisYearBirthday = new Date(
      today.getFullYear(),
      birthDate.getMonth(),
      birthDate.getDate(),
    );

    // If birthday already passed this year, check next year
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1);
    }

    return thisYearBirthday >= today && thisYearBirthday <= futureDate;
  });

  logger.info('Birthday contacts retrieved', {
    storeId,
    total: upcomingBirthdays.length,
  });

  return upcomingBirthdays;
}

/**
 * Import contacts in bulk
 * @param {string} storeId - Store ID
 * @param {Array} contactsData - Array of contact data
 * @returns {Promise<Object>} Import results
 */
export async function importContacts(storeId, contactsData) {
  logger.info('Importing contacts', { storeId, count: contactsData.length });

  const results = {
    total: contactsData.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const contactData of contactsData) {
    try {
      // Support both "phone" (Retail) and "phoneE164" (Shopify) field names
      const phoneInput = contactData.phone || contactData.phoneE164;
      if (!phoneInput) {
        results.skipped++;
        results.errors.push({
          phone: phoneInput || 'N/A',
          error: 'Phone number is required',
        });
        continue;
      }

      // Normalize phone using libphonenumber-js (aligned with Retail)
      const phoneE164 = normalizePhone(phoneInput);

      if (!phoneE164 || !isValidPhoneE164(phoneE164)) {
        results.skipped++;
        results.errors.push({
          phone: phoneInput,
          error: 'Invalid phone format',
        });
        continue;
      }

      // Check if contact exists
      const existing = await prisma.contact.findFirst({
        where: { shopId: storeId, phoneE164 },
      });

      // Support both "birthday" (Retail) and "birthDate" (Shopify) field names
      const birthdayInput = contactData.birthday || contactData.birthDate;
      const birthDateValue = birthdayInput ? new Date(birthdayInput) : null;

      // Determine consent and subscription state (aligned with Retail)
      const smsConsentValue = contactData.smsConsent || 'unknown';
      let isSubscribed = true;
      let smsConsentStatus = null;
      if (smsConsentValue === 'opted_in') {
        isSubscribed = true;
        smsConsentStatus = 'opted_in';
      } else if (smsConsentValue === 'opted_out') {
        isSubscribed = false;
        smsConsentStatus = 'opted_out';
      }

      // Generate unsubscribe token hash for new contacts (aligned with Retail)
      const { hash: unsubscribeTokenHash } = newUnsubTokenHash();

      if (existing) {
        // Update existing contact
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            firstName: contactData.firstName || existing.firstName,
            lastName: contactData.lastName || existing.lastName,
            email: contactData.email || existing.email,
            gender: contactData.gender || existing.gender,
            birthDate: birthDateValue || existing.birthDate,
            smsConsent: smsConsentValue,
            smsConsentStatus: smsConsentStatus || existing.smsConsentStatus,
            smsConsentAt: smsConsentStatus ? new Date() : existing.smsConsentAt,
            isSubscribed,
            tags: contactData.tags || existing.tags,
          },
        });
        results.updated++;
      } else {
        // Create new contact
        await prisma.contact.create({
          data: {
            shopId: storeId,
            phoneE164,
            firstName: contactData.firstName || null,
            lastName: contactData.lastName || null,
            email: contactData.email || null,
            gender: contactData.gender || null,
            birthDate: birthDateValue,
            smsConsent: smsConsentValue,
            smsConsentStatus,
            smsConsentAt: smsConsentStatus ? new Date() : null,
            smsConsentSource: 'import',
            isSubscribed,
            unsubscribeTokenHash,
            tags: contactData.tags || [],
          },
        });
        results.created++;
      }
    } catch (error) {
      results.skipped++;
      results.errors.push({
        phone: contactData.phoneE164,
        error: error.message,
      });
    }
  }

  logger.info('Contacts imported', { storeId, results });

  return results;
}

export { normalizePhone, isValidPhoneE164, isValidEmail };

export default {
  listContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  getContactStats,
  getBirthdayContacts,
  importContacts,
  normalizePhone,
  isValidPhoneE164,
  isValidEmail,
};
