/**
 * Subscription Change Policy
 * Centralizes how plan/interval changes should be applied.
 */

const normalizePlan = (planCode) =>
  planCode ? String(planCode).toLowerCase() : null;

/**
 * Decide how a change should be applied.
 * @param {Object} current - Current subscription state
 * @param {Object} target - Target subscription state
 * @returns {'immediate' | 'checkout' | 'scheduled'}
 */
export function decideChangeMode(current, target) {
  const currentPlan = normalizePlan(current?.planCode || current?.planType);
  const targetPlan = normalizePlan(target?.planCode || target?.planType);

  if (!currentPlan || !targetPlan) {
    return 'immediate';
  }

  // 2-SKU unification policy:
  // - starter(monthly) -> pro(yearly): checkout now
  // - pro(yearly) -> starter(monthly): scheduled at period end
  // - same plan: no-op handled by callers (treated as immediate here)
  if (currentPlan === 'starter' && targetPlan === 'pro') {
    return 'checkout';
  }
  if (currentPlan === 'pro' && targetPlan === 'starter') {
    return 'scheduled';
  }

  return 'immediate';
}

export function isValidScheduledChange(current, pendingChange) {
  if (!pendingChange?.planCode) {
    return false;
  }

  const mode = decideChangeMode(current, {
    planCode: pendingChange.planCode,
    interval: pendingChange.interval,
  });

  return mode === 'scheduled';
}
