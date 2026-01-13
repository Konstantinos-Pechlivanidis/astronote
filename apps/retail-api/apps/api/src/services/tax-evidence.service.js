const prisma = require('../lib/prisma');
const pino = require('pino');

const logger = pino({ name: 'tax-evidence-service' });

async function upsertTaxEvidence({
  ownerId,
  invoiceId = null,
  billingCountry,
  ipCountry,
  vatIdProvided,
  vatIdValidated,
  taxRateApplied,
  taxJurisdiction,
  taxTreatment,
}) {
  const data = {
    ownerId,
    invoiceId: invoiceId || null,
    billingCountry: billingCountry || null,
    ipCountry: ipCountry || null,
    vatIdProvided: vatIdProvided || null,
    vatIdValidated:
      vatIdValidated === true ? true : vatIdValidated === false ? false : null,
    taxRateApplied: Number.isFinite(taxRateApplied) ? taxRateApplied : null,
    taxJurisdiction: taxJurisdiction || null,
    taxTreatment: taxTreatment || null,
  };

  if (invoiceId) {
    const record = await prisma.taxEvidence.upsert({
      where: { invoiceId },
      update: data,
      create: data,
    });

    logger.info(
      { ownerId, invoiceId, taxTreatment: data.taxTreatment },
      'Tax evidence upserted for invoice',
    );

    return record;
  }

  const record = await prisma.taxEvidence.create({ data });
  logger.info({ ownerId, taxTreatment: data.taxTreatment }, 'Tax evidence created');
  return record;
}

module.exports = {
  upsertTaxEvidence,
};
