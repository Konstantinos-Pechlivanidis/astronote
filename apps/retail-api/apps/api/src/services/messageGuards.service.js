const prisma = require('../lib/prisma');
const { normalizePhoneToE164 } = require('../lib/phone');
const pino = require('pino');

const logger = pino({ name: 'message-guards' });

const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const OWNER_SMS_PER_MINUTE = parseLimit(process.env.OWNER_SMS_PER_MINUTE);
const OWNER_SMS_PER_DAY = parseLimit(process.env.OWNER_SMS_PER_DAY);
const CONTACT_MARKETING_PER_DAY = parseLimit(process.env.CONTACT_MARKETING_PER_DAY);
const CONTACT_MARKETING_PER_WEEK = parseLimit(process.env.CONTACT_MARKETING_PER_WEEK);
const SERVICE_MAX_PER_EVENT = parseLimit(process.env.SERVICE_MAX_PER_EVENT);

const QUIET_HOURS_ENABLED = process.env.QUIET_HOURS_ENABLED === '1';
const QUIET_HOURS_ALLOW_MARKETING = process.env.QUIET_HOURS_ALLOW_MARKETING === '1';
const QUIET_HOURS_ALLOW_SERVICE = process.env.QUIET_HOURS_ALLOW_SERVICE === '1';

const parseTimeToMinutes = (value, fallback) => {
  if (!value) {
    return fallback;
  }
  const raw = String(value).trim();
  const [hh, mm] = raw.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hh)) {
    return fallback;
  }
  const minutes = (hh % 24) * 60 + (Number.isNaN(mm) ? 0 : Math.min(Math.max(mm, 0), 59));
  return minutes;
};

const QUIET_START_MIN = parseTimeToMinutes(process.env.QUIET_HOURS_START, 22 * 60);
const QUIET_END_MIN = parseTimeToMinutes(process.env.QUIET_HOURS_END, 9 * 60);

const isWithinQuietHours = (minutesOfDay) => {
  if (QUIET_START_MIN === QUIET_END_MIN) {
    return false;
  }
  if (QUIET_START_MIN < QUIET_END_MIN) {
    return minutesOfDay >= QUIET_START_MIN && minutesOfDay < QUIET_END_MIN;
  }
  return minutesOfDay >= QUIET_START_MIN || minutesOfDay < QUIET_END_MIN;
};

async function getOwnerTimezone(ownerId) {
  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { timezone: true },
    });
    return owner?.timezone || 'UTC';
  } catch (err) {
    logger.warn({ ownerId, err: err.message }, 'Failed to resolve owner timezone');
    return 'UTC';
  }
}

function getMinutesInTimezone(date, timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone,
    });
    const parts = formatter.formatToParts(date);
    const hour = Number.parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = Number.parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return hour * 60 + minute;
  } catch (err) {
    logger.warn({ timezone, err: err.message }, 'Failed to compute local minutes, defaulting to UTC');
    const utcHour = date.getUTCHours();
    const utcMinute = date.getUTCMinutes();
    return utcHour * 60 + utcMinute;
  }
}

async function countOwnerSendsSince(ownerId, since) {
  try {
    const [campaignCount, automationCount, automationSendCount, directCount] = await Promise.all([
      prisma.campaignMessage.count({
        where: { ownerId, status: 'sent', sentAt: { gte: since } },
      }),
      prisma.automationMessage.count({
        where: { ownerId, status: 'sent', sentAt: { gte: since } },
      }),
      prisma.automationSend.count({
        where: { ownerId, status: 'sent', sentAt: { gte: since } },
      }),
      prisma.directMessage.count({
        where: { ownerId, status: 'sent', sentAt: { gte: since } },
      }),
    ]);

    return campaignCount + automationCount + automationSendCount + directCount;
  } catch (err) {
    logger.warn({ ownerId, err: err.message }, 'Failed to count owner sends, defaulting to 0');
    return 0;
  }
}

async function countContactMarketingSends(ownerId, contactId, since) {
  if (!contactId) {
    return 0;
  }
  try {
    const [campaignCount, automationCount, automationSendCount, directCount] = await Promise.all([
      prisma.campaignMessage.count({
        where: {
          ownerId,
          contactId,
          status: 'sent',
          sentAt: { gte: since },
          campaign: { messageType: 'marketing' },
        },
      }),
      prisma.automationMessage.count({
        where: {
          ownerId,
          contactId,
          status: 'sent',
          sentAt: { gte: since },
          automation: { messageType: 'marketing' },
        },
      }),
      prisma.automationSend.count({
        where: {
          ownerId,
          contactId,
          status: 'sent',
          sentAt: { gte: since },
          messageType: 'marketing',
        },
      }),
      prisma.directMessage.count({
        where: {
          ownerId,
          contactId,
          status: 'sent',
          sentAt: { gte: since },
          messageType: 'marketing',
        },
      }),
    ]);

    return campaignCount + automationCount + automationSendCount + directCount;
  } catch (err) {
    logger.warn({ ownerId, contactId, err: err.message }, 'Failed to count contact marketing sends, defaulting to 0');
    return 0;
  }
}

async function countServiceSendsForEvent(ownerId, eventId) {
  if (!eventId) {
    return 0;
  }
  try {
    return await prisma.automationSend.count({
      where: {
        ownerId,
        eventId,
        status: 'sent',
        messageType: 'service',
      },
    });
  } catch (err) {
    logger.warn({ ownerId, eventId, err: err.message }, 'Failed to count service sends for event, defaulting to 0');
    return 0;
  }
}

async function resolveContactId(ownerId, contactId, phoneE164) {
  if (contactId) {
    return contactId;
  }
  const normalized = phoneE164 ? normalizePhoneToE164(phoneE164) : null;
  if (!normalized) {
    return null;
  }
  try {
    const contact = await prisma.contact.findFirst({
      where: { ownerId, phone: normalized },
      select: { id: true },
    });
    return contact?.id || null;
  } catch (err) {
    logger.warn({ ownerId, err: err.message }, 'Failed to resolve contact ID by phone');
    return null;
  }
}

async function getOwnerLimitSnapshot(ownerId) {
  const now = new Date();
  const snapshot = { minute: null, day: null };
  if (OWNER_SMS_PER_MINUTE) {
    snapshot.minute = await countOwnerSendsSince(ownerId, new Date(now.getTime() - 60 * 1000));
  }
  if (OWNER_SMS_PER_DAY) {
    snapshot.day = await countOwnerSendsSince(ownerId, new Date(now.getTime() - 24 * 60 * 60 * 1000));
  }
  return snapshot;
}

async function checkMessageGuards(
  { ownerId, contactId = null, phoneE164 = null, messageType = 'marketing', eventId = null },
  options = {},
) {
  if (!ownerId) {
    return { allowed: false, reason: 'missing_owner', message: 'Owner context is required.' };
  }

  const normalizedType = messageType === 'service' ? 'service' : 'marketing';
  const resolvedContactId = await resolveContactId(ownerId, contactId, phoneE164);

  if (QUIET_HOURS_ENABLED) {
    const allowDuringQuiet = normalizedType === 'marketing'
      ? QUIET_HOURS_ALLOW_MARKETING
      : QUIET_HOURS_ALLOW_SERVICE;
    if (!allowDuringQuiet) {
      const timezone = await getOwnerTimezone(ownerId);
      const minutesOfDay = getMinutesInTimezone(new Date(), timezone);
      if (isWithinQuietHours(minutesOfDay)) {
        return {
          allowed: false,
          reason: 'quiet_hours',
          message: 'Sending is paused during quiet hours.',
        };
      }
    }
  }

  const now = new Date();
  if (!options.skipOwnerLimits) {
    if (OWNER_SMS_PER_MINUTE) {
      const since = new Date(now.getTime() - 60 * 1000);
      const count = await countOwnerSendsSince(ownerId, since);
      if (count >= OWNER_SMS_PER_MINUTE) {
        return {
          allowed: false,
          reason: 'owner_rate_limit',
          message: 'Owner send limit exceeded (per minute).',
        };
      }
    }

    if (OWNER_SMS_PER_DAY) {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const count = await countOwnerSendsSince(ownerId, since);
      if (count >= OWNER_SMS_PER_DAY) {
        return {
          allowed: false,
          reason: 'owner_daily_limit',
          message: 'Owner send limit exceeded (per day).',
        };
      }
    }
  }

  if (normalizedType === 'marketing' && resolvedContactId) {
    if (CONTACT_MARKETING_PER_DAY) {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const count = await countContactMarketingSends(ownerId, resolvedContactId, since);
      if (count >= CONTACT_MARKETING_PER_DAY) {
        return {
          allowed: false,
          reason: 'contact_marketing_daily_limit',
          message: 'Marketing send limit exceeded for this contact (daily).',
        };
      }
    }
    if (CONTACT_MARKETING_PER_WEEK) {
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const count = await countContactMarketingSends(ownerId, resolvedContactId, since);
      if (count >= CONTACT_MARKETING_PER_WEEK) {
        return {
          allowed: false,
          reason: 'contact_marketing_weekly_limit',
          message: 'Marketing send limit exceeded for this contact (weekly).',
        };
      }
    }
  }

  if (normalizedType === 'service' && SERVICE_MAX_PER_EVENT && eventId) {
    const count = await countServiceSendsForEvent(ownerId, eventId);
    if (count >= SERVICE_MAX_PER_EVENT) {
      return {
        allowed: false,
        reason: 'service_event_limit',
        message: 'Service reminder limit exceeded for this event.',
      };
    }
  }

  return { allowed: true };
}

module.exports = {
  checkMessageGuards,
  getOwnerLimitSnapshot,
};
