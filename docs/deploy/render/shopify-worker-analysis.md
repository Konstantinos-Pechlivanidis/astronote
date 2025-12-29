# Shopify Worker - Complete Analysis

## Date
2025-01-23

## Problem

The `shopify-worker` fails to start with `ECONNREFUSED` errors, even after adding dependencies. Need to compare with `retail-worker` to identify missing implementation.

---

## Architecture Comparison

### Retail Worker (Working)

**Structure:**
- Standalone worker file: `apps/retail-worker/src/sms.worker.js`
- Uses CommonJS (`require`)
- Direct imports from `retail-api/src/`
- Simple error handling

**Dependencies:**
- `dotenv` - env loading
- `pino` - logging (standalone)
- `bullmq` - queue system
- `ioredis` - Redis client

**Env Loading:**
```javascript
require('dotenv').config(); // Simple, direct
```

**Redis Connection:**
```javascript
const connection = getRedisClient();
if (!connection) {
  logger.warn('Redis client could not be created, SMS worker disabled');
  process.exit(0);
}
// With lazyConnect: true, Redis connects on first command
logger.info('Starting SMS worker (Redis will connect on first use)...');
```

**Error Handling:**
- Checks if Redis client exists
- Exits gracefully if Redis unavailable
- No immediate connection attempt

---

### Shopify Worker (Current - Not Working)

**Structure:**
- Entry point: `apps/shopify-worker/index.js`
- Uses ESM (`import`)
- Imports from `shopify-api/` (shared code)
- Complex dependency chain

**Dependencies:**
- `@prisma/client` - database
- `bullmq` - queue system
- `ioredis` - Redis client
- `dotenv` - env loading

**Env Loading:**
```javascript
import loadEnv from '../shopify-api/config/loadEnv.js';
loadEnv(); // Complex, loads from multiple .env files
```

**Redis Connection:**
```javascript
const { queueRedis } = await import('../shopify-api/config/redis.js');
// Tries to ping immediately (causes ECONNREFUSED)
await queueRedis.ping(); // REMOVED - but still getting errors
```

**Error Handling:**
- Imports Redis config
- Logs configuration
- No graceful exit if Redis unavailable

---

## Key Differences

| Aspect | Retail Worker | Shopify Worker |
|--------|--------------|----------------|
| **Module System** | CommonJS | ESM |
| **Logger** | Pino (standalone) | Custom logger (from shopify-api) |
| **Env Loading** | Simple `dotenv.config()` | Complex `loadEnv()` with priority |
| **Redis Check** | Checks if client exists, exits if null | Imports config, tries to use |
| **Error Handling** | Graceful exit if Redis unavailable | Continues even if Redis fails |
| **Dependencies** | Minimal (4 deps) | Minimal (4 deps) but imports complex modules |

---

## Root Cause Analysis

### Issue 1: Complex Import Chain

**Shopify Worker imports:**
1. `loadEnv` → loads .env files
2. `logger` → needs `pii-redaction.js` → needs `fs`, `path`, `crypto` (OK - built-in)
3. `validateAndLogEnvironment` → needs `logger` → circular dependency risk
4. `closeRedisConnections` → needs `logger`, `queueRedis`
5. `scheduler.js` → needs `logger`, `prisma`, `queue/index.js`
6. `event-poller.js` → needs `logger`, `prisma`, `queue/index.js`, services
7. `queue/worker.js` → needs `logger`, `queueRedis`, all job handlers

**Retail Worker imports:**
1. `dotenv.config()` → simple
2. `pino` → standalone logger
3. `getRedisClient()` → simple function
4. `prisma` → direct require
5. Services → direct requires

### Issue 2: Missing Dependencies

**Shopify Worker needs (via imports):**
- All dependencies from `shopify-api` (via workspace hoisting)
- But some may not be hoisted correctly

**Retail Worker:**
- Has explicit dependencies
- Uses direct requires (no hoisting issues)

### Issue 3: Error Handling

**Shopify Worker:**
- No graceful exit if Redis unavailable
- Continues even if imports fail
- Errors propagate to BullMQ

**Retail Worker:**
- Graceful exit if Redis unavailable
- Simple error handling
- Clear error messages

---

## Solution: Make Shopify Worker Standalone

### Option 1: Simplify Imports (Recommended)

Make `shopify-worker` more like `retail-worker`:
- Use simple logger (pino or console)
- Use simple env loading (dotenv)
- Remove complex validation
- Add graceful error handling

### Option 2: Add All Dependencies

Add all dependencies from `shopify-api` to `shopify-worker`:
- This defeats the purpose of code sharing
- Increases bundle size
- More maintenance

### Option 3: Keep Current Structure but Fix Errors

- Remove immediate Redis ping
- Add graceful error handling
- Ensure all dependencies are available

---

## Recommended Fix

Make `shopify-worker` standalone like `retail-worker`:

1. **Simplify logger:** Use pino (like retail-worker)
2. **Simplify env loading:** Use dotenv directly
3. **Add graceful error handling:** Exit if Redis unavailable
4. **Remove complex validation:** Keep it simple
5. **Ensure dependencies:** Add missing packages

---

## Next Steps

1. Analyze what's actually failing
2. Simplify the worker entry point
3. Add missing dependencies
4. Test standalone execution

