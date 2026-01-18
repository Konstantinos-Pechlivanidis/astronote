# Billing Parity: Shopify vs Retail (Frontend/Headers Check)

## What Matches
- Shared billing surfaces: subscribe/switch, invoices list, billing summary/balance, credits refresh via React Query invalidations in `useEnqueueCampaign` and related hooks.
- Stripe checkout success flow handled in Shopify pages; UI shows invoices/history similar to retail.
- Axios client (`src/lib/shopify/api/axios.ts`) injects `Authorization: Bearer` and `X-Shopify-Shop-Domain` for all protected billing/subscription calls; skips public endpoints.
- Billing endpoints, status checks, and reconcile routes are wired through the shopify API client (base URL `SHOPIFY_API_BASE_URL`).

## Differences / Notes
- Shopify is tenant-header aware (`X-Shopify-Shop-Domain`); retail is ownerId-based. No drift found.
- No Shopify-specific purchase history UI beyond invoices; parity acceptable.
- No schema/API drift detected that blocks billing calls; no Prisma changes applied.

## Verification Checklist
- Confirm `.env` / config has `SHOPIFY_API_BASE_URL` and frontend can resolve shop domain (localStorage or embedded session token).
- Every billing/subscription request includes `Authorization` + `X-Shopify-Shop-Domain` (already enforced by interceptor).
- Invoices page: paginated fetch works under shop context.
- After sending a campaign, billing balance/summary queries invalidate (handled in `useEnqueueCampaign`).
- Success/return flows from checkout show updated subscription/credits after refetch.
