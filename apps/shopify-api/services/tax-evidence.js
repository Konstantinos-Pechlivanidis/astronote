import prisma from './prisma.js';
import { logger } from '../utils/logger.js';

export async function upsertTaxEvidence({
  shopId,
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
    shopId,
    invoiceId: invoiceId || null,
    billingCountry: billingCountry || null,
    ipCountry: ipCountry || null,
    vatIdProvided: vatIdProvided || null,
    vatIdValidated: vatIdValidated === true ? true : vatIdValidated === false ? false : null,
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
      { shopId, invoiceId, taxTreatment: data.taxTreatment },
      'Tax evidence upserted for invoice',
    );

    return record;
  }

  const record = await prisma.taxEvidence.create({ data });
  logger.info(
    { shopId, taxTreatment: data.taxTreatment },
    'Tax evidence created',
  );
  return record;
}

export default {
  upsertTaxEvidence,
};
