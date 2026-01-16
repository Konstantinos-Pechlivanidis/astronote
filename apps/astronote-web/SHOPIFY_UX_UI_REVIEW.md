## Shopify UX/UI review (Shopify pages)

Date: 2026-01-16  
Scope: `apps/astronote-web` (Shopify pages only)  
**No backend functionality changes. NO COMMIT.**

### Pages reviewed
- **Create Campaign**: `/app/shopify/campaigns/new`
- **Settings**: `/app/shopify/settings`
- **Automations**: `/app/shopify/automations`, `/app/shopify/automations/[id]`
- **Templates**: `/app/shopify/templates`, `/app/shopify/templates/[id]`
- **Billing**: `/app/shopify/billing`

### 1) Logo removal (only on requested pages)
Removed the company logo from:
- **Create Campaign**
- **Settings**
- **Automations**
- **Templates**

Implementation detail:
- The Shopify shell logo (sidebar + mobile nav) is now route-aware: it hides the logo only for those route groups and shows a neutral “Shopify” label instead.
- Page headers on those pages no longer embed the `Logo` component in the title.

Logo remains unchanged on other areas (e.g. Shopify login, other Shopify routes like Edit Campaign).

### 2) UX/UI improvements (frontend-only)

#### Create Campaign
- **Sticky action bar on mobile**: primary actions remain visible while scrolling the form.
- **Message help**: clarified guidance copy and added preview tips inside the collapsible help card.

#### Settings
- **Quick guidance card**: adds “what this affects” context for sender/base URL at the top.
- Keeps existing responsive tab layout; no API behavior changes.

#### Automations
- Removed logo from header titles.
- Added a short inline note about unsubscribe appending + keeping messages short.

#### Templates
- Removed logo from header titles (list + detail).
- Added a **“Using templates”** guidance card.
- Improved toolbar responsiveness (search/filter/buttons stack cleanly on mobile).

#### Billing
- Added a **“How billing works”** card (subscription vs allowance vs wallet credits, invoices/portal guidance).

### Manual verification checklist
- **Logo**:
  - Confirm logo is **not visible** on: Create Campaign, Settings, Automations, Templates (including mobile nav header + desktop sidebar header).
  - Confirm logo is **still visible** on other routes where it previously existed (e.g. Shopify login, Edit Campaign).
- **Mobile responsiveness**:
  - Templates toolbar: stacks properly; no horizontal overflow.
  - Create Campaign action bar: remains visible and buttons are usable on small screens.
- **Accessibility**:
  - Mobile nav dialog still traps focus and closes via Escape.
  - Icon buttons retain aria labels (no regressions).

