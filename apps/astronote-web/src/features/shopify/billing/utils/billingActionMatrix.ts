import type { SubscriptionStatus } from '@/src/lib/shopifyBillingApi';

/**
 * Billing UI State Model
 * Derived from backend /subscriptions/status DTO (Stripe-derived)
 */
export interface BillingUIState {
  hasSubscription: boolean;
  status: 'none' | 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired';
  cancelAtPeriodEnd: boolean;
  currentPlanCode: 'starter' | 'pro' | null;
  currentInterval: 'month' | 'year' | null;
  pendingChange: {
    planCode: string;
    interval: 'month' | 'year';
    currency: string;
    effectiveAt: string;
  } | null;
  requiresPaymentForChange: boolean;
  effectiveDates: {
    renewalDate: string | null;
    cancelEffectiveDate: string | null;
    pendingEffectiveDate: string | null;
  };
  currency: string;
  currentPeriodEnd: string | null;
}

/**
 * Available Action Types
 */
export type BillingActionId =
  | 'subscribe'
  | 'changePlan'
  | 'switchInterval'
  | 'cancelScheduledChange'
  | 'cancelAtPeriodEnd'
  | 'resumeSubscription'
  | 'updatePaymentMethod'
  | 'refreshFromStripe'
  | 'viewInvoices'
  | 'viewPlans';

export interface BillingAction {
  id: BillingActionId;
  label: string;
  intent: 'primary' | 'secondary' | 'danger' | 'ghost';
  endpoint?: string;
  confirmationCopy?: string;
  disabledReason?: string;
  requiresConfirmation?: boolean;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'link';
}

/**
 * Plan ranking for upgrade/downgrade logic (must match backend)
 */
const PLAN_RANK = {
  starter: 1,
  pro: 2,
} as const;

/**
 * Derive UI state from backend subscription status DTO
 */
export function deriveUIState(subscription: SubscriptionStatus | null | undefined): BillingUIState {
  if (!subscription || !subscription.active) {
    return {
      hasSubscription: false,
      status: 'none',
      cancelAtPeriodEnd: false,
      currentPlanCode: null,
      currentInterval: null,
      pendingChange: null,
      requiresPaymentForChange: false,
      effectiveDates: {
        renewalDate: null,
        cancelEffectiveDate: null,
        pendingEffectiveDate: null,
      },
      currency: subscription?.currency || 'EUR',
      currentPeriodEnd: null,
    };
  }

  const status = subscription.status || 'active';
  const cancelAtPeriodEnd = subscription.cancelAtPeriodEnd || false;
  const currentPlanCode = (subscription.planCode || subscription.planType) as 'starter' | 'pro' | null;
  const currentInterval = subscription.interval || null;
  const pendingChange = subscription.pendingChange || null;

  return {
    hasSubscription: true,
    status: status as BillingUIState['status'],
    cancelAtPeriodEnd,
    currentPlanCode,
    currentInterval,
    pendingChange: pendingChange
      ? {
        planCode: pendingChange.planCode || '',
        interval: pendingChange.interval || 'month',
        currency: pendingChange.currency || subscription.currency || 'EUR',
        effectiveAt: pendingChange.effectiveAt || subscription.currentPeriodEnd || '',
      }
      : null,
    requiresPaymentForChange: currentInterval === 'month', // Month→Year requires payment
    effectiveDates: {
      renewalDate: subscription.currentPeriodEnd || null,
      cancelEffectiveDate: cancelAtPeriodEnd ? subscription.currentPeriodEnd || null : null,
      pendingEffectiveDate: pendingChange?.effectiveAt || null,
    },
    currency: subscription.currency || 'EUR',
    currentPeriodEnd: subscription.currentPeriodEnd || null,
  };
}

/**
 * Get available actions for a given UI state
 * Prefers backend-computed allowedActions if provided, otherwise computes locally
 * This ensures frontend and backend agree on what actions are available
 */
export function getAvailableActions(
  uiState: BillingUIState,
  backendAllowedActions?: string[],
): BillingAction[] {
  // If backend provided allowedActions, use them as the source of truth
  // This prevents frontend/backend drift
  if (backendAllowedActions && backendAllowedActions.length > 0) {
    return getAllActionsForState(uiState).filter((action) =>
      backendAllowedActions.includes(action.id),
    );
  }

  // Otherwise, compute locally (fallback for backward compatibility)
  return getAllActionsForState(uiState);
}

/**
 * Get all possible actions for a UI state (local computation)
 * Used as fallback when backend doesn't provide allowedActions
 */
function getAllActionsForState(uiState: BillingUIState): BillingAction[] {
  const actions: BillingAction[] = [];

  // No subscription
  if (!uiState.hasSubscription || uiState.status === 'none') {
    actions.push(
      {
        id: 'subscribe',
        label: 'Subscribe',
        intent: 'primary',
        variant: 'default',
        requiresConfirmation: false,
      },
      {
        id: 'viewPlans',
        label: 'View Plans',
        intent: 'secondary',
        variant: 'outline',
        requiresConfirmation: false,
      },
    );
    return actions;
  }

  // Canceled subscription
  if (uiState.status === 'canceled') {
    actions.push(
      {
        id: 'subscribe',
        label: 'Subscribe Again',
        intent: 'primary',
        variant: 'default',
        requiresConfirmation: false,
      },
      {
        id: 'viewInvoices',
        label: 'View Invoices',
        intent: 'secondary',
        variant: 'outline',
        requiresConfirmation: false,
      },
    );
    return actions;
  }

  // Past due / Unpaid - urgent state
  if (uiState.status === 'past_due' || uiState.status === 'unpaid') {
    actions.push(
      {
        id: 'updatePaymentMethod',
        label: 'Update Payment Method',
        intent: 'primary',
        variant: 'default',
        confirmationCopy: 'You will be redirected to Stripe to update your payment method.',
        requiresConfirmation: true,
      },
      {
        id: 'refreshFromStripe',
        label: 'Refresh Status',
        intent: 'secondary',
        variant: 'outline',
        requiresConfirmation: false,
      },
      {
        id: 'viewInvoices',
        label: 'View Invoices',
        intent: 'secondary',
        variant: 'outline',
        requiresConfirmation: false,
      },
    );
    return actions;
  }

  // Active/Trialing subscription
  if (uiState.status === 'active' || uiState.status === 'trialing') {
    // If cancelAtPeriodEnd is true, show resume option
    if (uiState.cancelAtPeriodEnd) {
      const cancelDate = uiState.effectiveDates.cancelEffectiveDate
        ? new Date(uiState.effectiveDates.cancelEffectiveDate).toLocaleDateString()
        : 'end of term';

      actions.push(
        {
          id: 'resumeSubscription',
          label: 'Resume Subscription',
          intent: 'primary',
          variant: 'default',
          confirmationCopy: `Your subscription will continue. You'll keep access until ${cancelDate}.`,
          requiresConfirmation: true,
        },
        {
          id: 'updatePaymentMethod',
          label: 'Manage Payment Method',
          intent: 'secondary',
          variant: 'outline',
          requiresConfirmation: false,
        },
        {
          id: 'viewInvoices',
          label: 'View Invoices',
          intent: 'secondary',
          variant: 'outline',
          requiresConfirmation: false,
        },
        {
          id: 'refreshFromStripe',
          label: 'Refresh Status',
          intent: 'ghost',
          variant: 'ghost',
          requiresConfirmation: false,
        },
      );
      return actions;
    }

    // If pending change exists, show scheduled change info
    if (uiState.pendingChange) {
      const effectiveDate = uiState.pendingChange.effectiveAt
        ? new Date(uiState.pendingChange.effectiveAt).toLocaleDateString()
        : 'end of term';

      actions.push(
        {
          id: 'changePlan',
          label: 'Change Scheduled Plan',
          intent: 'secondary',
          variant: 'outline',
          confirmationCopy: `You have a scheduled change to ${uiState.pendingChange.planCode} (${uiState.pendingChange.interval}ly) on ${effectiveDate}. You can modify this change.`,
          requiresConfirmation: true,
        },
        {
          id: 'cancelScheduledChange',
          label: 'Cancel Scheduled Change',
          intent: 'danger',
          variant: 'outline',
          confirmationCopy: `This will cancel your scheduled change and keep your current plan. (Effective date was ${effectiveDate}.)`,
          requiresConfirmation: true,
        },
        {
          id: 'updatePaymentMethod',
          label: 'Manage Payment Method',
          intent: 'secondary',
          variant: 'outline',
          requiresConfirmation: false,
        },
        {
          id: 'viewInvoices',
          label: 'View Invoices',
          intent: 'secondary',
          variant: 'outline',
          requiresConfirmation: false,
        },
        {
          id: 'refreshFromStripe',
          label: 'Refresh Status',
          intent: 'ghost',
          variant: 'ghost',
          requiresConfirmation: false,
        },
      );
      return actions;
    }

    // Normal active state - show all available actions
    actions.push(
      {
        id: 'changePlan',
        label: 'Change Plan',
        intent: 'secondary',
        variant: 'outline',
        requiresConfirmation: false,
      },
      {
        id: 'switchInterval',
        label: uiState.currentInterval === 'month' ? 'Switch to Yearly' : 'Switch to Monthly',
        intent: 'secondary',
        variant: 'outline',
        confirmationCopy:
          uiState.currentInterval === 'month'
            ? 'You will be charged for the yearly plan today. Changes apply immediately.'
            : 'Your billing interval will change to monthly. Changes apply immediately.',
        requiresConfirmation: true,
      },
      {
        id: 'cancelAtPeriodEnd',
        label: 'Cancel Subscription',
        intent: 'danger',
        variant: 'outline',
        confirmationCopy: uiState.effectiveDates.renewalDate
          ? `You'll keep access until ${new Date(uiState.effectiveDates.renewalDate).toLocaleDateString()}. You can resume anytime before then.`
          : "You'll keep access until the end of your billing period. You can resume anytime before then.",
        requiresConfirmation: true,
      },
      {
        id: 'updatePaymentMethod',
        label: 'Manage Payment Method',
        intent: 'secondary',
        variant: 'outline',
        requiresConfirmation: false,
      },
      {
        id: 'viewInvoices',
        label: 'View Invoices',
        intent: 'secondary',
        variant: 'outline',
        requiresConfirmation: false,
      },
      {
        id: 'refreshFromStripe',
        label: 'Refresh Status',
        intent: 'ghost',
        variant: 'ghost',
        requiresConfirmation: false,
      },
    );
  }

  return actions;
}

/**
 * Get action label for a specific plan change
 */
export function getPlanActionLabel(
  uiState: BillingUIState,
  targetPlanCode: 'starter' | 'pro',
  targetInterval: 'month' | 'year',
): string {
  if (!uiState.hasSubscription || !uiState.currentPlanCode) {
    return 'Subscribe';
  }

  const currentRank = PLAN_RANK[uiState.currentPlanCode] || 0;
  const targetRank = PLAN_RANK[targetPlanCode] || 0;

  // Different plan
  if (currentRank !== targetRank) {
    return currentRank < targetRank ? 'Upgrade' : 'Downgrade';
  }

  // Same plan, different interval
  if (uiState.currentInterval !== targetInterval) {
    return targetInterval === 'year' ? 'Switch to Yearly' : 'Switch to Monthly';
  }

  // Same plan and interval
  return 'Current Plan';
}

/**
 * Get "what happens" message for a plan option
 */
export function getPlanChangeMessage(
  uiState: BillingUIState,
  targetPlanCode: 'starter' | 'pro',
  _targetInterval: 'month' | 'year',
): string {
  if (!uiState.hasSubscription || !uiState.currentPlanCode) {
    return 'Takes effect immediately';
  }

  const currentRank = PLAN_RANK[uiState.currentPlanCode] || 0;
  const targetRank = PLAN_RANK[targetPlanCode] || 0;
  const isDowngrade = currentRank > targetRank;
  const isProYearlyDowngrade =
    uiState.currentPlanCode === 'pro' && uiState.currentInterval === 'year' && isDowngrade;

  if (isProYearlyDowngrade) {
    const effectiveDate = uiState.currentPeriodEnd
      ? new Date(uiState.currentPeriodEnd).toLocaleDateString()
      : 'end of term';
    return `Scheduled for end of term (${effectiveDate})`;
  }

  return 'Takes effect immediately';
}

/**
 * Check if an action should be disabled
 */
export function isActionDisabled(
  actionId: BillingActionId,
  uiState: BillingUIState,
  targetPlanCode?: 'starter' | 'pro',
  targetInterval?: 'month' | 'year',
): { disabled: boolean; reason?: string } {
  // Past due/unpaid - disable plan changes
  if ((uiState.status === 'past_due' || uiState.status === 'unpaid') && actionId === 'changePlan') {
    return {
      disabled: true,
      reason: 'Please update your payment method before making plan changes.',
    };
  }

  // If pending change exists, disable conflicting changes
  if (uiState.pendingChange && actionId === 'changePlan') {
    if (
      targetPlanCode === uiState.pendingChange.planCode &&
      targetInterval === uiState.pendingChange.interval
    ) {
      return {
        disabled: true,
        reason: 'This change is already scheduled.',
      };
    }
  }

  if (!uiState.pendingChange && actionId === 'cancelScheduledChange') {
    return {
      disabled: true,
      reason: 'No scheduled change to cancel.',
    };
  }

  // If cancelAtPeriodEnd, disable cancel action
  if (uiState.cancelAtPeriodEnd && actionId === 'cancelAtPeriodEnd') {
    return {
      disabled: true,
      reason: 'Subscription is already scheduled to cancel.',
    };
  }

  return { disabled: false };
}

