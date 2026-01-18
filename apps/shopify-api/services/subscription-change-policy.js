/**
 * Subscription Change Policy
 * Centralizes how plan/interval changes should be applied.
 */

const normalizePlan = (planCode) =>
  planCode ? String(planCode).toLowerCase() : null;

const normalizeInterval = (interval) => {
  if (!interval) return null;
  const v = String(interval).toLowerCase();
  return ['month', 'year'].includes(v) ? v : null;
};

const impliedInterval = (plan) => {
  if (plan === 'starter') return 'month';
  if (plan === 'pro') return 'year';
  return null;
};

/**
 * Decide how a change should be applied.
 * @param {Object} current - Current subscription state
 * @param {Object} target - Target subscription state
 * @returns {'immediate' | 'checkout' | 'scheduled'}
 */
export function decideChangeMode(current, target) {
  const currentPlan = normalizePlan(current?.planCode || current?.planType);
  const targetPlan = normalizePlan(target?.planCode || target?.planType);
  const currentInterval = normalizeInterval(
    current?.interval || impliedInterval(currentPlan),
  );
  const targetInterval = normalizeInterval(
    target?.interval || impliedInterval(targetPlan),
  );

  if (!currentPlan || !targetPlan) {
    return 'immediate';
  }

  if (currentInterval === 'month' && targetInterval === 'year') {
    return 'checkout';
  }

  if (currentInterval === 'year' && targetInterval === 'month') {
    return 'scheduled';
  }

  // 2-SKU unification policy:
  // - starter(monthly) -> pro(yearly): checkout now
  // - pro(yearly) -> starter(monthly): scheduled at period end
  // - same plan: no-op handled by callers (treated as immediate here)
  if (
    currentPlan === 'starter' &&
    targetPlan === 'pro' &&
    currentInterval === 'month' &&
    targetInterval === 'year'
  ) {
    return 'checkout';
  }
  if (
    currentPlan === 'pro' &&
    targetPlan === 'starter' &&
    currentInterval === 'year' &&
    targetInterval === 'month'
  ) {
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
