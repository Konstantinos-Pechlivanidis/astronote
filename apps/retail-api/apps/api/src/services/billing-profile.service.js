const prisma = require('../lib/prisma');
const pino = require('pino');

const logger = pino({ name: 'billing-profile-service' });

const normalizeVatNumber = (value) => {
  if (!value) {
    return null;
  }
  return String(value).replace(/\s+/g, '').toUpperCase();
};

const mapStripeTaxStatus = (status) => {
  if (!status) {
    return null;
  }
  if (status === 'verified') {
    return 'verified';
  }
  if (status === 'unverified') {
    return 'unverified';
  }
  if (status === 'pending') {
    return 'pending';
  }
  return 'invalid';
};

const normalizeAddress = (address) => {
  if (!address) {return null;}
  return {
    line1: address.line1 || null,
    line2: address.line2 || null,
    city: address.city || null,
    state: address.state || null,
    postalCode: address.postal_code || address.postalCode || null,
    country: address.country || null,
  };
};

const extractTaxId = (taxIds = []) => {
  if (!Array.isArray(taxIds)) {return null;}
  const vat = taxIds.find((entry) => entry.type === 'eu_vat') || taxIds[0];
  if (!vat) {return null;}
  return {
    value: vat.value || vat.id || null,
    country: vat.country || null,
    status: mapStripeTaxStatus(vat.verification?.status),
  };
};

async function getBillingProfile(ownerId) {
  return prisma.billingProfile.findUnique({
    where: { ownerId },
  });
}

async function upsertBillingProfile(ownerId, data) {
  return prisma.billingProfile.upsert({
    where: { ownerId },
    create: {
      ownerId,
      ...data,
    },
    update: {
      ...data,
    },
  });
}

async function syncBillingProfileFromStripe({
  ownerId,
  customer,
  session,
  invoice,
  taxTreatment,
  taxExempt,
} = {}) {
  try {
    const customerDetails = session?.customer_details || null;
    const customerAddress = customerDetails?.address || invoice?.customer_address || null;
    const invoiceEmail = invoice?.customer_email || null;
    const invoiceName = invoice?.customer_name || null;

    const taxIdFromSession = extractTaxId(customerDetails?.tax_ids);
    const taxIdFromInvoice = extractTaxId(invoice?.customer_tax_ids);
    const taxIdFromCustomer = extractTaxId(customer?.tax_ids?.data);

    const taxId = taxIdFromSession || taxIdFromInvoice || taxIdFromCustomer;

    const billingAddress = normalizeAddress(customerAddress);
    const billingEmail = customerDetails?.email || invoiceEmail || customer?.email || null;
    const legalName = customerDetails?.name || invoiceName || customer?.name || null;

    const updatePayload = {
      legalName,
      billingEmail,
      billingAddress,
      vatNumber: normalizeVatNumber(taxId?.value),
      vatCountry: taxId?.country || billingAddress?.country || null,
      taxStatus: taxId?.status || null,
      taxExempt: taxExempt === true ? true : undefined,
    };

    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined || updatePayload[key] === null) {
        delete updatePayload[key];
        return;
      }
      if (key === 'billingAddress') {
        const values = Object.values(updatePayload.billingAddress || {});
        if (!values.some((value) => value)) {
          delete updatePayload.billingAddress;
        }
      }
    });

    if (!Object.keys(updatePayload).length) {
      return null;
    }

    const profile = await upsertBillingProfile(ownerId, updatePayload);

    logger.info(
      { ownerId, taxTreatment, vatNumber: profile.vatNumber, taxStatus: profile.taxStatus },
      'Billing profile synced from Stripe',
    );

    return profile;
  } catch (error) {
    logger.warn(
      { ownerId, error: error.message },
      'Failed to sync billing profile from Stripe',
    );
    return null;
  }
}

module.exports = {
  getBillingProfile,
  upsertBillingProfile,
  syncBillingProfileFromStripe,
};
