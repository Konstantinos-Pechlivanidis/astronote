/**
 * Subscription Change Policy
 * Centralizes how plan/interval changes should be applied.
 */

const normalizePlan = (planCode) =>
  planCode ? String(planCode).toLowerCase() : null;
const normalizeInterval = (interval) =>
  interval ? String(interval).toLowerCase() : null;

/**
 * Decide how a change should be applied.
 * @param {Object} current - Current subscription state
 * @param {Object} target - Target subscription state
 * @returns {'immediate' | 'checkout' | 'scheduled'}
 */
export function decideChangeMode(current, target) {
  const currentPlan = normalizePlan(current?.planCode || current?.planType);
  const currentInterval = normalizeInterval(current?.interval);
  const targetPlan = normalizePlan(target?.planCode || target?.planType);
  const targetInterval = normalizeInterval(target?.interval);

  if (!currentPlan || !currentInterval || !targetPlan) {
    return 'immediate';
  }

  const isProYearlyDowngrade =
    currentPlan === 'pro' &&
    currentInterval === 'year' &&
    targetPlan === 'starter';

  if (isProYearlyDowngrade) {
    return 'scheduled';
  }

  const isMonthToYear = currentInterval === 'month' && targetInterval === 'year';
  if (isMonthToYear) {
    return 'checkout';
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
