# Shopify Worker - Fix Applied

## Problem Found

The `shopify-worker` was missing **dependencies** in its `package.json`, while `retail-worker` had them.

## Fix Applied

Added required dependencies to `apps/shopify-worker/package.json`:

```json
{
  "dependencies": {
    "@prisma/client": "^6.17.1",
    "bullmq": "^4.15.4",
    "ioredis": "^5.3.2",
    "dotenv": "^16.3.1"
  }
}
```

## Why These Dependencies?

1. **`bullmq`** - Required for BullMQ workers (queue processing)
2. **`ioredis`** - Required by BullMQ for Redis connections
3. **`@prisma/client`** - Required for database access (Prisma ORM)
4. **`dotenv`** - Used by `loadEnv` for environment variable loading

## Comparison

### Retail Worker
- ✅ Has explicit dependencies: `bullmq`, `ioredis`, `pino`, `dotenv`
- ✅ Uses CommonJS (`require`)
- ✅ Standalone worker implementation

### Shopify Worker (Before Fix)
- ❌ **Missing dependencies** in `package.json`
- ✅ Uses ESM (`import`)
- ✅ Shares code with `shopify-api` via relative imports

### Shopify Worker (After Fix)
- ✅ **Has dependencies**: `bullmq`, `ioredis`, `@prisma/client`, `dotenv`
- ✅ Uses ESM (`import`)
- ✅ Shares code with `shopify-api` via relative imports

## Next Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma client (if not already done):**
   ```bash
   cd apps/shopify-api
   npm run prisma:generate
   ```

3. **Start Redis (if not running):**
   ```bash
   brew services start redis
   # or
   docker run -d -p 6379:6379 redis:latest
   ```

4. **Run the worker:**
   ```bash
   cd apps/shopify-worker
   npm run dev
   ```

## Files Modified

- ✅ `apps/shopify-worker/package.json` - Added dependencies
- ✅ `apps/shopify-worker/DEPENDENCIES.md` - Created documentation

## Status

✅ **FIXED** - Dependencies added to `shopify-worker/package.json`

The worker should now run correctly after:
1. Running `npm install` (to install new dependencies)
2. Ensuring Redis is running
3. Ensuring Prisma client is generated

