# FE Review (Shopify)

## Query Keys Inventory
- Campaigns list/detail/metrics/status/progress/preview/failed recipients: `shopifyQueryKeys.campaigns.*` in `apps/astronote-web/src/features/shopify/queryKeys.ts` used by hooks in `src/features/shopify/campaigns/hooks/useCampaigns.ts`, `useCampaign.ts`, `useCampaignMetrics.ts`.
- Billing summary/balance/history/invoices/profile/packages/topup calc: `shopifyQueryKeys.billing.*` in `src/features/shopify/queryKeys.ts` used by `src/features/shopify/billing/hooks/useBillingSummary.ts`, `useBillingBalance.ts`, `useBillingHistory.ts`, `useBillingInvoices.ts`, `useBillingProfile.ts`, `useBillingPackages.ts`, `useCalculateTopup.ts`.
- Subscription status: `shopifyQueryKeys.subscriptions.status()` in `src/features/shopify/billing/hooks/useSubscriptionStatus.ts`.
- Dashboard KPIs: `shopifyQueryKeys.dashboard.kpis()` in `src/features/shopify/dashboard/hooks/useDashboardKPIs.ts` (also reads billing summary key).

## Mutation → Invalidation Matrix
- Create campaign: invalidates campaigns root and dashboard (`useCreateCampaign`).
- Update campaign: invalidates campaigns root + specific detail (`useUpdateCampaign`).
- Delete campaign: invalidates campaigns root + dashboard (`useDeleteCampaign`).
- Enqueue/send campaign: invalidates campaigns root/detail/metrics/status/progress, billing balance/summary, dashboard (`useEnqueueCampaign`).
- Schedule campaign: invalidates campaigns root/detail/metrics/status/progress, campaign stats (`useScheduleCampaign`).
- Cancel campaign: invalidates campaigns root/detail/status/progress, dashboard (`useCancelCampaign`).
- Retry failed recipients: invalidates campaigns root/detail/metrics/status/progress/failedRecipients, dashboard (`useRetryFailedCampaign`).
- Billing topup/purchase: invalidates billing balance/summary/invoices/history roots (`useCreateTopup`, `useCreatePurchase`).
- Subscription update/switch/finalize/reconcile/cancel/resume/change/cancel scheduled: invalidate subscription status, billing summary/balance, invoices/history roots where applicable (`useSubscriptionMutations.ts`).

## Changes Made (minimal)
- Added conditional polling for campaign status/progress hooks so auto-refresh only while sending/queued (defaults to 5s).
- Ensured credit-affecting purchase mutation also invalidates billing balance/summary/invoices/history.

## What Was Stale / Why
- Status/progress hooks previously polled on a fixed interval even when idle, risking stale sends not refreshing promptly; now they poll only while active and stop otherwise.
- Purchase mutation didn’t refresh billing caches after checkout initiation; now key billing queries invalidate on success.

## Manual Verification Steps
1) Send a campaign and observe status/progress auto-refreshing while “sending”; confirm polling stops once status leaves sending.
2) After send, ensure campaigns list/detail metrics update (refetch via invalidations) and dashboard credits reflect debit.
3) Initiate a credit purchase/topup; verify billing balance/summary reload after redirect-complete callback (or next load).
4) Schedule a campaign; check detail/status shows “scheduled” without manual refresh.
5) Run `npm -w @astronote/web-next run lint` and `npm -w @astronote/web-next run build` to confirm no FE build regressions.
