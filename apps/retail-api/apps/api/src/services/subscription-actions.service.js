// apps/api/src/services/subscription-actions.service.js
// Backend-driven subscription action matrix (Shopify parity).

const planCatalog = require('./plan-catalog.service');

function computeAllowedActions(subscription) {
  const status = subscription?.status || 'inactive';
  const active = Boolean(subscription?.active);
  const cancelAtPeriodEnd = Boolean(subscription?.cancelAtPeriodEnd);
  const pendingChange = subscription?.pendingChange || null;

  // No active subscription
  if (!active) {
    return ['subscribe', 'viewPlans'];
  }

  // Past due / unpaid / incomplete
  if (status === 'past_due' || status === 'unpaid') {
    return ['updatePaymentMethod', 'refreshFromStripe', 'viewInvoices'];
  }
  if (status === 'incomplete' || status === 'incomplete_expired') {
    return ['updatePaymentMethod', 'refreshFromStripe', 'viewInvoices'];
  }

  // Active / trialing
  if (status === 'active' || status === 'trialing') {
    const actions = [
      'changePlan',
      'switchInterval',
      'cancelAtPeriodEnd',
      'updatePaymentMethod',
      'viewInvoices',
      'refreshFromStripe',
    ];

    // If subscription is set to cancel at period end, expose resume.
    if (cancelAtPeriodEnd) {
      return [
        'resumeSubscription',
        'updatePaymentMethod',
        'viewInvoices',
        'refreshFromStripe',
      ];
    }

    // If pending change exists, allow modifying/canceling scheduled change.
    if (pendingChange) {
      return [
        'changePlan',
        'cancelScheduledChange',
        'cancelAtPeriodEnd',
        'updatePaymentMethod',
        'viewInvoices',
        'refreshFromStripe',
      ];
    }

    return actions;
  }

  // Cancelled / inactive fallback
  if (status === 'cancelled' || status === 'canceled' || status === 'inactive') {
    return ['subscribe', 'viewInvoices', 'refreshFromStripe'];
  }

  return ['refreshFromStripe', 'viewInvoices'];
}

function getAvailableOptions(subscription) {
  const currency = (subscription?.billingCurrency || subscription?.currency || 'EUR').toUpperCase();
  return planCatalog.listSupportedSkus(currency).map((s) => ({
    planCode: s.planCode,
    interval: s.interval,
    currency: s.currency,
  }));
}

module.exports = {
  computeAllowedActions,
  getAvailableOptions,
};
