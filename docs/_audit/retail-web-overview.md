# Retail Web Overview

## Overview

The `apps/retail-api/apps/web` frontend is a React application built with Vite, providing a complete dashboard for the retail SMS marketing platform.

## Tech Stack

- **Framework**: React 18.3
- **Build Tool**: Vite 5.4
- **Routing**: React Router 6.26
- **State Management**: 
  - React Query (@tanstack/react-query) for server state
  - Redux Toolkit for auth + UI state
- **Styling**: TailwindCSS
- **UI Components**: Custom components (no shadcn/ui)
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **Notifications**: Sonner

## Application Structure

### Entry Point
- `src/main.jsx` → `App.jsx` → `AppRouter`

### Routing (`src/app/router/`)

#### Public Routes
- `/` - Landing page
- `/signup` - Signup page
- `/login` - Login page
- `/o/:trackingId` - Offer redemption page
- `/unsubscribe` - Unsubscribe page
- `/resubscribe` - Resubscribe page
- `/nfc/:publicId` - NFC opt-in page
- `/c/:tagPublicId` - Conversion tag page
- `/link-expired` - Link expired page

#### Protected Routes (under `/app`)
- `/app/dashboard` - Dashboard
- `/app/campaigns` - Campaigns list
- `/app/campaigns/new` - Create campaign
- `/app/campaigns/:id` - Campaign details
- `/app/campaigns/:id/edit` - Edit campaign
- `/app/campaigns/:id/status` - Campaign status
- `/app/campaigns/:id/stats` - Campaign stats
- `/app/contacts` - Contacts list
- `/app/contacts/import` - Import contacts
- `/app/templates` - Templates
- `/app/billing` - Billing
- `/app/billing/success` - Billing success
- `/app/automations` - Automations
- `/app/settings` - Settings

## Features

### Authentication
- JWT-based authentication
- Refresh token in HTTP-only cookie
- Auto-refresh on token expiry
- Protected route guards

### Dashboard
- KPI widgets
- Campaign overview
- Recent activity

### Campaigns
- List campaigns with filtering
- Create campaigns
- Edit campaigns
- Schedule campaigns
- View campaign status
- View campaign stats
- Enqueue campaigns for sending

### Contacts
- List contacts with search/filter
- Create contacts
- Edit contacts
- Delete contacts
- Import contacts from CSV
- View contact details
- Birthday contacts

### Lists
- Create contact lists
- Filter by gender/age
- Add/remove contacts
- Sync lists

### Templates
- Browse system templates
- Create custom templates
- Edit templates
- Delete templates
- Render templates with placeholders
- View template stats

### Automations
- Welcome automation
- Birthday automation
- Enable/disable automations
- Edit automation messages
- View automation stats

### Billing
- View credit balance
- View subscription status
- Purchase credit packs
- Top-up credits
- View transaction history
- Manage subscription (Stripe portal)

## API Integration

### Base URL
- Configured via `VITE_API_BASE_URL` (default: `http://localhost:3001`)
- Vite proxy configured for `/api` → API server

### API Client (`src/api/axios.js`)
- Axios instance with base URL
- Request interceptor: Adds `Authorization: Bearer <token>`
- Response interceptor: Handles 401 (logout), 403, 500 errors
- Auto-refresh token on 401

### API Modules (`src/api/modules/`)
- `auth.js` - Authentication
- `campaigns.js` - Campaigns
- `contacts.js` - Contacts
- `lists.js` - Lists
- `templates.js` - Templates
- `automations.js` - Automations
- `billing.js` - Billing
- `subscriptions.js` - Subscriptions

## State Management

### React Query
- Server state caching
- Automatic refetching
- Optimistic updates
- Query invalidation

### Redux Toolkit
- `authSlice`: Access token, user info
- `uiSlice`: Sidebar collapsed, theme preferences
- Persisted to localStorage

## Environment Variables

### Required
- `VITE_API_BASE_URL`: Retail API base URL (default: `http://localhost:3001`)

### Development
- Vite automatically exposes `import.meta.env.DEV`
- Uses proxy for `/api` in development

## Build & Deployment

### Development
```bash
npm run dev
# Starts Vite dev server on port 5173
```

### Production Build
```bash
npm run build
# Outputs to `dist/` directory
```

### Preview
```bash
npm run preview
# Preview production build locally
```

## Notes

- Full-featured retail dashboard
- Complete implementation (not placeholder)
- Uses React Query for all server state
- Redux only for auth + minimal UI state
- TailwindCSS for styling
- No shadcn/ui (custom components)

