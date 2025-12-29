import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * System Segments Service
 * Handles DB-backed system segments (gender + age buckets)
 */

/**
 * System segment definitions
 */
const SYSTEM_SEGMENTS = [
  // Gender segments
  {
    key: 'gender_male',
    name: 'Male',
    type: 'system',
    criteriaJson: { gender: 'male' },
  },
  {
    key: 'gender_female',
    name: 'Female',
    type: 'system',
    criteriaJson: { gender: 'female' },
  },
  {
    key: 'gender_unknown',
    name: 'Unknown Gender',
    type: 'system',
    criteriaJson: { gender: null },
  },
  // Age bucket segments
  {
    key: 'age_18_24',
    name: 'Age 18-24',
    type: 'system',
    criteriaJson: { age: { gte: 18, lte: 24 } },
  },
  {
    key: 'age_25_34',
    name: 'Age 25-34',
    type: 'system',
    criteriaJson: { age: { gte: 25, lte: 34 } },
  },
  {
    key: 'age_35_44',
    name: 'Age 35-44',
    type: 'system',
    criteriaJson: { age: { gte: 35, lte: 44 } },
  },
  {
    key: 'age_45_54',
    name: 'Age 45-54',
    type: 'system',
    criteriaJson: { age: { gte: 45, lte: 54 } },
  },
  {
    key: 'age_55_plus',
    name: 'Age 55+',
    type: 'system',
    criteriaJson: { age: { gte: 55 } },
  },
];

/**
 * Ensure system segments exist for a shop (idempotent)
 * @param {string} shopId - Shop ID
 * @returns {Promise<Array>} Created/existing system segments
 */
export async function ensureSystemSegments(shopId) {
  logger.info('Ensuring system segments exist', { shopId });

  const segmentsToCreate = SYSTEM_SEGMENTS.map(seg => ({
    shopId,
    name: seg.name,
    key: seg.key,
    type: seg.type,
    criteriaJson: seg.criteriaJson,
    ruleJson: seg.criteriaJson, // Backward compatibility
    isActive: true,
  }));

  // Use createMany with skipDuplicates for idempotency
  await prisma.segment.createMany({
    data: segmentsToCreate,
    skipDuplicates: true, // Based on @@unique([shopId, key])
  });

  // Return all system segments for this shop
  const segments = await prisma.segment.findMany({
    where: {
      shopId,
      type: 'system',
    },
    orderBy: { name: 'asc' },
  });

  logger.info('System segments ensured', {
    shopId,
    count: segments.length,
  });

  return segments;
}

/**
 * Get system segments for a shop
 * @param {string} shopId - Shop ID
 * @returns {Promise<Array>} System segments
 */
export async function getSystemSegments(shopId) {
  // Ensure segments exist first (idempotent)
  await ensureSystemSegments(shopId);

  const segments = await prisma.segment.findMany({
    where: {
      shopId,
      type: 'system',
      isActive: true,
    },
    orderBy: { name: 'asc' },
  });

  return segments;
}

/**
 * Get segment by ID (with shop validation)
 * @param {string} shopId - Shop ID
 * @param {string} segmentId - Segment ID
 * @returns {Promise<Object>} Segment
 */
export async function getSegmentById(shopId, segmentId) {
  const segment = await prisma.segment.findFirst({
    where: {
      id: segmentId,
      shopId, // Ensure tenant isolation
    },
  });

  if (!segment) {
    throw new NotFoundError('Segment not found');
  }

  return segment;
}

/**
 * Resolve contacts for a segment based on criteria
 * @param {string} shopId - Shop ID
 * @param {Object} segment - Segment with criteriaJson
 * @returns {Promise<Array>} Contact IDs matching criteria
 */
export async function resolveSegmentContacts(shopId, segment) {
  const criteria = segment.criteriaJson || segment.ruleJson || {};

  // Build where clause
  const where = {
    shopId,
    smsConsent: 'opted_in', // Only opted-in contacts
  };

  // Handle gender criteria
  if (criteria.gender !== undefined) {
    if (criteria.gender === null) {
      where.gender = null;
    } else {
      where.gender = criteria.gender;
    }
  }

  // Handle age criteria (requires birthDate)
  if (criteria.age) {
    const { gte, lte } = criteria.age;
    const now = new Date();
    const currentYear = now.getFullYear();

    // Calculate birth year range
    if (lte !== undefined) {
      // Age <= lte means birth year >= (currentYear - lte)
      const minBirthYear = currentYear - lte;
      const minDate = new Date(minBirthYear, 0, 1);
      where.birthDate = {
        ...where.birthDate,
        gte: minDate,
      };
    }
    if (gte !== undefined) {
      // Age >= gte means birth year <= (currentYear - gte)
      const maxBirthYear = currentYear - gte;
      const maxDate = new Date(maxBirthYear, 11, 31);
      where.birthDate = {
        ...where.birthDate,
        lte: maxDate,
      };
    }

    // Exclude contacts without birthDate for age segments
    where.birthDate = {
      ...where.birthDate,
      not: null,
    };
  }

  // Use raw SQL for age calculation if needed (more efficient)
  // For now, use Prisma with date calculations
  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      phoneE164: true,
      firstName: true,
      lastName: true,
    },
  });

  // If age criteria, filter by calculated age (more accurate)
  if (criteria.age) {
    // const now = new Date();
    // const filtered = contacts.filter(_contact => {
    // We need birthDate to calculate age, but Prisma already filtered nulls
    // For accurate age calculation, we'd need to fetch birthDate
    // For now, return all contacts that match the date range
    //   return true;
    // });

    // Re-fetch with birthDate to calculate age accurately
    const contactsWithAge = await prisma.contact.findMany({
      where,
      select: {
        id: true,
        phoneE164: true,
        firstName: true,
        lastName: true,
        birthDate: true,
      },
    });

    const { gte, lte } = criteria.age;
    return contactsWithAge
      .filter(contact => {
        if (!contact.birthDate) return false;
        const age = calculateAge(contact.birthDate);
        if (gte !== undefined && age < gte) return false;
        if (lte !== undefined && age > lte) return false;
        return true;
      })
      .map(c => ({
        id: c.id,
        phoneE164: c.phoneE164,
        firstName: c.firstName,
        lastName: c.lastName,
      }));
  }

  return contacts;
}

/**
 * Calculate age from birth date
 * @param {Date} birthDate - Birth date
 * @returns {number} Age in years
 */
function calculateAge(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get estimated count for a segment (without full resolution)
 * @param {string} shopId - Shop ID
 * @param {Object} segment - Segment with criteriaJson
 * @returns {Promise<number>} Estimated contact count
 */
export async function getSegmentEstimatedCount(shopId, segment) {
  const criteria = segment.criteriaJson || segment.ruleJson || {};

  const where = {
    shopId,
    smsConsent: 'opted_in',
  };

  // Handle gender
  if (criteria.gender !== undefined) {
    where.gender = criteria.gender === null ? null : criteria.gender;
  }

  // Handle age (simplified - use date range)
  if (criteria.age) {
    const { gte, lte } = criteria.age;
    const now = new Date();
    const currentYear = now.getFullYear();

    if (lte !== undefined) {
      const minBirthYear = currentYear - lte;
      where.birthDate = {
        ...where.birthDate,
        gte: new Date(minBirthYear, 0, 1),
      };
    }
    if (gte !== undefined) {
      const maxBirthYear = currentYear - gte;
      where.birthDate = {
        ...where.birthDate,
        lte: new Date(maxBirthYear, 11, 31),
      };
    }
    where.birthDate = {
      ...where.birthDate,
      not: null,
    };
  }

  return await prisma.contact.count({ where });
}

export default {
  ensureSystemSegments,
  getSystemSegments,
  getSegmentById,
  resolveSegmentContacts,
  getSegmentEstimatedCount,
};

