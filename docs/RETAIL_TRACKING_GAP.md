# Retail Tracking & ROI Gap Analysis

## Overview

This document analyzes what exists in the backend for tracking/ROI features and what the legacy UI exposes.

---

## Backend Endpoints (from docs/RETAIL_API_USAGE.md)

### Campaign Tracking
- ✅ `GET /api/campaigns/:id/stats` - Campaign statistics (implemented)
- ✅ `GET /api/campaigns/:id/status` - Campaign status with metrics (hook created, not yet used in UI)
- ✅ `GET /api/campaigns/:id/preview` - Message preview (implemented)

### Template Tracking
- ✅ `GET /api/templates/:id/stats` - Template statistics (endpoint exists)
- ⏳ Not yet implemented in UI

### Public Tracking
- ✅ `GET /tracking/offer/:trackingId` - Offer landing (implemented)
- ✅ `GET /tracking/redeem/:trackingId` - Redemption status (implemented)

---

## Legacy UI Analysis

### What Legacy Has

**Campaign Detail Page:**
- Shows campaign stats (total, sent, failed, conversions, unsubscribes)
- Has "View Stats" button that navigates to `/app/campaigns/:id/stats`
- Stats page shows 4 KPI cards (Total Messages, Sent, Conversions, Unsubscribes)

**Campaign Status Page:**
- Shows real-time progress (queued, sent, failed, processed)
- Polls status every 3 seconds while sending
- Shows scheduled/started/finished dates

**No Dedicated Tracking/ROI Pages:**
- Legacy does NOT have:
  - `/app/tracking` page
  - `/app/reports` page
  - `/app/roi` page
  - Global tracking dashboard
  - Link performance tracking UI
  - Copy tracking link functionality

---

## What's Implemented in astronote-web

### ✅ Implemented
- Campaign stats page (`/app/retail/campaigns/[id]/stats`)
- Campaign status polling (hook created, can be used in status page)
- Public offer/redeem pages
- Campaign detail with stats display

### ⏳ Not Implemented (Legacy doesn't have these either)
- Global tracking dashboard
- Link performance tracking
- Copy tracking link UI
- Template stats UI
- ROI calculator (marketing has one, but not in retail app)

---

## Recommendation

### Minimal MVP for Next Iteration

**Option 1: Campaign Status Page** (High Priority)
- Create `/app/retail/campaigns/[id]/status` page
- Use `useCampaignStatus` hook (already created)
- Show real-time progress with polling
- Display metrics: queued, sent, failed, processed
- Show scheduled/started/finished dates
- **Why**: Legacy has this, it's useful for monitoring active campaigns

**Option 2: Template Stats** (Medium Priority)
- Add stats display to template detail page (if template detail page exists)
- Use `GET /api/templates/:id/stats` endpoint
- Show usage count, performance metrics
- **Why**: Endpoint exists, but legacy doesn't expose it prominently

**Option 3: Global Tracking Dashboard** (Low Priority - New Feature)
- Create `/app/retail/tracking` page
- Aggregate stats across all campaigns
- Show top-performing campaigns
- Show link click tracking (if backend supports it)
- **Why**: Would be useful, but not in legacy - new feature

---

## Conclusion

**Current Status**: 
- ✅ All tracking features that exist in legacy are implemented
- ⏳ Campaign status page exists in legacy but not yet implemented in astronote-web (hook ready)
- ❌ No global tracking/ROI dashboard in legacy (would be new feature)

**Next Step**: Implement Campaign Status Page (`/app/retail/campaigns/[id]/status`) to match legacy.

---

## Implementation Notes

If implementing Campaign Status Page:
- Use `useCampaignStatus` hook (already created)
- Poll every 3 seconds while `status === 'sending'` or scheduled within 1 hour
- Display `CampaignProgressCard` component (can be created based on legacy)
- Show metrics: queued, success, processed, failed
- Show progress bars for sent/processed percentages
- Show scheduled/started/finished dates

**Reference**: 
- `apps/retail-web-legacy/src/features/campaigns/pages/CampaignStatusPage.jsx`
- `apps/retail-web-legacy/src/features/campaigns/components/CampaignProgressCard.jsx`
- `apps/retail-web-legacy/src/features/campaigns/hooks/useCampaignStatus.js`

