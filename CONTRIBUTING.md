# Contributing to Astronote

Thank you for your interest in contributing to Astronote! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a positive environment

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- PostgreSQL database
- Redis instance

### Getting Started

```bash
# Clone the repository
git clone https://github.com/Konstantinos-Pechlivanidis/astronote.git
cd astronote

# Install dependencies
npm install

# Set up environment variables
cp apps/shopify-api/env.example apps/shopify-api/.env
cp apps/retail-api/.env.example apps/retail-api/.env
cp apps/web/.env.example apps/web/.env

# Run database migrations
cd apps/shopify-api && npm run prisma:migrate:dev
cd ../retail-api && npm run prisma:migrate:dev
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Write clean, maintainable code
- Follow existing code style
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run linting
npm run lint

# Run formatting check
npm run format

# Run tests
npm run test

# Build all services
npm run build
```

### 4. Commit Your Changes

Use clear, descriptive commit messages:

```bash
git commit -m "feat: add new campaign scheduling feature"
git commit -m "fix: resolve CORS issue in retail API"
git commit -m "docs: update deployment guide"
```

**Commit Message Format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Code Standards

### JavaScript/TypeScript

- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful variable and function names
- Add JSDoc comments for public APIs

### React Components

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript for type safety (where applicable)

### Backend Code

- Follow Express.js best practices
- Use Prisma for database operations
- Implement proper error handling
- Add input validation with Zod

### Testing

- Write unit tests for utilities
- Write integration tests for API endpoints
- Test error cases and edge cases
- Maintain good test coverage

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] No console.logs or debug code
- [ ] Environment variables are documented

### PR Description

Include:
- **What** - Description of changes
- **Why** - Reason for the change
- **How** - Implementation details
- **Testing** - How to test the changes

### Review Process

1. Automated checks must pass (linting, tests)
2. Code review by maintainers
3. Address feedback
4. Approval and merge

## Project Structure

### Monorepo Organization

```
astronote/
├── apps/              # Applications
│   ├── web/          # Frontend
│   ├── shopify-api/  # Shopify backend
│   ├── retail-api/   # Retail backend
│   └── retail-worker/ # Background jobs
├── packages/         # Shared packages
├── docs/            # Documentation
└── scripts/         # Utility scripts
```

### Where to Make Changes

- **Frontend**: `apps/web/src/`
- **Shopify API**: `apps/shopify-api/`
- **Retail API**: `apps/retail-api/`
- **Documentation**: `docs/`

## Questions?

- Check existing documentation in `docs/`
- Open a GitHub issue for questions
- Contact maintainers for guidance

Thank you for contributing! 🎉

