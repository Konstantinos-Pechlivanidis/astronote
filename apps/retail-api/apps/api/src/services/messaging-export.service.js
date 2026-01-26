const prisma = require('../lib/prisma');
const pino = require('pino');
const { parseDateInput, normalizeRange } = require('./billing-export.service');

const logger = pino({ name: 'messaging-export' });

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildCsv = (rows, columns) => {
  const header = columns.map((col) => csvEscape(col)).join(',');
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','));
  return [header, ...lines].join('\n');
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
};

const mapRows = (rows, ownerFallback = {}) =>
  rows.map((row) => ({
    owner_id: row.ownerId,
    owner_email: row.owner?.email || ownerFallback.email || '',
    owner_company: row.owner?.company || ownerFallback.company || '',
    source: row.source,
    source_id: row.sourceId,
    source_name: row.sourceName,
    message_type: row.messageType,
    status: row.status,
    delivery_status: row.deliveryStatus || '',
    phone: row.phoneE164 || '',
    provider_message_id: row.providerMessageId || '',
    credits_charged: Number.isFinite(row.creditsCharged) ? row.creditsCharged : 0,
    transaction_id: row.transactionId || '',
    created_at: formatDate(row.createdAt),
    sent_at: formatDate(row.sentAt),
    failed_at: formatDate(row.failedAt),
  }));

async function generateMessagingExport({ start, end, ownerId = null }) {
  const range = normalizeRange({
    start: parseDateInput(start),
    end: parseDateInput(end, { endOfDay: true }),
  });

  if (!range) {
    throw new Error('Invalid date range');
  }

  const rangeFilter = { createdAt: { gte: range.start, lt: range.end } };
  const ownerFilter = ownerId ? { ownerId } : {};

  const [campaignRows, automationRows, automationSendRows, directRows] = await Promise.all([
    prisma.campaignMessage.findMany({
      where: { ...ownerFilter, ...rangeFilter },
      include: {
        owner: { select: { id: true, email: true, company: true } },
        campaign: { select: { id: true, name: true, messageType: true } },
        contact: { select: { phone: true } },
      },
    }),
    prisma.automationMessage.findMany({
      where: { ...ownerFilter, ...rangeFilter },
      include: {
        owner: { select: { id: true, email: true, company: true } },
        automation: { select: { id: true, type: true, messageType: true } },
        contact: { select: { phone: true } },
      },
    }),
    prisma.automationSend.findMany({
      where: { ...ownerFilter, ...rangeFilter },
      include: {
        owner: { select: { id: true, email: true, company: true } },
        rule: { select: { id: true, name: true, messageType: true } },
        contact: { select: { phone: true } },
      },
    }),
    prisma.directMessage.findMany({
      where: { ...ownerFilter, ...rangeFilter },
      include: {
        owner: { select: { id: true, email: true, company: true } },
      },
    }),
  ]);

  const mapped = [
    ...campaignRows.map((msg) => ({
      ownerId: msg.ownerId,
      owner: msg.owner,
      source: 'campaign',
      sourceId: msg.campaignId,
      sourceName: msg.campaign?.name || 'Campaign',
      messageType: msg.campaign?.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      phoneE164: msg.contact?.phone || msg.to,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
    ...automationRows.map((msg) => ({
      ownerId: msg.ownerId,
      owner: msg.owner,
      source: 'automation',
      sourceId: msg.automationId,
      sourceName: msg.automation?.type || 'Automation',
      messageType: msg.automation?.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      phoneE164: msg.contact?.phone || msg.to,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
    ...automationSendRows.map((msg) => ({
      ownerId: msg.ownerId,
      owner: msg.owner,
      source: 'automation_library',
      sourceId: msg.ruleId,
      sourceName: msg.rule?.name || 'Automation Rule',
      messageType: msg.messageType || msg.rule?.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      phoneE164: msg.contact?.phone,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
    ...directRows.map((msg) => ({
      ownerId: msg.ownerId,
      owner: msg.owner,
      source: 'direct',
      sourceId: msg.id,
      sourceName: 'Direct message',
      messageType: msg.messageType || 'marketing',
      status: msg.status,
      deliveryStatus: msg.deliveryStatus,
      phoneE164: msg.phoneE164,
      providerMessageId: msg.providerMessageId,
      creditsCharged: msg.creditsCharged || 0,
      transactionId: msg.transactionId,
      createdAt: msg.createdAt,
      sentAt: msg.sentAt,
      failedAt: msg.failedAt,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const rows = mapRows(mapped);
  const columns = [
    'owner_id',
    'owner_email',
    'owner_company',
    'source',
    'source_id',
    'source_name',
    'message_type',
    'status',
    'delivery_status',
    'phone',
    'provider_message_id',
    'credits_charged',
    'transaction_id',
    'created_at',
    'sent_at',
    'failed_at',
  ];

  const csv = buildCsv(rows, columns);

  const sentCount = mapped.filter((row) => row.status === 'sent').length;
  const failedCount = mapped.filter((row) => row.status === 'failed').length;
  const deliveredCount = mapped.filter((row) => {
    const status = String(row.deliveryStatus || '').toLowerCase();
    return status.includes('deliv');
  }).length;
  const creditsSpent = mapped.reduce((sum, row) => sum + (Number(row.creditsCharged) || 0), 0);

  const [unsubscribes, resubscribes] = await Promise.all([
    prisma.consentEvent.count({
      where: {
        ...ownerFilter,
        type: 'unsubscribed',
        createdAt: { gte: range.start, lt: range.end },
      },
    }),
    prisma.consentEvent.count({
      where: {
        ...ownerFilter,
        type: 'resubscribed',
        createdAt: { gte: range.start, lt: range.end },
      },
    }),
  ]);

  const summary = {
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    sentCount,
    deliveredCount,
    failedCount,
    creditsSpent,
    unsubscribes,
    resubscribes,
  };

  logger.info({ sentCount, failedCount, deliveredCount, creditsSpent }, 'Messaging export generated');

  return { rows, csv, summary, range };
}

module.exports = {
  generateMessagingExport,
};
