const nodemailer = require('nodemailer');
const pino = require('pino');

const logger = pino({ name: 'email-service' });

const parseBoolean = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return null;
};

const getTransportConfig = () => {
  const host = process.env.SMTP_HOST || '';
  if (!host) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = parseBoolean(process.env.SMTP_SECURE);
  const secure = typeof secureEnv === 'boolean' ? secureEnv : port === 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  };
};

let cachedTransport = null;

const getTransport = () => {
  if (cachedTransport) {
    return cachedTransport;
  }
  const config = getTransportConfig();
  if (!config) {
    return null;
  }
  cachedTransport = nodemailer.createTransport(config);
  return cachedTransport;
};

const sendMail = async ({ to, subject, text, attachments }) => {
  const transport = getTransport();
  if (!transport) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  const from = process.env.EXPORT_EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '';
  if (!from) {
    throw new Error('SMTP_FROM_MISSING');
  }

  const info = await transport.sendMail({
    from,
    to,
    subject,
    text,
    attachments,
  });

  logger.info({ messageId: info?.messageId }, 'Email sent');
  return info;
};

module.exports = {
  sendMail,
};
