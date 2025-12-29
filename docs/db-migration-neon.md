# Database Migration to Neon (Postgres)

**Date**: 2025-01-XX  
**Purpose**: Switch backend database from current Postgres to Neon Postgres  
**Status**: ✅ **SCHEMA UPDATED** - Ready for migration execution

---

## Summary

The Prisma schema and environment configuration have been updated to support Neon Postgres with connection pooling. The migration requires setting up Neon database credentials and running Prisma migrations.

---

## Files Changed

### 1. `prisma/schema.prisma`

**Change**: Added `directUrl` to datasource configuration

**Before**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**After**:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Reason**: Neon requires separate URLs for pooled connections (application) and direct connections (migrations). The `directUrl` is used by Prisma migrations to bypass the connection pooler.

### 2. `env.example`

**Change**: Updated database configuration section with Neon-specific format and documentation

**Before**:
```bash
# Database Configuration
# For high-volume operations (500k+ SMS/day), add connection pooling parameters:
# ?connection_limit=100&pool_timeout=20
DATABASE_URL=postgresql://username:password@host:port/database?connection_limit=100&pool_timeout=20
DIRECT_URL=postgresql://username:password@host:port/database?connection_limit=100&pool_timeout=20
```

**After**:
```bash
# Database Configuration (Neon Postgres)
# DATABASE_URL: Neon pooled connection (use for application connections)
# Format: postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
# DIRECT_URL: Neon direct connection (use for migrations, bypasses pooler)
# Format: postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
DIRECT_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
```

**Reason**: 
- Neon uses different connection endpoints for pooled vs direct connections
- Neon requires `sslmode=require` for secure connections
- Updated documentation to reflect Neon-specific format

---

## Environment Variables

### Required Variables

1. **`DATABASE_URL`**: Neon pooled connection URL
   - Format: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require`
   - Used for: Application database connections (via Prisma Client)
   - Source: Neon dashboard → Connection String → Pooled connection

2. **`DIRECT_URL`**: Neon direct connection URL
   - Format: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require`
   - Used for: Prisma migrations (bypasses connection pooler)
   - Source: Neon dashboard → Connection String → Direct connection

### How to Get Neon Connection Strings

1. Log in to [Neon Console](https://console.neon.tech)
2. Select your project
3. Go to "Connection Details" or "Connection String"
4. Copy:
   - **Pooled connection** → Use for `DATABASE_URL`
   - **Direct connection** → Use for `DIRECT_URL`

**Note**: Both URLs should include `?sslmode=require` for secure connections.

---

## Migration Steps

### Step 1: Sanity Checks

Run these commands to verify environment:

```bash
# Check Node.js version (should be >= 18.0.0)
node -v

# Install dependencies (if not already done)
npm ci
# OR
npm install

# Check Prisma version
npx prisma -v

# Validate Prisma schema
npx prisma validate

# Generate Prisma Client
npx prisma generate
```

**Expected Results**:
- ✅ Node.js v18+ installed
- ✅ Dependencies installed successfully
- ✅ Prisma CLI available
- ✅ Schema validation passes
- ✅ Prisma Client generated

### Step 2: Configure Environment Variables

1. **Create or update `.env` file** (copy from `.env.example`):

```bash
# Copy example file
cp env.example .env
```

2. **Update `.env` with Neon credentials**:

```bash
# Replace with your Neon connection strings
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
DIRECT_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
```

**Important**: 
- Use **pooled connection** for `DATABASE_URL`
- Use **direct connection** for `DIRECT_URL`
- Both must include `?sslmode=require`

### Step 3: Apply Migrations

Since `prisma/migrations/` directory exists with migration files, use `prisma migrate deploy`:

```bash
# Apply all migrations to Neon database
npx prisma migrate deploy
```

**Expected Output**:
```
Applying migration `20241201000000_init`
Applying migration `20241201000002_baseline`
Applying migration `20241201000003_add_delivery_tracking`
Applying migration `20241220000000_add_subscriptions_and_credit_transactions`
Applying migration `20250101000000_add_packages_and_purchases`
Applying migration `20250120000000_add_template_statistics`
Applying migration `20250121000000_add_unique_constraint_campaign_recipient`
Applying migration `20250122000000_add_priority_and_click_tracking`
All migrations have been successfully applied.
```

### Step 4: Verify Migration Status

```bash
# Check migration status
npx prisma migrate status
```

**Expected Output**:
```
Database schema is up to date!
```

### Step 5: Optional - Reset Database (Development Only)

**⚠️ WARNING**: This will delete all data. Only use for development/testing.

```bash
# Reset database and apply all migrations
npx prisma migrate reset --force
```

This command will:
1. Drop the database
2. Create a new database
3. Apply all migrations
4. Run seed scripts (if configured)

### Step 6: Post-Migration Verification

#### Option A: Prisma Studio

```bash
# Open Prisma Studio to view database
npx prisma studio
```

This will open a browser at `http://localhost:5555` where you can:
- View all tables
- Verify data structure
- Check that migrations were applied correctly

#### Option B: Health Check Endpoint

1. **Start the backend server**:

```bash
npm run dev
# OR
npm start
```

2. **Test database connectivity**:

```bash
# Test health endpoint
curl http://localhost:8080/health/full
```

**Expected Response**:
```json
{
  "ok": true,
  "checks": {
    "db": {
      "status": "healthy",
      "responseTime": "5ms"
    },
    ...
  }
}
```

#### Option C: Direct Database Query

Create a test script `scripts/test-db-connection.js`:

```javascript
import prisma from '../services/prisma.js';

async function testConnection() {
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');

    // Test table existence
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('✅ Tables found:', tables.map(t => t.table_name));

    // Test Shop model
    const shopCount = await prisma.shop.count();
    console.log(`✅ Shop table accessible (${shopCount} records)`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

Run it:
```bash
node scripts/test-db-connection.js
```

---

## Migration Files

The following migrations will be applied (in order):

1. `20241201000000_init` - Initial schema
2. `20241201000002_baseline` - Baseline schema
3. `20241201000003_add_delivery_tracking` - Delivery tracking tables
4. `20241220000000_add_subscriptions_and_credit_transactions` - Subscriptions and credit transactions
5. `20250101000000_add_packages_and_purchases` - Packages and purchases
6. `20250120000000_add_template_statistics` - Template statistics
7. `20250121000000_add_unique_constraint_campaign_recipient` - Unique constraint on campaign recipients
8. `20250122000000_add_priority_and_click_tracking` - Priority and click tracking

---

## Issues and Fixes

### Issue 1: Schema Validation

**Status**: ✅ **RESOLVED**

**Problem**: Schema needed `directUrl` for Neon support

**Fix**: Added `directUrl = env("DIRECT_URL")` to `prisma/schema.prisma`

### Issue 2: Environment Variable Format

**Status**: ✅ **RESOLVED**

**Problem**: `env.example` had generic Postgres format, not Neon-specific

**Fix**: Updated `env.example` with Neon connection string format and documentation

### Issue 3: SSL Mode

**Status**: ⚠️ **REQUIRES ATTENTION**

**Problem**: Neon requires `sslmode=require` in connection strings

**Solution**: 
- Connection strings in `.env` must include `?sslmode=require`
- Neon dashboard provides connection strings with SSL already configured
- If connection fails, verify SSL mode is included

### Issue 4: Connection Pooler vs Direct

**Status**: ✅ **DOCUMENTED**

**Problem**: Neon uses different endpoints for pooled vs direct connections

**Solution**:
- `DATABASE_URL` uses pooled connection (for application)
- `DIRECT_URL` uses direct connection (for migrations)
- Both are required and must be configured separately

---

## Code Changes Summary

### Files Modified

1. **`prisma/schema.prisma`**
   - Added `directUrl = env("DIRECT_URL")` to datasource

2. **`env.example`**
   - Updated database configuration section
   - Added Neon-specific format and documentation
   - Removed generic connection pooling parameters (Neon handles this)

### Files Not Changed (But Should Be Reviewed)

1. **`services/prisma.js`**
   - Currently checks for 'pooler' in `DATABASE_URL`
   - Neon uses `ep-` prefix for endpoints (e.g., `ep-xxx-xxx.region.aws.neon.tech`)
   - **Status**: ✅ **NO CHANGES NEEDED**
   - **Reason**: The pooler check is optional. If it doesn't match, Prisma uses default configuration, which works fine with Neon's automatic connection pooling. Neon handles pooling at the infrastructure level, so no special Prisma configuration is required.

2. **`config/env-validation.js`**
   - Already validates `DATABASE_URL` as required
   - `DIRECT_URL` is optional (but recommended for Neon)

---

## Post-Migration Checklist

- [ ] Schema updated with `directUrl`
- [ ] `.env` file configured with Neon credentials
- [ ] `DATABASE_URL` uses Neon pooled connection
- [ ] `DIRECT_URL` uses Neon direct connection
- [ ] Both URLs include `?sslmode=require`
- [ ] Prisma schema validated (`npx prisma validate`)
- [ ] Prisma Client generated (`npx prisma generate`)
- [ ] Migrations applied (`npx prisma migrate deploy`)
- [ ] Migration status verified (`npx prisma migrate status`)
- [ ] Database connectivity tested (health endpoint or test script)
- [ ] Tables verified (Prisma Studio or direct query)

---

## Neon-Specific Considerations

### Connection Pooling

- **Neon handles connection pooling automatically** for pooled connections
- No need to add `?connection_limit=100&pool_timeout=20` parameters
- Pooled connection is optimized for high-concurrency application use

### Direct Connections

- **Direct connections bypass the pooler** and connect directly to the database
- Required for migrations and schema operations
- Use only for administrative operations, not application queries

### SSL/TLS

- **Neon requires SSL connections** (`sslmode=require`)
- Connection strings from Neon dashboard include SSL configuration
- If using custom connection strings, ensure `?sslmode=require` is included

### Branching (Neon Feature)

- Neon supports database branching (like Git branches)
- Each branch has its own connection strings
- Use main branch for production, create branches for development/testing

---

## Rollback Plan

If migration fails or issues occur:

1. **Keep old database credentials** in a backup `.env.old` file
2. **Revert schema changes** (remove `directUrl` from `prisma/schema.prisma`)
3. **Update `.env`** with old database credentials
4. **Regenerate Prisma Client**: `npx prisma generate`
5. **Test connectivity** to old database

**Note**: Data loss is acceptable per requirements, so rollback is primarily for configuration issues.

---

## Next Steps

1. ✅ Schema updated
2. ⏳ Set up Neon database and get connection strings
3. ⏳ Update `.env` with Neon credentials
4. ⏳ Run migration commands (see Step 3 above)
5. ⏳ Verify database connectivity
6. ⏳ Update production environment variables
7. ⏳ Deploy to production

---

## References

- [Neon Documentation](https://neon.tech/docs)
- [Prisma Migrate Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Neon Connection Strings](https://neon.tech/docs/connect/connection-string)

---

## Commands Reference

```bash
# Validate schema
npx prisma validate

# Generate Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (dev only, deletes all data)
npx prisma migrate reset --force

# Open Prisma Studio
npx prisma studio

# Test database connection
node scripts/test-db-connection.js
```

---

**Migration Status**: ✅ **READY FOR EXECUTION**

All schema changes are complete. Proceed with setting up Neon database and running migration commands.

