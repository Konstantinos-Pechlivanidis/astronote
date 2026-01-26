const prisma = require('../lib/prisma');
const { normalizePhoneToE164 } = require('../lib/phone');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_TYPES = ['campaign', 'automation', 'automation_library', 'direct'];

const parseDateInput = (value, { endOfDay = false } = {}) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (DATE_ONLY_RE.test(raw)) {
    const [year, month, day] = raw.split('-').map((entry) => Number(entry));
    if (!year || !month || !day) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (endOfDay) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return date;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const normalizeRange = ({ start, end }) => {
  if (!start || !end) {
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  if (startDate >= endDate) {
    return null;
  }
  return { start: startDate, end: endDate };
};

const normalizeStatus = (value) => {
  if (!value) {
    return null;
  }
  const normalized = String(value).toLowerCase().trim();
  const allowed = ['queued', 'processing', 'sent', 'failed', 'pending'];
  return allowed.includes(normalized) ? normalized : null;
};

const resolvePhoneFilter = (value) => {
  if (!value) {
    return null;
  }
  const normalized = normalizePhoneToE164(value);
  if (!normalized) {
    return null;
  }
  return normalized;
};

const mapStatusForMessage = (status, source) => {
  if (!status) {
    return null;
  }
  if (source === 'direct') {
    if (status === 'queued') {
      return 'pending';
    }
    return status;
  }
  if (status === 'pending') {
    return 'queued';
  }
  return status;
};

const buildRangeFilter = (range) => {
  if (!range) {
    return undefined;
  }
  return { createdAt: { gte: range.start, lt: range.end } };
};

async function listMessageLogs({ ownerId, page = 1, pageSize = 50, from, to, status, messageType, source, phone }) {
  const resolvedStatus = normalizeStatus(status);
  if (status && !resolvedStatus) {
    const err = new Error('Invalid status filter');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const resolvedSource = source ? String(source) : null;
  if (resolvedSource && !SOURCE_TYPES.includes(resolvedSource)) {
    const err = new Error('Invalid source filter');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const resolvedPhone = phone ? resolvePhoneFilter(phone) : null;
  if (phone && !resolvedPhone) {
    const err = new Error('Invalid phone number');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const rangeStart = parseDateInput(from);
  const rangeEnd = parseDateInput(to, { endOfDay: true });
  const range = normalizeRange({ start: rangeStart, end: rangeEnd });
  if ((from || to) && !range) {
    const err = new Error('Invalid date range');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const limit = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const offset = Math.max(0, (Math.max(1, Number(page) || 1) - 1) * limit);
  const take = offset + limit;

  const rangeFilter = buildRangeFilter(range);
  const typeFilter = messageType && ['marketing', 'service'].includes(String(messageType))
    ? String(messageType)
    : null;

  const shouldInclude = (key) => !resolvedSource || resolvedSource === key;
  const phoneFilterCampaign = resolvedPhone
    ? { OR: [{ to: resolvedPhone }, { contact: { phone: resolvedPhone } }] }
    : {};

  const phoneFilterAutomation = resolvedPhone
    ? { OR: [{ to: resolvedPhone }, { contact: { phone: resolvedPhone } }] }
    : {};

  const phoneFilterAutomationSend = resolvedPhone
    ? { contact: { phone: resolvedPhone } }
    : {};

  const phoneFilterDirect = resolvedPhone ? { phoneE164: resolvedPhone } : {};

  const campaignStatus = resolvedStatus ? mapStatusForMessage(resolvedStatus, 'campaign') : null;
  const automationStatus = resolvedStatus ? mapStatusForMessage(resolvedStatus, 'automation') : null;
  const automationSendStatus = resolvedStatus ? mapStatusForMessage(resolvedStatus, 'automation_library') : null;
  const directStatus = resolvedStatus ? mapStatusForMessage(resolvedStatus, 'direct') : null;

  const [campaignRows, automationRows, automationSendRows, directRows, totalCampaign, totalAutomation, totalAutomationSend, totalDirect] = await Promise.all([
    shouldInclude('campaign')
      ? prisma.campaignMessage.findMany({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(campaignStatus ? { status: campaignStatus } : {}),
          ...(typeFilter ? { campaign: { messageType: typeFilter } } : {}),
          ...phoneFilterCampaign,
        },
        include: {
          campaign: { select: { id: true, name: true, messageType: true } },
          contact: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      })
      : Promise.resolve([]),
    shouldInclude('automation')
      ? prisma.automationMessage.findMany({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(automationStatus ? { status: automationStatus } : {}),
          ...(typeFilter ? { automation: { messageType: typeFilter } } : {}),
          ...phoneFilterAutomation,
        },
        include: {
          automation: { select: { id: true, type: true, messageType: true } },
          contact: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      })
      : Promise.resolve([]),
    shouldInclude('automation_library')
      ? prisma.automationSend.findMany({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(automationSendStatus ? { status: automationSendStatus } : {}),
          ...(typeFilter ? { messageType: typeFilter } : {}),
          ...phoneFilterAutomationSend,
        },
        include: {
          rule: { select: { id: true, name: true, messageType: true } },
          contact: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      })
      : Promise.resolve([]),
    shouldInclude('direct')
      ? prisma.directMessage.findMany({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(directStatus ? { status: directStatus } : {}),
          ...(typeFilter ? { messageType: typeFilter } : {}),
          ...phoneFilterDirect,
        },
        include: {
          contact: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      })
      : Promise.resolve([]),
    shouldInclude('campaign')
      ? prisma.campaignMessage.count({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(campaignStatus ? { status: campaignStatus } : {}),
          ...(typeFilter ? { campaign: { messageType: typeFilter } } : {}),
          ...phoneFilterCampaign,
        },
      })
      : Promise.resolve(0),
    shouldInclude('automation')
      ? prisma.automationMessage.count({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(automationStatus ? { status: automationStatus } : {}),
          ...(typeFilter ? { automation: { messageType: typeFilter } } : {}),
          ...phoneFilterAutomation,
        },
      })
      : Promise.resolve(0),
    shouldInclude('automation_library')
      ? prisma.automationSend.count({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(automationSendStatus ? { status: automationSendStatus } : {}),
          ...(typeFilter ? { messageType: typeFilter } : {}),
          ...phoneFilterAutomationSend,
        },
      })
      : Promise.resolve(0),
    shouldInclude('direct')
      ? prisma.directMessage.count({
        where: {
          ownerId,
          ...(rangeFilter || {}),
          ...(directStatus ? { status: directStatus } : {}),
          ...(typeFilter ? { messageType: typeFilter } : {}),
          ...phoneFilterDirect,
        },
      })
      : Promise.resolve(0),
  ]);

  const mappedCampaigns = campaignRows.map((msg) => ({
    id: `campaign-${msg.id}`,
    source: 'campaign',
    sourceId: msg.campaignId,
    sourceName: msg.campaign?.name || 'Campaign',
    ownerId: msg.ownerId,
    contactId: msg.contactId,
    phoneE164: msg.contact?.phone || msg.to,
    messageType: msg.campaign?.messageType || 'marketing',
    status: msg.status,
    deliveryStatus: msg.deliveryStatus,
    providerMessageId: msg.providerMessageId,
    creditsCharged: msg.creditsCharged,
    transactionId: msg.transactionId,
    createdAt: msg.createdAt,
    sentAt: msg.sentAt,
    failedAt: msg.failedAt,
    deliveredAt: msg.deliveredAt,
  }));

  const mappedAutomations = automationRows.map((msg) => ({
    id: `automation-${msg.id}`,
    source: 'automation',
    sourceId: msg.automationId,
    sourceName: msg.automation?.type ? `Automation: ${msg.automation.type.replace('_', ' ')}` : 'Automation',
    ownerId: msg.ownerId,
    contactId: msg.contactId,
    phoneE164: msg.contact?.phone || msg.to,
    messageType: msg.automation?.messageType || 'marketing',
    status: msg.status,
    deliveryStatus: msg.deliveryStatus,
    providerMessageId: msg.providerMessageId,
    creditsCharged: msg.creditsCharged,
    transactionId: msg.transactionId,
    createdAt: msg.createdAt,
    sentAt: msg.sentAt,
    failedAt: msg.failedAt,
    deliveredAt: null,
  }));

  const mappedLibrary = automationSendRows.map((msg) => ({
    id: `automation_library-${msg.id}`,
    source: 'automation_library',
    sourceId: msg.ruleId,
    sourceName: msg.rule?.name || 'Automation Rule',
    ownerId: msg.ownerId,
    contactId: msg.contactId,
    phoneE164: msg.contact?.phone,
    messageType: msg.messageType || msg.rule?.messageType || 'marketing',
    status: msg.status,
    deliveryStatus: msg.deliveryStatus,
    providerMessageId: msg.providerMessageId,
    creditsCharged: msg.creditsCharged,
    transactionId: msg.transactionId,
    createdAt: msg.createdAt,
    sentAt: msg.sentAt,
    failedAt: msg.failedAt,
    deliveredAt: null,
  }));

  const mappedDirect = directRows.map((msg) => ({
    id: `direct-${msg.id}`,
    source: 'direct',
    sourceId: msg.id,
    sourceName: 'Direct message',
    ownerId: msg.ownerId,
    contactId: msg.contactId || null,
    phoneE164: msg.phoneE164,
    messageType: msg.messageType || 'marketing',
    status: msg.status,
    deliveryStatus: msg.deliveryStatus,
    providerMessageId: msg.providerMessageId,
    creditsCharged: msg.creditsCharged,
    transactionId: msg.transactionId,
    createdAt: msg.createdAt,
    sentAt: msg.sentAt,
    failedAt: msg.failedAt,
    deliveredAt: msg.deliveredAt || null,
  }));

  const combined = [...mappedCampaigns, ...mappedAutomations, ...mappedLibrary, ...mappedDirect]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const items = combined.slice(offset, offset + limit);
  const total = totalCampaign + totalAutomation + totalAutomationSend + totalDirect;

  return {
    items,
    total,
    page: Math.max(1, Number(page) || 1),
    pageSize: limit,
  };
}

async function listMessageLogsForExport({ ownerId, from, to }) {
  const rangeStart = parseDateInput(from);
  const rangeEnd = parseDateInput(to, { endOfDay: true });
  const range = normalizeRange({ start: rangeStart, end: rangeEnd });
  if (!range) {
    const err = new Error('Invalid date range');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const rangeFilter = buildRangeFilter(range);

  const [campaignRows, automationRows, automationSendRows, directRows] = await Promise.all([
    prisma.campaignMessage.findMany({
      where: { ownerId, ...(rangeFilter || {}) },
      include: { campaign: { select: { id: true, name: true, messageType: true } }, contact: { select: { id: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.automationMessage.findMany({
      where: { ownerId, ...(rangeFilter || {}) },
      include: { automation: { select: { id: true, type: true, messageType: true } }, contact: { select: { id: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.automationSend.findMany({
      where: { ownerId, ...(rangeFilter || {}) },
      include: { rule: { select: { id: true, name: true, messageType: true } }, contact: { select: { id: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.directMessage.findMany({
      where: { ownerId, ...(rangeFilter || {}) },
      include: { contact: { select: { id: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const mapped = [
    ...campaignRows.map((msg) => ({
      source: 'campaign',
      sourceId: msg.campaignId,
      sourceName: msg.campaign?.name || 'Campaign',
      messageType: msg.campaign?.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId || null,
      phoneE164: msg.contact?.phone || msg.to,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
    ...automationRows.map((msg) => ({
      source: 'automation',
      sourceId: msg.automationId,
      sourceName: msg.automation?.type || 'Automation',
      messageType: msg.automation?.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId || null,
      phoneE164: msg.contact?.phone || msg.to,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
    ...automationSendRows.map((msg) => ({
      source: 'automation_library',
      sourceId: msg.ruleId,
      sourceName: msg.rule?.name || 'Automation Rule',
      messageType: msg.messageType || msg.rule?.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId || null,
      phoneE164: msg.contact?.phone,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
    ...directRows.map((msg) => ({
      source: 'direct',
      sourceId: msg.id,
      sourceName: 'Direct message',
      messageType: msg.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId || null,
      phoneE164: msg.phoneE164,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { rows: mapped, range };
}

module.exports = {
  listMessageLogs,
  listMessageLogsForExport,
};
