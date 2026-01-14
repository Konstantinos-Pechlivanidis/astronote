## Shopify Campaign Status Drift Map (Prisma ↔ Backend ↔ Frontend)

Scope: Shopify only  
Repos scanned:
- Backend: `apps/shopify-api`
- Frontend (Shopify pages only): `apps/astronote-web/app/app/shopify/campaigns/*` + `apps/astronote-web/src/lib/shopify/*`

---

## Authoritative status source (today)

### Prisma enum (backend DB truth)

Source: `apps/shopify-api/prisma/schema.prisma`

`CampaignStatus`:
- `draft`
- `scheduled`
- `sending`
- `paused`
- `completed`
- `sent` (**legacy alias** for completed)
- `failed`
- `cancelled`

---

## Drift summary (what disagrees today)

### Backend (API) status drift

Source: `apps/shopify-api/controllers/campaigns.js`

- **Allowed query filter list** is hardcoded and incomplete:
  - Allows: `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled`
  - **Missing**: `paused`, `completed`

Source: `apps/shopify-api/services/campaignAggregates.js` and `apps/shopify-api/services/delivery-status.js`

- **Final status selection** still uses `CampaignStatus.sent` when a campaign completes (legacy), despite the schema documenting `completed` as the modern terminal status.

Source: `apps/shopify-api/utils/dto-mappers.js`

- DTO currently returns `status: campaign.status` without normalization:
  - If DB stores `sent`, API returns `sent` (legacy leaks through).

### Frontend (Shopify) status drift

Source: `apps/astronote-web/src/lib/shopify/api/campaigns.ts`
- TS union includes: `draft`, `scheduled`, `sending`, `paused`, `completed`, `sent`, `failed`, `cancelled`

Source: `apps/astronote-web/src/lib/shopifyCampaignsApi.ts`
- TS union includes: `draft`, `scheduled`, `sending`, `paused`, `completed`, `sent`, `failed`, `cancelled`
- **Filter union** (`CampaignFilterStatus`) excludes:
  - `paused`, `completed` (but UI still offers these filters)

Source: `apps/astronote-web/src/lib/shopify/api/schemas.ts`
- Zod schema validates `status` as:
  - `draft`, `scheduled`, `sending`, `sent`, `failed`, `cancelled`
  - **Missing**: `paused`, `completed`

Impact:
- Runtime response parsing can fail or fallback when backend returns `paused`/`completed`, causing UI drift and/or silent downgrade to “raw” data handling.

---

## Status-by-status matrix (exists vs missing)

Legend:
- ✅ = present/handled
- ❌ = missing/unhandled
- ⚠️ = present but legacy / inconsistent semantics

| Status | Prisma enum | Backend filter allowlist | Backend finalization uses it | Backend DTO returns it | FE TS unions | FE Zod validation |
|---|---:|---:|---:|---:|---:|---:|
| `draft` | ✅ | ✅ | ✅ (start state) | ✅ | ✅ | ✅ |
| `scheduled` | ✅ | ✅ | ✅ (scheduled send state) | ✅ | ✅ | ✅ |
| `sending` | ✅ | ✅ | ✅ (active state) | ✅ | ✅ | ✅ |
| `paused` | ✅ | ❌ | ✅ (exists) | ✅ (if stored) | ✅ | ❌ |
| `completed` | ✅ | ❌ | ❌ (uses legacy `sent` instead) | ✅ (if stored) | ✅ | ❌ |
| `sent` (legacy) | ✅ | ✅ | ✅ (used as terminal success) ⚠️ | ✅ ⚠️ | ✅ ⚠️ | ✅ ⚠️ |
| `failed` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `cancelled` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Canonicalization target (what we will enforce)

- **Single canonical API status** returned to FE:  
  - Prefer `completed` over legacy `sent`.
  - Still accept `sent` in DB and inputs for backward compatibility.
- **Single shared status list** (one source of truth):
  - Backend owns canonical list.
  - Frontend imports a generated mirror file to avoid duplicating strings.
- **All layers match**:
  - Prisma enum ⟂ Backend constants ⟂ Backend DTO ⟂ FE constants ⟂ FE Zod schema ⟂ FE UI filters/badges.


