const prisma = require('../lib/prisma');
const pino = require('pino');
const { getWeeklyRange } = require('./billing-export.service');
const { generateMessagingExport } = require('./messaging-export.service');
const { sendMail } = require('./email.service');

const logger = pino({ name: 'messaging-export-runner' });

const parseRecipients = (value) => {
  if (!value) {
    return [];
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const buildFileStamp = (range) => {
  const start = range.start.toISOString().slice(0, 10);
  const end = range.end.toISOString().slice(0, 10);
  return `${start}_${end}`;
};

const ensureExportRun = async ({ kind, rangeStart, rangeEnd, recipientEmail }) => {
  try {
    return await prisma.exportRun.create({
      data: {
        kind,
        status: 'pending',
        rangeStart,
        rangeEnd,
        recipientEmail: recipientEmail || null,
        startedAt: new Date(),
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return prisma.exportRun.findUnique({
        where: {
          kind_rangeStart_rangeEnd: {
            kind,
            rangeStart,
            rangeEnd,
          },
        },
      });
    }
    throw error;
  }
};

const completeExportRun = async (id, data) => {
  return prisma.exportRun.update({
    where: { id },
    data,
  });
};

const runWeeklyMessagingExport = async () => {
  const recipients = parseRecipients(process.env.MESSAGING_EXPORT_EMAIL_TO || process.env.EXPORT_EMAIL_TO);
  if (!recipients.length) {
    logger.warn('MESSAGING_EXPORT_EMAIL_TO is empty; skipping weekly messaging export');
    return { skipped: true, reason: 'missing_recipients' };
  }

  const range = getWeeklyRange();
  const recipientEmail = recipients.join(',');
  const exportRun = await ensureExportRun({
    kind: 'messaging_weekly',
    rangeStart: range.start,
    rangeEnd: range.end,
    recipientEmail,
  });

  if (!exportRun) {
    logger.warn('Messaging export run could not be created or resolved');
    return { skipped: true, reason: 'export_run_missing' };
  }

  if (exportRun.status === 'completed') {
    logger.info({ exportRunId: exportRun.id }, 'Weekly messaging export already completed; skipping');
    return { skipped: true, reason: 'already_completed' };
  }

  try {
    if (exportRun.status !== 'pending') {
      await completeExportRun(exportRun.id, {
        status: 'pending',
        startedAt: new Date(),
        errorMessage: null,
      });
    }

    const exportPayload = await generateMessagingExport({ start: range.start, end: range.end });
    const fileStamp = buildFileStamp(range);
    const subject = process.env.MESSAGING_EXPORT_EMAIL_SUBJECT || `Weekly messaging export ${fileStamp}`;
    const body = process.env.MESSAGING_EXPORT_EMAIL_BODY || 'Weekly messaging export is attached.';

    await sendMail({
      to: recipients,
      subject,
      text: body,
      attachments: [
        {
          filename: `messages_${fileStamp}.csv`,
          content: exportPayload.csv,
          contentType: 'text/csv',
        },
      ],
    });

    await completeExportRun(exportRun.id, {
      status: 'completed',
      completedAt: new Date(),
      errorMessage: null,
      meta: {
        rows: exportPayload.rows.length,
        recipients: recipientEmail,
        summary: exportPayload.summary,
      },
    });

    logger.info({ exportRunId: exportRun.id }, 'Weekly messaging export completed');
    return { ok: true, exportRunId: exportRun.id };
  } catch (error) {
    await completeExportRun(exportRun.id, {
      status: 'failed',
      errorMessage: error.message,
      meta: {
        error: error.message,
      },
    });

    logger.error({ exportRunId: exportRun.id, err: error.message }, 'Weekly messaging export failed');
    throw error;
  }
};

module.exports = {
  runWeeklyMessagingExport,
};
