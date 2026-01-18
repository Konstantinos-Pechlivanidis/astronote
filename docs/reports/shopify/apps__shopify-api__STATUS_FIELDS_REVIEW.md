# Status Fields Review: ScheduledAutomation, AutomationSequence, AutomationLog

**Date:** 2025-01-20  
**Purpose:** Review status field consistency and consider enum implementation

---

## Executive Summary

This review analyzes the status fields in three automation-related models:
- `ScheduledAutomation.status`
- `AutomationSequence.status`
- `AutomationLog.status`

**Findings:**
- ✅ **AutomationSequence**: Fully consistent, all status values used correctly
- ✅ **AutomationLog**: Fully consistent, all status values used correctly
- ⚠️ **ScheduledAutomation**: Schema documents 4 status values, but code only uses 2

**Recommendations:**
1. Add enum constants for automation statuses (similar to `CampaignStatus`)
2. Fix missing status updates in `ScheduledAutomation` (add 'executed' and 'failed' tracking)
3. Consider Prisma enums for future refactoring (requires migration)

---

## 1. ScheduledAutomation.status

### Schema Definition
```prisma
status String @default("scheduled") // scheduled, cancelled, executed, failed
```

### Documented Values
- `scheduled` - Automation is scheduled to run
- `cancelled` - Automation was cancelled
- `executed` - Automation has been executed
- `failed` - Automation execution failed

### Current Code Usage

#### ✅ Used Values
- `'scheduled'` - Set when creating scheduled automation
  - **Location:** `services/automation-scheduler.js:49`
  - **Usage:** Default status when scheduling

- `'cancelled'` - Set when cancelling automation
  - **Location:** `services/automation-scheduler.js:124`
  - **Usage:** When job is cancelled via `cancelScheduledAutomation()`

#### ❌ Missing Values
- `'executed'` - **NOT SET ANYWHERE**
  - **Issue:** When automation job completes successfully, status remains 'scheduled'
  - **Impact:** Cannot distinguish between pending and completed automations
  - **Recommendation:** Update status to 'executed' when job completes successfully

- `'failed'` - **NOT SET ANYWHERE**
  - **Issue:** When automation job fails, status remains 'scheduled'
  - **Impact:** Cannot track failed automations in ScheduledAutomation table
  - **Recommendation:** Update status to 'failed' when job fails

### Code Locations
- **Creation:** `services/automation-scheduler.js:49` - Sets `status: 'scheduled'`
- **Cancellation:** `services/automation-scheduler.js:124` - Sets `status: 'cancelled'`
- **Execution:** `queue/jobs/automationTriggers.js` - **MISSING** status update on completion/failure

### Issues Identified

1. **Missing Status Updates on Job Completion**
   - When automation job completes in `queue/jobs/automationTriggers.js`, the `ScheduledAutomation` record is not updated
   - Status remains 'scheduled' even after execution
   - Should update to 'executed' on success or 'failed' on error

2. **No Tracking of Execution State**
   - `executedAt` field exists but is never set
   - Cannot query for executed automations
   - Cannot distinguish between pending and completed automations

### Recommendations

#### Immediate Fix (Code Changes)
1. **Update status on job completion:**
   ```javascript
   // In queue/jobs/automationTriggers.js, after successful execution:
   await prisma.scheduledAutomation.updateMany({
     where: { jobId: job.id },
     data: {
       status: 'executed',
       executedAt: new Date(),
     },
   });
   ```

2. **Update status on job failure:**
   ```javascript
   // In queue/jobs/automationTriggers.js, in catch block:
   await prisma.scheduledAutomation.updateMany({
     where: { jobId: job.id },
     data: {
       status: 'failed',
     },
   });
   ```

#### Future Enhancement (Enum Constants)
Add to `utils/prismaEnums.js`:
```javascript
export const ScheduledAutomationStatus = {
  scheduled: 'scheduled',
  cancelled: 'cancelled',
  executed: 'executed',
  failed: 'failed',
};
```

---

## 2. AutomationSequence.status

### Schema Definition
```prisma
status String @default("active") // active, completed, cancelled
```

### Documented Values
- `active` - Sequence is currently active
- `completed` - Sequence has completed all steps
- `cancelled` - Sequence was cancelled

### Current Code Usage

#### ✅ All Values Used Correctly

- `'active'` - Set when creating sequence
  - **Locations:**
    - `services/post-purchase-series.js:27, 57, 199`
    - `services/welcome-series.js:21, 63, 163, 253`
    - `services/win-back.js:112, 185, 250`
  - **Usage:** Default status when creating new sequence

- `'completed'` - Set when sequence finishes
  - **Location:** `services/welcome-series.js:281`
  - **Usage:** When all steps in sequence are completed

- `'cancelled'` - Set when sequence is cancelled
  - **Locations:**
    - `services/post-purchase-series.js:230`
    - `services/welcome-series.js:187`
  - **Usage:** When sequence is cancelled (e.g., customer purchased)

### Code Locations
- **Creation:** Multiple services set `status: 'active'`
- **Completion:** `services/welcome-series.js:281` - Sets `status: 'completed'`
- **Cancellation:** Multiple services set `status: 'cancelled'`

### Status: ✅ **CONSISTENT**

All documented status values are used correctly in the codebase.

### Recommendations

#### Future Enhancement (Enum Constants)
Add to `utils/prismaEnums.js`:
```javascript
export const AutomationSequenceStatus = {
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
};
```

---

## 3. AutomationLog.status

### Schema Definition
```prisma
status String // 'sent', 'skipped', 'failed'
```

### Documented Values
- `sent` - Automation message was sent successfully
- `skipped` - Automation was skipped (e.g., insufficient credits)
- `failed` - Automation failed to send

### Current Code Usage

#### ✅ All Values Used Correctly

- `'sent'` - Set when message is sent successfully
  - **Locations:**
    - `services/automations.js:128` - After successful SMS send
    - `services/automations.js:802` - Birthday automation success
  - **Usage:** When automation message is successfully sent

- `'skipped'` - Set when automation is skipped
  - **Locations:**
    - `services/credit-validation.js:196` - When credits insufficient
    - `services/automations.js:781` - Birthday automation skipped
  - **Usage:** When automation cannot be executed (e.g., no credits, no active automation)

- `'failed'` - Set when automation fails
  - **Locations:**
    - `services/automations.js:815, 829` - Birthday automation failures
  - **Usage:** When automation execution fails

### Code Locations
- **Success:** `services/automations.js:128, 802` - Sets `status: 'sent'`
- **Skip:** `services/credit-validation.js:196`, `services/automations.js:781` - Sets `status: 'skipped'`
- **Failure:** `services/automations.js:815, 829` - Sets `status: 'failed'`

### Status: ✅ **CONSISTENT**

All documented status values are used correctly in the codebase.

### Recommendations

#### Future Enhancement (Enum Constants)
Add to `utils/prismaEnums.js`:
```javascript
export const AutomationLogStatus = {
  sent: 'sent',
  skipped: 'skipped',
  failed: 'failed',
};
```

---

## 4. Comparison with Existing Enum Pattern

### Current Pattern (CampaignStatus)
The codebase already uses enum constants for `CampaignStatus`:
```javascript
// utils/prismaEnums.js
export const CampaignStatus = {
  draft: 'draft',
  scheduled: 'scheduled',
  sending: 'sending',
  sent: 'sent',
  failed: 'failed',
  cancelled: 'cancelled',
};
```

### Benefits of Enum Constants
1. **Type Safety:** Prevents typos in status strings
2. **Consistency:** Centralized definition of valid values
3. **Refactoring:** Easy to find all usages
4. **Documentation:** Self-documenting code

### Recommendation
Follow the same pattern for automation statuses:
- `ScheduledAutomationStatus`
- `AutomationSequenceStatus`
- `AutomationLogStatus`

---

## 5. Prisma Enums vs String Types

### Current Implementation: String Types
All three models use `String` types for status fields:
```prisma
status String @default("scheduled")
```

### Prisma Enum Alternative
Could be converted to Prisma enums:
```prisma
enum ScheduledAutomationStatus {
  scheduled
  cancelled
  executed
  failed
}

model ScheduledAutomation {
  status ScheduledAutomationStatus @default(scheduled)
}
```

### Pros and Cons

#### Prisma Enums (Pros)
- ✅ Database-level validation
- ✅ Type safety at Prisma level
- ✅ Better IDE autocomplete
- ✅ Prevents invalid values at DB level

#### Prisma Enums (Cons)
- ❌ Requires migration to convert existing data
- ❌ Less flexible for future status values
- ❌ Harder to add new values (requires migration)
- ❌ Current String approach allows flexibility

### Recommendation
**Keep String types for now**, but add enum constants in JavaScript:
- Maintains flexibility for future status values
- Provides type safety in code without database migration
- Follows existing pattern (CampaignStatus uses constants, not Prisma enum)

**Future Consideration:** If status values become stable and unlikely to change, consider migrating to Prisma enums for database-level validation.

---

## 6. Action Items

### Immediate (Required)
1. ✅ **Fix ScheduledAutomation status updates**
   - Add status update to 'executed' on successful job completion
   - Add status update to 'failed' on job failure
   - Set `executedAt` timestamp when status becomes 'executed'
   - **Files to modify:**
     - `queue/jobs/automationTriggers.js` - Add status updates in all trigger handlers

### Short-term (Recommended)
2. ✅ **Add enum constants**
   - Add `ScheduledAutomationStatus` to `utils/prismaEnums.js`
   - Add `AutomationSequenceStatus` to `utils/prismaEnums.js`
   - Add `AutomationLogStatus` to `utils/prismaEnums.js`
   - Update code to use constants instead of string literals

### Long-term (Optional)
3. ⚠️ **Consider Prisma enums**
   - Evaluate if status values are stable
   - If yes, create migration to convert String → Enum
   - Requires careful migration planning

---

## 7. Implementation Plan

### Step 1: Fix ScheduledAutomation Status Updates

**File:** `queue/jobs/automationTriggers.js`

Add status updates to all trigger handlers:

```javascript
// After successful execution (in each handler):
try {
  const result = await triggerXxx({ ... });
  
  if (result.success) {
    // Update ScheduledAutomation status
    await prisma.scheduledAutomation.updateMany({
      where: { jobId: job.id },
      data: {
        status: 'executed',
        executedAt: new Date(),
      },
    });
  } else {
    // Update to failed if automation returned failure
    await prisma.scheduledAutomation.updateMany({
      where: { jobId: job.id },
      data: {
        status: 'failed',
      },
    });
  }
  
  return result;
} catch (error) {
  // Update to failed on exception
  await prisma.scheduledAutomation.updateMany({
    where: { jobId: job.id },
    data: {
      status: 'failed',
    },
  });
  throw error;
}
```

**Affected Handlers:**
- `handleAbandonedCartTrigger`
- `handleOrderConfirmationTrigger`
- `handleOrderFulfilledTrigger`
- `handleCustomerReengagementTrigger`
- `handleBirthdayTrigger`
- `handleWelcomeTrigger`
- `handleReviewRequestTrigger`
- `handleCrossSellTrigger`

### Step 2: Add Enum Constants

**File:** `utils/prismaEnums.js`

Add new enum constants:
```javascript
// Automation status enums
export const ScheduledAutomationStatus = {
  scheduled: 'scheduled',
  cancelled: 'cancelled',
  executed: 'executed',
  failed: 'failed',
};

export const AutomationSequenceStatus = {
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
};

export const AutomationLogStatus = {
  sent: 'sent',
  skipped: 'skipped',
  failed: 'failed',
};
```

### Step 3: Refactor Code to Use Constants

**Files to update:**
- `services/automation-scheduler.js` - Use `ScheduledAutomationStatus`
- `services/post-purchase-series.js` - Use `AutomationSequenceStatus`
- `services/welcome-series.js` - Use `AutomationSequenceStatus`
- `services/win-back.js` - Use `AutomationSequenceStatus`
- `services/automations.js` - Use `AutomationLogStatus`
- `services/credit-validation.js` - Use `AutomationLogStatus`
- `queue/jobs/automationTriggers.js` - Use `ScheduledAutomationStatus`

---

## 8. Summary

### Current State
- ✅ **AutomationSequence**: Fully consistent
- ✅ **AutomationLog**: Fully consistent
- ⚠️ **ScheduledAutomation**: Missing 'executed' and 'failed' status updates

### Required Actions
1. Fix `ScheduledAutomation` status updates in job handlers
2. Add enum constants for all three status types
3. Refactor code to use constants

### Benefits
- Better tracking of automation execution state
- Type safety and consistency
- Easier maintenance and refactoring
- Aligns with existing codebase patterns

---

**Review Completed:** 2025-01-20  
**Next Steps:** Implement status updates and enum constants
