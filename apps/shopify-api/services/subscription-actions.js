/**
 * Subscription Actions Service
 * Computes allowed actions for a subscription state (backend-driven action matrix)
 * This ensures frontend and backend agree on what actions are available
 */

import { listSupportedSkus } from './plan-catalog.js';

/**
 * Compute allowed actions for a subscription state
 * @param {Object} subscription - Subscription status DTO
 * @returns {Array<string>} List of allowed action IDs
 */
export function computeAllowedActions(subscription) {
  // No subscription
  // Accept either planCode (canonical) or planType (legacy) to avoid false "no subscription" states.
  if (!subscription.active || !(subscription.planCode || subscription.planType)) {
    return ['subscribe', 'viewPlans'];
  }

  const status = subscription.status || 'inactive';
  const cancelAtPeriodEnd = subscription.cancelAtPeriodEnd || false;
  const pendingChange = subscription.pendingChange;

  // Canceled subscription
  if (status === 'canceled' || status === 'cancelled') {
    return ['subscribe', 'viewInvoices'];
  }

  // Past due / Unpaid - urgent state
  if (status === 'past_due' || status === 'unpaid') {
    return ['updatePaymentMethod', 'refreshFromStripe', 'viewInvoices'];
  }

  // Active/Trialing subscription
  if (status === 'active' || status === 'trialing') {
    // If cancelAtPeriodEnd is true, show resume option
    if (cancelAtPeriodEnd) {
      return [
        'resumeSubscription',
        'updatePaymentMethod',
        'viewInvoices',
        'refreshFromStripe',
      ];
    }

    // If pending change exists, allow modifying scheduled plan
    if (pendingChange) {
      return [
        'changePlan',
        'cancelScheduledChange',
        'updatePaymentMethod',
        'viewInvoices',
        'refreshFromStripe',
      ];
    }

    // Normal active state - all actions available
    const actions = [
      'changePlan',
      'cancelAtPeriodEnd',
      'updatePaymentMethod',
      'viewInvoices',
      'refreshFromStripe',
    ];

    // Billing v2 alignment (2 SKUs):
    // Allow "switchInterval" as a shortcut between the two SKUs:
    // - starter/month -> pro/year (interval=year)
    // - pro/year -> starter/month (interval=month, scheduled)
    const planCode = subscription.planCode || subscription.planType;
    const currency = (subscription.currency || 'EUR').toUpperCase();
    const supported = listSupportedSkus(currency);
    const hasStarterMonth = supported.some((s) => s.planCode === 'starter' && s.interval === 'month');
    const hasProYear = supported.some((s) => s.planCode === 'pro' && s.interval === 'year');
    if ((planCode === 'starter' && hasProYear) || (planCode === 'pro' && hasStarterMonth)) {
      actions.splice(1, 0, 'switchInterval');
    }

    return actions;
  }

  // Incomplete/Incomplete Expired
  if (status === 'incomplete' || status === 'incomplete_expired') {
    return ['updatePaymentMethod', 'viewInvoices', 'refreshFromStripe'];
  }

  // Default: minimal actions
  return ['viewInvoices', 'refreshFromStripe'];
}

/**
 * Check if a specific action is allowed for a subscription state
 * @param {Object} subscription - Subscription status DTO
 * @param {string} actionId - Action ID to check
 * @returns {boolean} True if action is allowed
 */
export function isActionAllowed(subscription, actionId) {
  const allowedActions = computeAllowedActions(subscription);
  return allowedActions.includes(actionId);
}

