# Astronote - SMS Marketing Platform

<div align="center">

![Astronote Logo](https://via.placeholder.com/200x50/6366f1/ffffff?text=Astronote)

**Enterprise-grade SMS Marketing Platform for Shopify and Retail Businesses**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Deployment](#-deployment)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Monorepo Structure](#-monorepo-structure)
- [Quick Start](#-quick-start)
- [Development](#-development)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**Astronote** is a comprehensive SMS marketing platform designed for Shopify stores and retail businesses. It enables merchants to send targeted SMS campaigns, automate customer communications, and track engagement metrics.

### Key Capabilities

- **Multi-tenant Architecture**: Isolated data per Shopify store or retail business
- **Campaign Management**: Create, schedule, and track SMS campaigns
- **Automation**: Trigger-based SMS automations (order confirmations, abandoned carts, etc.)
- **Audience Segmentation**: Gender, age, and custom segment targeting
- **Analytics & Reporting**: Real-time delivery rates, click tracking, and conversion metrics
- **Credit System**: Flexible credit-based pricing with Stripe integration
- **URL Shortening**: Backend-driven link shortening with click tracking

---

## ✨ Features

### Core Features

- ✅ **Unified Frontend**: Single React app for both Shopify and Retail areas
- ✅ **Campaign Management**: Draft, schedule, and send SMS campaigns
- ✅ **Contact Management**: Import, segment, and manage customer contacts
- ✅ **Automation Workflows**: Event-triggered SMS automations
- ✅ **Template Library**: Reusable SMS message templates
- ✅ **Real-time Analytics**: Dashboard with embedded reports widgets
- ✅ **System Segments**: Pre-built gender and age-based segments
- ✅ **Click Tracking**: Track link clicks in SMS messages
- ✅ **Unsubscribe Management**: Compliant opt-out handling

### Production Features

- ✅ **Idempotency**: Prevent duplicate charges and sends
- ✅ **Rate Limiting**: Per-tenant rate limiting with Redis
- ✅ **Webhook Security**: HMAC signature verification
- ✅ **Transaction Safety**: Database transactions for critical operations
- ✅ **Queue Deduplication**: Prevent duplicate job processing
- ✅ **PII Redaction**: Safe logging with PII masking
- ✅ **Health Monitoring**: Comprehensive health check endpoints
- ✅ **Reconciliation Jobs**: Auto-recovery for stuck campaigns

---

## 🏗️ Architecture

### Monorepo Structure

```
astronote/
├── apps/
│   ├── web/                    # Unified React frontend
│   ├── shopify-api/            # Shopify backend API
│   ├── retail-api/             # Retail backend API
│   ├── retail-worker/           # Background job processor
│   ├── retail-web-legacy/      # Legacy retail frontend (deprecated)
│   └── astronote-shopify-extension/  # Shopify app extension
├── packages/                   # Shared packages (future)
├── docs/                       # Comprehensive documentation
└── scripts/                    # Utility scripts
```

### System Architecture

```
┌─────────────────┐
│   React Frontend │  (apps/web)
│  - Marketing     │
│  - Retail Area   │
│  - Shopify Area  │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Retail │ │Shopify│  Backend APIs
│  API  │ │  API  │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         │
    ┌────▼────┐
    │  Worker │  Background Jobs
    └────┬────┘
         │
    ┌────▼────┐
    │  Redis  │  Queue + Cache
    └────┬────┘
         │
    ┌────▼────┐
    │Postgres │  Database (Neon)
    └─────────┘
```

---

## 🛠️ Tech Stack

### Frontend (`apps/web`)

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Redux Toolkit** - State management (auth + UI prefs)
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - UI component library
- **Axios** - HTTP client
- **Recharts** - Data visualization

### Backend (`apps/shopify-api`, `apps/retail-api`)

- **Node.js 20.x** - Runtime
- **Express.js** - Web framework
- **Prisma** - ORM and database toolkit
- **PostgreSQL** (Neon) - Primary database
- **Redis** - Queue and caching
- **BullMQ** - Job queue management
- **JWT** - Authentication
- **Zod** - Schema validation

### Infrastructure

- **Render** - Hosting platform
- **Neon** - Serverless PostgreSQL
- **Redis Cloud** - Managed Redis
- **Stripe** - Payment processing
- **Mitto** - SMS provider
- **Shopify API** - E-commerce integration

---

## 📁 Monorepo Structure

### Applications

| Application | Description | Tech Stack |
|------------|-------------|------------|
| **`apps/web`** | Unified frontend (marketing + retail + shopify) | React, Vite, TailwindCSS |
| **`apps/shopify-api`** | Shopify backend API | Node.js, Express, Prisma |
| **`apps/retail-api`** | Retail backend API | Node.js, Express, Prisma |
| **`apps/retail-worker`** | Background job processor | Node.js, BullMQ |
| **`apps/retail-web-legacy`** | Legacy retail frontend (deprecated) | React, Vite |

### Workspaces

The monorepo uses **npm workspaces** for dependency management:

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### Key Directories

- **`docs/`** - Comprehensive documentation
  - `deploy/` - Deployment guides and checklists
  - `env/` - Environment variable documentation
  - `_audit/` - Architecture audits
- **`scripts/`** - Utility scripts
  - `smoke-prod.sh` - Production smoke tests
  - `verify-env.js` - Environment validation

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x (the repo engines require >=20 <21)
- **npm** >= 8.0.0
- **PostgreSQL** database (Neon recommended)
- **Redis** instance (Redis Cloud recommended)

If you have a newer Node (e.g., v24), use `nvm install 20` + `nvm use 20` to match the workspace engines.

### Installation

```bash
# Clone the repository
git clone https://github.com/Konstantinos-Pechlivanidis/astronote.git
cd astronote

# Install dependencies
npm install

# Copy environment files
cp apps/shopify-api/env.example apps/shopify-api/.env
cp apps/retail-api/.env.example apps/retail-api/.env
cp apps/web/.env.example apps/web/.env

# Set up environment variables (see docs/env/)
```

### Development

```bash
# Start all services in development mode
npm run dev

# Or start individually:
npm run dev:shopify    # Shopify API
npm run dev:retail     # Retail API
npm run dev:web        # Web frontend
```

### Database Setup

```bash
# Shopify API
cd apps/shopify-api
npm run prisma:generate
npm run prisma:migrate:dev

# Retail API
cd apps/retail-api
npm run prisma:generate
npm run prisma:migrate:dev
```

---

## 💻 Development

### Available Scripts

```bash
# Development
npm run dev              # Start all services
npm run dev:shopify      # Start Shopify API
npm run dev:retail       # Start Retail API
npm run dev:web          # Start web frontend

# Build
npm run build            # Build all services

# Code Quality
npm run lint             # Lint all workspaces
npm run lint:fix         # Fix linting issues
npm run format           # Check formatting
npm run format:write     # Format code

# Testing
npm run test             # Run all tests

# Verification
npm run check            # Lint + format + build
npm run verify:builds    # Verify build outputs
```

### Code Style

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **EditorConfig** - Editor configuration

### Git Workflow

1. Create a feature branch from `main`
2. Make changes and commit
3. Push and create a pull request
4. Code review and merge

---

## 🚢 Deployment

### Render Deployment

The platform is designed for deployment on **Render**. See comprehensive guides:

- **[Simple Deployment Guide (Greek)](docs/deploy/render/SIMPLE_DEPLOYMENT_GUIDE_GR.md)** - Step-by-step in Greek
- **[Go-Live Runbook](docs/deploy/render/go-live-runbook.md)** - Detailed deployment guide
- **[Quick Reference](docs/deploy/render/QUICK_REFERENCE.md)** - Build/start commands

### Services to Deploy

1. **Web Frontend** (`apps/web`)
   - Build: `npm ci && npm run build`
   - Start: `npm run start`

2. **Shopify API** (`apps/shopify-api`)
   - Build: `npm ci && npm run build`
   - Start: `npm run start`

3. **Retail API** (`apps/retail-api`)
   - Build: `npm ci`
   - Start: `npm run start`

4. **Retail Worker** (`apps/retail-worker`)
   - Build: `npm ci`
   - Start: `npm run start`

### Environment Variables

See environment variable checklists:

- [Web Frontend](docs/deploy/checklists/render-web-env.md)
- [Shopify API](docs/deploy/checklists/render-shopify-api-env.md)
- [Retail API](docs/deploy/checklists/render-retail-api-env.md)
- [Retail Worker](docs/deploy/checklists/render-retail-worker-env.md)

### Smoke Tests

After deployment, run smoke tests:

```bash
./scripts/smoke-prod.sh
./scripts/smoke-cors.sh
```

---

## 📚 Documentation

### Getting Started

- **[Simple Deployment Guide](docs/deploy/render/SIMPLE_DEPLOYMENT_GUIDE_GR.md)** - Deployment in Greek
- **[Environment Variables](docs/env/standard-keys.md)** - Env var reference
- **[API Endpoints](docs/api-inventory.md)** - API documentation

### Architecture

- **[Monorepo Structure](docs/monorepo-structure.md)** - Repository organization
- **[Frontend Architecture](docs/frontend-unified-map.md)** - Frontend routes and endpoints
- **[Backend Architecture](docs/_audit/repo-structure.md)** - Backend structure

### Deployment

- **[Go-Live Runbook](docs/deploy/render/go-live-runbook.md)** - Complete deployment guide
- **[Rollback Procedures](docs/deploy/rollback/rollback.md)** - How to rollback
- **[Smoke Tests](docs/deploy/smoke/smoke-matrix.md)** - Production verification

### Operations

- **[Observability](docs/deploy/smoke/observability.md)** - Logs and monitoring
- **[Production Hardening](docs/deploy/checklists/production-hardening.md)** - Security checklist

### Full Documentation Index

See [`docs/`](docs/) directory for complete documentation.

---

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Standards

- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

### Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Get code review approval
4. Merge to `main`

---

## 📄 License

This project is proprietary and confidential. All rights reserved.

**Copyright © 2025 Astronote. All rights reserved.**

---

## 🔗 Links

- **Repository**: [GitHub](https://github.com/Konstantinos-Pechlivanidis/astronote)
- **Documentation**: [`docs/`](docs/)
- **Issues**: [GitHub Issues](https://github.com/Konstantinos-Pechlivanidis/astronote/issues)

---

## 📞 Support

For support and questions:

- **Documentation**: Check [`docs/`](docs/) directory
- **Issues**: Open a GitHub issue
- **Email**: [Contact information]

---

<div align="center">

**Built with ❤️ by the Astronote Team**

[⬆ Back to Top](#astronote---sms-marketing-platform)

</div>
