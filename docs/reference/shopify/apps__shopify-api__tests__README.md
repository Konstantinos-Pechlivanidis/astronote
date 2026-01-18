# Testing Guide

This directory contains tests for the Shopify automations implementation.

## Test Structure

- `unit/` - Unit tests for individual functions and services
- `integration/` - Integration tests for complete workflows
- `fixtures/` - Test data and mock responses

## Running Tests

To run tests, you'll need to install a testing framework. Recommended options:

### Option 1: Jest (Recommended)
```bash
npm install --save-dev jest @jest/globals
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "collectCoverageFrom": [
      "services/**/*.js",
      "controllers/**/*.js",
      "queue/**/*.js",
      "!**/node_modules/**"
    ]
  }
}
```

### Option 2: Mocha + Chai
```bash
npm install --save-dev mocha chai
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "mocha tests/**/*.test.js"
  }
}
```

## Test Environment

Tests should use a separate test database. Set up environment variables:

```env
NODE_ENV=test
DATABASE_URL=postgresql://user:password@localhost:5432/astronote_test
REDIS_URL=redis://localhost:6379/1
SKIP_QUEUES=true  # Skip queue processing in tests
```

## Test Coverage

Tests should cover:
- GraphQL query execution
- Template variable replacement
- Automation trigger conditions
- Job scheduling logic
- Webhook handlers
- Credit validation
- SMS consent checks

## Test Files

- `unit/shopify-graphql.test.js` - GraphQL service tests
- `unit/template-variables.test.js` - Template processing tests
- `unit/automation-variables.test.js` - Variable service tests
- `integration/automation-workflows.test.js` - End-to-end workflow tests
- `integration/job-scheduling.test.js` - Job scheduling tests

## Fixtures

- `fixtures/order-webhook.json` - Sample order webhook payload
- `fixtures/fulfillment-webhook.json` - Sample fulfillment webhook payload
