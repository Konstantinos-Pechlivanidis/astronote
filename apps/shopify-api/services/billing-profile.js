import prisma from './prisma.js';
import { logger } from '../utils/logger.js';

const normalizeVatNumber = (value) => {
  if (!value) return null;
  return String(value).replace(/\s+/g, '').toUpperCase();
};

const mapStripeTaxStatus = (status) => {
  if (!status) return null;
  if (status === 'verified') return 'verified';
  if (status === 'unverified') return 'unverified';
  if (status === 'pending') return 'pending';
  return 'invalid';
};

const normalizeAddress = (address) => {
  if (!address) return null;
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
  if (!Array.isArray(taxIds)) return null;
  const vat = taxIds.find((entry) => entry.type === 'eu_vat') || taxIds[0];
  if (!vat) return null;
  return {
    value: vat.value || vat.id || null,
    country: vat.country || null,
    status: mapStripeTaxStatus(vat.verification?.status),
  };
};

export async function getBillingProfile(shopId) {
  return prisma.shopBillingProfile.findUnique({
    where: { shopId },
  });
}

/**
 * Validate billing profile completeness for checkout
 * Required fields: billingEmail, legalName, country, address line1
 * VAT rules: If country=GR and isBusiness=true, VAT number is required
 * @param {Object} profile - Billing profile object
 * @returns {Object} { valid: boolean, missingFields: string[], vatRequired: boolean, vatMessage?: string }
 */
export function validateBillingProfileForCheckout(profile) {
  if (!profile) {
    return {
      valid: false,
      missingFields: ['billingEmail', 'legalName', 'country', 'address.line1'],
      vatRequired: false,
    };
  }

  const missingFields = [];

  // Required: billingEmail
  if (!profile.billingEmail || !profile.billingEmail.trim()) {
    missingFields.push('billingEmail');
  }

  // Required: legalName
  if (!profile.legalName || !profile.legalName.trim()) {
    missingFields.push('legalName');
  }

  // Required: country (from billingAddress or vatCountry)
  const country = profile.billingAddress?.country || profile.vatCountry;
  if (!country || !country.trim()) {
    missingFields.push('country');
  }

  // Required: address line1
  if (!profile.billingAddress?.line1 || !profile.billingAddress.line1.trim()) {
    missingFields.push('address.line1');
  }

  // VAT validation rules
  const normalizedCountry = country ? String(country).toUpperCase().trim() : null;
  const isBusiness = profile.isBusiness === true;
  const hasVatNumber = profile.vatNumber && profile.vatNumber.trim();

  // Rule: If country is GR (Greece) and isBusiness=true, VAT number is required
  const vatRequired = normalizedCountry === 'GR' && isBusiness;
  let vatMessage = null;

  if (vatRequired && !hasVatNumber) {
    missingFields.push('vatNumber');
    vatMessage = 'VAT number (AFM) is required for Greek businesses. Please provide your VAT number.';
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    vatRequired,
    vatMessage,
  };
}

export async function upsertBillingProfile(shopId, data) {
  return prisma.shopBillingProfile.upsert({
    where: { shopId },
    create: {
      shopId,
      ...data,
    },
    update: {
      ...data,
    },
  });
}

export async function syncBillingProfileFromStripe({
  shopId,
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

    // Strip empty values to avoid overwriting with nulls unless needed
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

    const profile = await upsertBillingProfile(shopId, updatePayload);

    logger.info(
      { shopId, taxTreatment, vatNumber: profile.vatNumber, taxStatus: profile.taxStatus },
      'Billing profile synced from Stripe',
    );

    return profile;
  } catch (error) {
    logger.warn(
      { shopId, error: error.message },
      'Failed to sync billing profile from Stripe',
    );
    return null;
  }
}

export default {
  getBillingProfile,
  upsertBillingProfile,
  syncBillingProfileFromStripe,
  validateBillingProfileForCheckout,
};
