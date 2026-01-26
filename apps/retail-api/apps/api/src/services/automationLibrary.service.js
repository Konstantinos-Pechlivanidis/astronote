const prisma = require('../lib/prisma');
const pino = require('pino');
const { render } = require('../lib/template');
const { sendSMSWithCredits } = require('./sms.service');

const logger = pino({ name: 'automation-library' });

const BUSINESS_PROFILES = ['retail', 'gym', 'appointments', 'hotel', 'other'];

const PRESETS = [
  {
    key: 'appointments_reminder_24h',
    profiles: ['appointments'],
    name: 'Appointment reminder (24h)',
    description: 'Send a reminder 24 hours before an appointment.',
    messageType: 'service',
    trigger: {
      type: 'event',
      eventType: 'appointment',
      status: 'scheduled',
      timeField: 'startAt',
      offsetMinutes: -1440,
    },
    template: 'Reminder: your appointment is tomorrow. Reply if you need to reschedule.',
    dedupeWindowMinutes: 1440,
    maxPerContactPerDay: 1,
  },
  {
    key: 'appointments_reminder_2h',
    profiles: ['appointments'],
    name: 'Appointment reminder (2h)',
    description: 'Send a reminder 2 hours before an appointment.',
    messageType: 'service',
    trigger: {
      type: 'event',
      eventType: 'appointment',
      status: 'scheduled',
      timeField: 'startAt',
      offsetMinutes: -120,
    },
    template: 'Reminder: your appointment starts in 2 hours.',
    dedupeWindowMinutes: 360,
    maxPerContactPerDay: 1,
  },
  {
    key: 'appointments_no_show_followup',
    profiles: ['appointments'],
    name: 'No‑show follow‑up',
    description: 'Check in after a missed appointment.',
    messageType: 'marketing',
    trigger: {
      type: 'event',
      eventType: 'appointment',
      status: 'no_show',
      timeField: 'startAt',
      offsetMinutes: 60,
    },
    template: 'We missed you today. Would you like to reschedule?',
    dedupeWindowMinutes: 1440,
    maxPerContactPerDay: 1,
  },
  {
    key: 'gym_membership_expiring_7d',
    profiles: ['gym'],
    name: 'Membership expiring (7 days)',
    description: 'Notify members 7 days before membership end.',
    messageType: 'service',
    trigger: {
      type: 'event',
      eventType: 'membership',
      status: 'scheduled',
      timeField: 'endAt',
      offsetMinutes: -10080,
    },
    template: 'Your membership expires in 7 days. Renew to keep your benefits.',
    dedupeWindowMinutes: 10080,
    maxPerContactPerDay: 1,
  },
  {
    key: 'gym_inactivity_14d',
    profiles: ['gym'],
    name: 'We miss you (14 days)',
    description: 'Reach out after 14 days of inactivity.',
    messageType: 'marketing',
    trigger: {
      type: 'inactivity',
      inactivityDays: 14,
      eventTypes: ['visit', 'purchase'],
    },
    template: 'We miss you! Come back this week and we’ll be happy to see you.',
    dedupeWindowMinutes: 10080,
    maxPerContactPerDay: 1,
  },
  {
    key: 'hotel_pre_arrival_24h',
    profiles: ['hotel'],
    name: 'Pre‑arrival info (24h)',
    description: 'Send arrival details 24 hours before check‑in.',
    messageType: 'service',
    trigger: {
      type: 'event',
      eventType: 'stay',
      status: 'scheduled',
      timeField: 'startAt',
      offsetMinutes: -1440,
    },
    template: 'Your stay starts tomorrow. We look forward to welcoming you!',
    dedupeWindowMinutes: 1440,
    maxPerContactPerDay: 1,
  },
  {
    key: 'hotel_post_stay_review',
    profiles: ['hotel'],
    name: 'Post‑stay review request',
    description: 'Ask for a review after checkout.',
    messageType: 'marketing',
    trigger: {
      type: 'event',
      eventType: 'stay',
      status: 'completed',
      timeField: 'endAt',
      offsetMinutes: 1440,
    },
    template: 'Thanks for staying with us! We’d love your feedback.',
    dedupeWindowMinutes: 10080,
    maxPerContactPerDay: 1,
  },
  {
    key: 'winback_inactivity_30d',
    profiles: BUSINESS_PROFILES,
    name: 'Win‑back after 30 days',
    description: 'Reach out after 30 days of inactivity.',
    messageType: 'marketing',
    trigger: {
      type: 'inactivity',
      inactivityDays: 30,
      eventTypes: ['visit', 'purchase'],
    },
    template: 'We haven’t seen you in a while. Here’s a friendly nudge to come back.',
    dedupeWindowMinutes: 43200,
    maxPerContactPerDay: 1,
  },
  {
    key: 'post_purchase_followup_1d',
    profiles: BUSINESS_PROFILES,
    name: 'Post‑purchase follow‑up',
    description: 'Send a follow‑up 1 day after purchase.',
    messageType: 'marketing',
    trigger: {
      type: 'event',
      eventType: 'purchase',
      status: 'completed',
      timeField: 'endAt',
      offsetMinutes: 1440,
    },
    template: 'Thank you for your purchase! We’re here if you need anything.',
    dedupeWindowMinutes: 10080,
    maxPerContactPerDay: 1,
  },
];

function getPresetsForProfile(profile) {
  if (!profile) {
    return PRESETS;
  }
  return PRESETS.filter((preset) =>
    preset.profiles.includes(profile) || preset.profiles.includes('all'),
  );
}

async function getBusinessProfile(ownerId) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { businessProfile: true },
  });
  return user?.businessProfile || 'retail';
}

async function listAutomationLibrary(ownerId) {
  const businessProfile = await getBusinessProfile(ownerId);
  const presets = getPresetsForProfile(businessProfile);
  const rules = await prisma.automationRule.findMany({ where: { ownerId } });
  const rulesByKey = new Map(rules.map((rule) => [rule.presetKey, rule]));

  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const mapped = [];
  for (const preset of presets) {
    const rule = rulesByKey.get(preset.key);
    let stats = null;
    if (rule) {
      const [count7, count30] = await Promise.all([
        prisma.automationSend.count({
          where: {
            ruleId: rule.id,
            createdAt: { gte: last7 },
            status: 'sent',
          },
        }),
        prisma.automationSend.count({
          where: {
            ruleId: rule.id,
            createdAt: { gte: last30 },
            status: 'sent',
          },
        }),
      ]);
      stats = {
        sentLast7Days: count7,
        sentLast30Days: count30,
        lastRunAt: rule.lastRunAt,
      };
    }

    mapped.push({
      key: preset.key,
      name: preset.name,
      description: preset.description,
      messageType: preset.messageType,
      trigger: preset.trigger,
      defaultTemplate: preset.template,
      isActive: rule ? rule.isActive : false,
      messageBody: rule?.messageBody || preset.template,
      stats,
    });
  }

  return { businessProfile, presets: mapped };
}

async function upsertAutomationRule(ownerId, presetKey, updates = {}) {
  const preset = PRESETS.find((p) => p.key === presetKey);
  if (!preset) {
    const err = new Error('Preset not found');
    err.code = 'PRESET_NOT_FOUND';
    throw err;
  }

  const messageBody = updates.messageBody ? String(updates.messageBody) : preset.template;
  const isActive = updates.isActive !== undefined ? Boolean(updates.isActive) : false;

  const rule = await prisma.automationRule.upsert({
    where: { ownerId_presetKey: { ownerId, presetKey } },
    update: {
      name: preset.name,
      description: preset.description,
      messageType: preset.messageType,
      messageBody,
      isActive,
      triggerType: preset.trigger.type,
      eventType: preset.trigger.eventType || null,
      eventStatus: preset.trigger.status || null,
      eventTimeField: preset.trigger.timeField || null,
      offsetMinutes: preset.trigger.offsetMinutes || 0,
      inactivityDays: preset.trigger.inactivityDays || null,
      dedupeWindowMinutes: preset.dedupeWindowMinutes || 1440,
      maxPerContactPerDay: preset.maxPerContactPerDay || 1,
      meta: { eventTypes: preset.trigger.eventTypes || null },
    },
    create: {
      ownerId,
      presetKey,
      name: preset.name,
      description: preset.description,
      messageType: preset.messageType,
      messageBody,
      isActive,
      triggerType: preset.trigger.type,
      eventType: preset.trigger.eventType || null,
      eventStatus: preset.trigger.status || null,
      eventTimeField: preset.trigger.timeField || null,
      offsetMinutes: preset.trigger.offsetMinutes || 0,
      inactivityDays: preset.trigger.inactivityDays || null,
      dedupeWindowMinutes: preset.dedupeWindowMinutes || 1440,
      maxPerContactPerDay: preset.maxPerContactPerDay || 1,
      meta: { eventTypes: preset.trigger.eventTypes || null },
    },
  });

  return rule;
}

function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function shouldSkipForContact(rule, contactId, now, scheduledFor) {
  const dayStart = toStartOfDay(now);
  const maxPerDay = rule.maxPerContactPerDay || 1;
  const sentToday = await prisma.automationSend.count({
    where: {
      ruleId: rule.id,
      contactId,
      createdAt: { gte: dayStart },
    },
  });
  if (sentToday >= maxPerDay) {
    return true;
  }

  const windowMinutes = rule.dedupeWindowMinutes || 1440;
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const recent = await prisma.automationSend.findFirst({
    where: {
      ruleId: rule.id,
      contactId,
      createdAt: { gte: windowStart },
    },
    select: { id: true },
  });
  if (recent) {
    return true;
  }

  if (scheduledFor) {
    const existing = await prisma.automationSend.findFirst({
      where: {
        ruleId: rule.id,
        contactId,
        scheduledFor,
      },
      select: { id: true },
    });
    if (existing) {
      return true;
    }
  }

  return false;
}

async function sendRuleMessage(rule, contact, messageBody, scheduledFor, eventId) {
  if (rule.messageType === 'marketing' && !contact.isSubscribed) {
    return { sent: false, reason: 'contact_not_subscribed' };
  }
  if (rule.messageType === 'service' && contact.serviceAllowed === false) {
    return { sent: false, reason: 'service_not_allowed' };
  }

  const created = await prisma.automationSend.create({
    data: {
      ownerId: rule.ownerId,
      ruleId: rule.id,
      contactId: contact.id,
      eventId: eventId || null,
      messageType: rule.messageType,
      messageBody,
      status: 'queued',
      scheduledFor,
    },
  });

  const result = await sendSMSWithCredits({
    ownerId: rule.ownerId,
    destination: contact.phone,
    text: messageBody,
    contactId: contact.id,
    messageType: rule.messageType,
    meta: {
      reason: `automation:library:${rule.presetKey}`,
      automationRuleId: rule.id,
      eventId: eventId || null,
    },
  });

  if (result.sent && result.messageId) {
    await prisma.automationSend.update({
      where: { id: created.id },
      data: {
        status: 'sent',
        providerMessageId: result.messageId,
        deliveryStatus: 'Sent',
        sentAt: new Date(),
        creditsCharged: result.creditsCharged || 0,
        transactionId: result.transactionId || null,
      },
    });
    return { sent: true };
  }

  await prisma.automationSend.update({
    where: { id: created.id },
    data: {
      status: 'failed',
      error: result.error || result.reason || 'send_failed',
      failedAt: new Date(),
      creditsCharged: result.creditsCharged || 0,
      transactionId: result.transactionId || null,
    },
  });
  return { sent: false, reason: result.reason || 'send_failed' };
}

async function processEventRule(rule, now) {
  const offsetMs = (rule.offsetMinutes || 0) * 60 * 1000;
  const windowMinutes = rule.dedupeWindowMinutes || 1440;
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const rangeStart = new Date(windowStart.getTime() - offsetMs);
  const rangeEnd = new Date(now.getTime() - offsetMs);
  const timeField = rule.eventTimeField || 'startAt';

  const where = {
    ownerId: rule.ownerId,
    eventType: rule.eventType,
    ...(rule.eventStatus ? { status: rule.eventStatus } : {}),
  };

  if (timeField === 'endAt') {
    where.endAt = { gte: rangeStart, lte: rangeEnd };
  } else {
    where.startAt = { gte: rangeStart, lte: rangeEnd };
  }

  const events = await prisma.customerEvent.findMany({
    where,
    include: { contact: true },
    take: 200,
    orderBy: { startAt: 'asc' },
  });

  let sent = 0;
  for (const event of events) {
    const contact = event.contact;
    if (!contact) {
      continue;
    }

    const scheduledFor = new Date(((timeField === 'endAt' ? event.endAt : event.startAt) || now).getTime() + offsetMs);

    const shouldSkip = await shouldSkipForContact(rule, contact.id, now, scheduledFor);
    if (shouldSkip) {
      continue;
    }

    const messageBody = render(rule.messageBody, contact);
    const result = await sendRuleMessage(rule, contact, messageBody, scheduledFor, event.id);
    if (result.sent) {
      sent++;
    }
  }

  return { sent };
}

async function processInactivityRule(rule, now) {
  const inactivityDays = rule.inactivityDays || 0;
  if (!inactivityDays) {
    return { sent: 0 };
  }

  const cutoff = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000);
  const eventTypes = rule.meta?.eventTypes && Array.isArray(rule.meta.eventTypes)
    ? rule.meta.eventTypes
    : ['visit', 'purchase'];

  const results = await prisma.$queryRawUnsafe(
    `SELECT "contactId", MAX(COALESCE("endAt","startAt")) as "lastEventAt"
     FROM "CustomerEvent"
     WHERE "ownerId"=$1 AND "contactId" IS NOT NULL AND "eventType" = ANY($2) AND "status"='completed'
     GROUP BY "contactId"
     HAVING MAX(COALESCE("endAt","startAt")) <= $3`,
    rule.ownerId,
    eventTypes,
    cutoff,
  );

  const inactiveContactIds = results.map((row) => row.contactId).filter(Boolean);

  const contacts = await prisma.contact.findMany({
    where: {
      ownerId: rule.ownerId,
      id: { in: inactiveContactIds },
    },
  });

  let sent = 0;
  const scheduledFor = toStartOfDay(now);
  for (const contact of contacts) {
    const shouldSkip = await shouldSkipForContact(rule, contact.id, now, scheduledFor);
    if (shouldSkip) {
      continue;
    }

    const messageBody = render(rule.messageBody, contact);
    const result = await sendRuleMessage(rule, contact, messageBody, scheduledFor, null);
    if (result.sent) {
      sent++;
    }
  }

  return { sent };
}

async function processAutomationLibraryRuns(options = {}) {
  const now = options.now || new Date();
  const rules = await prisma.automationRule.findMany({ where: { isActive: true } });
  const summary = { rules: rules.length, sent: 0 };

  for (const rule of rules) {
    try {
      let result = { sent: 0 };
      if (rule.triggerType === 'event') {
        result = await processEventRule(rule, now);
      } else if (rule.triggerType === 'inactivity') {
        result = await processInactivityRule(rule, now);
      }

      if (result.sent) {
        summary.sent += result.sent;
      }

      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: now },
      });
    } catch (err) {
      logger.error({ ruleId: rule.id, err: err.message }, 'Automation rule processing failed');
    }
  }

  return summary;
}

module.exports = {
  listAutomationLibrary,
  upsertAutomationRule,
  processAutomationLibraryRuns,
  getBusinessProfile,
};
