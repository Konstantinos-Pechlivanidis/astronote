# Astronote Web Frontend

React frontend application for the Astronote SMS Marketing Platform.

## Tech Stack

- **Vite** - Build tool and dev server
- **React 18** - UI library
- **React Router** - Routing
- **React Query** - Data fetching and caching
- **Redux Toolkit** - State management (minimal: auth + UI)
- **TailwindCSS** - Styling
- **shadcn/ui** - UI components
- **Axios** - HTTP client
- **Recharts** - Charts for reports

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

From monorepo root:
```bash
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp apps/web/.env.example apps/web/.env.local
```

2. Update `.env.local` with your values:
```env
VITE_SHOPIFY_API_BASE_URL=http://localhost:3001
VITE_APP_URL=http://localhost:5173
```

### Development

From monorepo root:
```bash
npm run dev:web
```

Or from `apps/web`:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
apps/web/
├── src/
│   ├── api/              # Axios client configuration
│   ├── app/              # App providers and router
│   ├── components/        # React components
│   │   ├── common/       # Shared components
│   │   ├── dashboard/    # Dashboard-specific components
│   │   ├── layout/       # Layout components (AppShell)
│   │   └── ui/           # shadcn/ui components
│   ├── hooks/            # React Query hooks
│   ├── pages/            # Page components
│   ├── store/            # Redux store and slices
│   └── utils/            # Utility functions
├── public/               # Static assets
└── index.html            # HTML entry point
```

## Pages

- `/dashboard` - Main dashboard with reports widgets
- `/campaigns` - Campaign list
- `/campaigns/new` - Create new campaign
- `/contacts` - Contact management
- `/lists` - Audience segments
- `/automations` - Automation management
- `/templates` - Message templates (copy/paste)
- `/settings` - Settings and authentication

## Features

- **Dashboard with Reports**: Reports displayed as widgets (no separate /reports page)
- **Campaign Management**: Create, list, send campaigns
- **Contact Management**: List, search, import contacts
- **Automations**: List, toggle active/inactive, edit messages
- **Templates**: Copy/paste message templates
- **Authentication**: Token-based auth with Redux persistence

## API Integration

See `docs/frontend-endpoints-map.md` for complete endpoint mapping.

## Notes

- Reports are embedded in Dashboard (no `/reports` route)
- Templates are copy/paste only (no campaign association)
- Campaign creation supports placeholders: `{{firstName}}`, `{{lastName}}`, `{{discount}}`
