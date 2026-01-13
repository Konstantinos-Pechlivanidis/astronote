/**
 * Subscription Actions Service
 * Computes allowed actions for a subscription state (backend-driven action matrix)
 * This ensures frontend and backend agree on what actions are available
 */

/**
 * Compute allowed actions for a subscription state
 * @param {Object} subscription - Subscription status DTO
 * @returns {Array<string>} List of allowed action IDs
 */
export function computeAllowedActions(subscription) {
  // No subscription
  if (!subscription.active || !subscription.planCode) {
    return ['subscribe', 'viewPlans', 'completeBillingDetails'];
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
        'updatePaymentMethod',
        'viewInvoices',
        'refreshFromStripe',
      ];
    }

    // Normal active state - all actions available
    return [
      'changePlan',
      'switchInterval',
      'cancelAtPeriodEnd',
      'updatePaymentMethod',
      'viewInvoices',
      'refreshFromStripe',
    ];
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

