-- Add lastBillingError and extend SubscriptionStatus enum for Shopify billing parity
--
-- IMPORTANT: PostgreSQL lowercases unquoted identifiers, so we must use quoted type names
-- when checking for enum existence. Using 'SubscriptionStatus'::regtype would look for
-- 'subscriptionstatus' (lowercase), but the actual type is "SubscriptionStatus" (quoted).
-- We use to_regtype('public."SubscriptionStatus"') to properly check for the quoted type.

-- Add lastBillingError column (idempotent)
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "lastBillingError" VARCHAR(255);

-- Ensure SubscriptionStatus enum type exists (idempotent)
-- This handles the case where the enum doesn't exist yet (fresh DB)
DO $$
BEGIN
  IF to_regtype('public."SubscriptionStatus"') IS NULL THEN
    -- Create enum with all values (original + new ones)
    CREATE TYPE public."SubscriptionStatus" AS ENUM (
      'active',
      'inactive',
      'cancelled',
      'trialing',
      'past_due',
      'unpaid',
      'incomplete',
      'paused'
    );
  END IF;
END $$;

-- Add enum values only if they don't exist (idempotent)
-- This handles the case where enum exists but values are missing
-- We join pg_enum with pg_type and pg_namespace to properly check for existing labels

-- Add 'trialing' if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'SubscriptionStatus'
      AND e.enumlabel = 'trialing'
  ) THEN
    ALTER TYPE public."SubscriptionStatus" ADD VALUE 'trialing';
  END IF;
END $$;

-- Add 'past_due' if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'SubscriptionStatus'
      AND e.enumlabel = 'past_due'
  ) THEN
    ALTER TYPE public."SubscriptionStatus" ADD VALUE 'past_due';
  END IF;
END $$;

-- Add 'unpaid' if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'SubscriptionStatus'
      AND e.enumlabel = 'unpaid'
  ) THEN
    ALTER TYPE public."SubscriptionStatus" ADD VALUE 'unpaid';
  END IF;
END $$;

-- Add 'incomplete' if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'SubscriptionStatus'
      AND e.enumlabel = 'incomplete'
  ) THEN
    ALTER TYPE public."SubscriptionStatus" ADD VALUE 'incomplete';
  END IF;
END $$;

-- Add 'paused' if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'SubscriptionStatus'
      AND e.enumlabel = 'paused'
  ) THEN
    ALTER TYPE public."SubscriptionStatus" ADD VALUE 'paused';
  END IF;
END $$;
