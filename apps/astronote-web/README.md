# Astronote Web - Next.js Frontend

Production-grade, iOS 26-inspired dark-mode web app for Astronote that unifies Retail and Shopify services.

## Features

- 🎨 Premium iOS 26-inspired dark mode UI with Tiffany Blue accent
- 🔐 Dual authentication: Retail (email/password) and Shopify (OAuth/embedded)
- 💰 Complete billing integration: subscriptions and credit packs
- 📊 ROI calculator with real-time projections
- 🌐 Marketing pages: landing, features, pricing, how-it-works
- ⚖️ Legal pages: Terms & Conditions, Privacy Policy (draft)
- 📱 Mobile-first, responsive design
- ♿ Accessibility: keyboard navigation, focus rings, ARIA labels

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS + CSS variables
- **UI Components:** Custom glass morphism components
- **State Management:** Zustand (for auth), React Query (for data)
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React
- **Notifications:** Sonner

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 8+

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your API URLs
NEXT_PUBLIC_RETAIL_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SHOPIFY_API_BASE_URL=http://localhost:3000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_RETAIL_API_BASE_URL` | Retail API base URL | `http://localhost:3001` |
| `NEXT_PUBLIC_SHOPIFY_API_BASE_URL` | Shopify API base URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_ENV` | App environment | `development` |

## Project Structure

```
apps/astronote-web/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Landing page
│   ├── auth/              # Authentication flows
│   │   ├── page.tsx       # Service chooser
│   │   ├── retail/        # Retail auth
│   │   └── shopify/        # Shopify auth
│   ├── app/               # Protected app area
│   │   ├── retail/        # Retail dashboard
│   │   └── shopify/       # Shopify dashboard
│   ├── pricing/           # Pricing page
│   ├── roi/               # ROI calculator
│   ├── features/          # Features page
│   ├── how-it-works/      # How it works
│   ├── security/          # Security/trust page
│   ├── terms/             # Terms & Conditions
│   ├── privacy/           # Privacy Policy
│   └── contact/           # Contact form
├── components/            # React components
│   ├── ui/               # UI primitives
│   ├── layout/           # Layout components
│   └── app/              # App-specific components
├── lib/                  # Utilities
│   └── api/              # API clients
│       ├── retailClient.ts
│       └── shopifyClient.ts
└── public/               # Static assets
```

## API Integration

### Retail API Client

Located in `lib/api/retailClient.ts`. Handles:
- Authentication (register, login, refresh, logout)
- Billing (balance, packages, transactions, purchase)
- Subscriptions (current, subscribe, cancel)

### Shopify API Client

Located in `lib/api/shopifyClient.ts`. Handles:
- Token exchange (Shopify session token → app token)
- OAuth flow initiation
- Billing (balance, packages, purchase)
- Subscriptions (status, subscribe, cancel)

## Routes

### Public Marketing
- `/` - Landing page
- `/features` - Features overview
- `/how-it-works` - 3-step guide
- `/pricing` - Subscription plans + credit packs
- `/roi` - ROI calculator
- `/security` - Trust/security page
- `/terms` - Terms & Conditions
- `/privacy` - Privacy Policy
- `/contact` - Contact form

### Authentication
- `/auth` - Service chooser (Retail vs Shopify)
- `/auth/retail/login` - Retail login
- `/auth/retail/register` - Retail registration
- `/auth/shopify/connect` - Shopify OAuth/embedded connect

### App (Protected)
- `/app/retail` - Retail dashboard
- `/app/retail/billing` - Retail billing
- `/app/shopify` - Shopify dashboard
- `/app/shopify/billing` - Shopify billing

## Design System

### Colors

- **Background:** Deep dark (#070A0F)
- **Surface:** Translucent glass with blur
- **Accent:** Tiffany Blue (#0ABAB5)
- **Text:** High contrast whites with opacity variants

### Components

- `GlassCard` - Frosted glass card with backdrop blur
- `Button` - Multiple variants (default, outline, ghost, glass)
- `Input` - Styled input with focus states

## Legal Pages

**Note:** Terms & Conditions and Privacy Policy pages are marked as "Draft – requires legal review". They include:
- Acceptable use policies
- Anti-spam compliance
- Consent requirements
- Account suspension/termination clauses
- Limitation of liability
- Data processing details
- User rights (GDPR)

These should be reviewed by legal counsel before production use.

## Screenshots Checklist

For client demo, capture screenshots of:
1. Landing page (hero + value props)
2. Pricing page (plans + credit packs)
3. ROI calculator (with sample data)
4. Features page
5. Auth service chooser
6. Retail login/register
7. Shopify connect
8. Dashboard (both services)
9. Billing page
10. Terms & Privacy pages

## License

ISC

