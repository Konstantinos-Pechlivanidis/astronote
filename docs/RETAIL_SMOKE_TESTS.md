# Retail Smoke Tests

## Overview

This document provides click-by-click validation steps for all Retail flows in `apps/astronote-web`.

**Base URL**: `http://localhost:3000` (local) or production URL

**Prerequisites**:
- Retail API running and accessible
- Test user account (or ability to create one)
- Test campaign data (optional, for full flow)

---

## Test 1: Authentication Flow

### 1.1 Register New User
1. Navigate to `/auth/retail/register`
2. **Verify**: Form displays with fields: Email, Password, Confirm Password, Sender Name (optional), Company (optional)
3. Enter valid email (e.g., `test@example.com`)
4. Enter password (min 8 chars, e.g., `password123`)
5. Enter matching confirm password
6. Click "Sign Up"
7. **Verify**: 
   - Loading state shows "Creating account..."
   - Success toast appears
   - Redirects to `/app/retail/dashboard`
   - User is logged in

### 1.2 Login Existing User
1. Navigate to `/auth/retail/login`
2. **Verify**: Form displays with Email and Password fields
3. Enter valid credentials
4. Click "Log In"
5. **Verify**:
   - Loading state shows "Signing in..."
   - Success toast appears
   - Redirects to `/app/retail/dashboard`
   - User is logged in

### 1.3 Login Validation
1. Navigate to `/auth/retail/login`
2. Try submitting empty form
3. **Verify**: Validation errors show for required fields
4. Try invalid email format
5. **Verify**: "Invalid email address" error shows
6. Try wrong password
7. **Verify**: Error message from API displays

### 1.4 Auth Guard
1. While logged out, navigate to `/app/retail/dashboard`
2. **Verify**: Redirects to `/auth/retail/login`
3. While logged in, navigate to `/auth/retail/login`
4. **Verify**: Redirects to `/app/retail/dashboard`

---

## Test 2: Dashboard

### 2.1 Dashboard Load
1. Log in and navigate to `/app/retail/dashboard`
2. **Verify**:
   - Loading skeleton appears initially
   - 6 KPI cards display: Total Campaigns, Total Messages, Messages Sent, Messages Failed, Conversions, Conversion Rate
   - CreditsCard shows balance and subscription status
   - All numbers formatted correctly (commas, percentages)

### 2.2 Dashboard Error Handling
1. Disconnect network (or use browser DevTools to block requests)
2. Refresh `/app/retail/dashboard`
3. **Verify**: Error message shows with "Retry" button
4. Reconnect network
5. Click "Retry"
6. **Verify**: Dashboard loads successfully

---

## Test 3: Billing

### 3.1 Billing Page Load
1. Navigate to `/app/retail/billing`
2. **Verify**:
   - BillingHeader shows credits balance and subscription status
   - SubscriptionCard displays (active or subscribe options)
   - CreditTopupCard shows credit pack dropdown
   - TransactionsTable displays transaction history

### 3.2 Subscribe to Plan
1. If no active subscription, click "Subscribe to Starter" or "Subscribe to Pro"
2. **Verify**: Redirects to Stripe checkout URL
3. Complete or cancel checkout
4. **Verify**: Returns to billing page (if canceled) or shows updated subscription (if completed)

### 3.3 Purchase Credits
1. Select a credit pack from dropdown
2. Click "Buy Credits"
3. **Verify**: Redirects to Stripe checkout URL
4. Complete or cancel checkout
5. **Verify**: Returns to billing page

### 3.4 Manage Subscription
1. If subscription is active, click "Manage Subscription"
2. **Verify**: Redirects to Stripe customer portal

### 3.5 Transactions Pagination
1. If more than 20 transactions, click "Next"
2. **Verify**: Next page of transactions loads
3. Click "Previous"
4. **Verify**: Previous page loads

---

## Test 4: Campaigns

### 4.1 Campaigns List
1. Navigate to `/app/retail/campaigns`
2. **Verify**:
   - Table displays campaigns with columns: Name, Status, Messages, Scheduled, Created
   - Status badges show correct colors
   - Pagination controls work (if > 20 campaigns)

### 4.2 Campaign Search
1. Type in search box (e.g., "Summer")
2. **Verify**: Results filter after 300ms debounce
3. Clear search
4. **Verify**: All campaigns show again

### 4.3 Campaign Status Filter
1. Select "Draft" from status dropdown
2. **Verify**: Only draft campaigns show
3. Select "All Status"
4. **Verify**: All campaigns show

### 4.4 Create Campaign - Basics Step
1. Click "New Campaign"
2. Navigate to `/app/retail/campaigns/new`
3. **Verify**: Step 1 (Basics) displays
4. Enter campaign name (e.g., "Test Campaign")
5. Enter message text (e.g., "Hello {{firstName}}, this is a test!")
6. Click "Next"
7. **Verify**: 
   - If valid: Proceeds to Step 2
   - If invalid: Validation errors show

### 4.5 Create Campaign - Audience Step
1. On Step 2, select "Male" from Gender Filter
2. Select "25-39" from Age Group Filter
3. Click "Preview Audience"
4. **Verify**: 
   - Loading state shows "Previewing..."
   - Audience count displays
   - Sample contacts show (if available)
5. Click "Next"
6. **Verify**: Proceeds to Step 3

### 4.6 Create Campaign - Schedule Step
1. On Step 3, select "Schedule for later"
2. **Verify**: Date and Time inputs appear
3. Select a future date and time
4. Click "Next"
5. **Verify**: Proceeds to Step 4 (Review)

### 4.7 Create Campaign - Review & Create
1. On Step 4, verify all data is correct
2. Click "Create Campaign"
3. **Verify**:
   - Loading state shows "Creating..."
   - Success toast appears
   - Redirects to campaign detail page

### 4.8 Campaign Detail
1. Click on a campaign from the list
2. Navigate to `/app/retail/campaigns/[id]`
3. **Verify**:
   - Campaign details display (name, status, recipients, dates)
   - Message preview section shows
   - Audience filters display
   - Actions section shows appropriate buttons

### 4.9 Preview Messages
1. On campaign detail page, click "Preview Messages"
2. **Verify**: Modal opens with sample rendered messages
3. Click close button or outside modal
4. **Verify**: Modal closes

### 4.10 Send Campaign
1. On campaign detail page, click "Send Campaign"
2. **Verify**: Confirmation dialog appears
3. Click "Send" in dialog
4. **Verify**:
   - Button shows "Sending..." and is disabled
   - Success toast appears with message count
   - Campaign status updates to "sending"
   - Button becomes disabled

### 4.11 Campaign Stats
1. Navigate to `/app/retail/campaigns/[id]/stats`
2. **Verify**:
   - 4 stat cards display: Total Messages, Sent, Conversions, Unsubscribes
   - Percentages calculated correctly
   - "Back to Campaign" button works

---

## Test 5: Public Routes

### 5.1 Unsubscribe (Valid Token)
1. Navigate to `/unsubscribe?pt=VALID_PAGE_TOKEN`
2. **Verify**:
   - Loading state shows
   - Form displays with store name and contact name (if available)
   - "Yes, Unsubscribe Me" button is enabled
3. Click "Yes, Unsubscribe Me"
4. **Verify**:
   - Button shows "Processing..."
   - Success message displays
   - User is unsubscribed

### 5.2 Unsubscribe (Invalid Token)
1. Navigate to `/unsubscribe` (no `pt` param)
2. **Verify**: Error message shows "Invalid Link"
3. Navigate to `/unsubscribe?pt=INVALID_TOKEN`
4. **Verify**: Error message shows "Invalid Link" or "no longer valid"

### 5.3 Resubscribe
1. Navigate to `/resubscribe?pt=VALID_PAGE_TOKEN`
2. **Verify**: Form displays
3. Click "Yes, Resubscribe Me"
4. **Verify**: Success message displays

### 5.4 Offer Landing
1. Navigate to `/tracking/offer/VALID_TRACKING_ID`
2. **Verify**:
   - Loading state shows
   - Offer displays with store name and offer text
   - "Already Redeemed" message if applicable
3. If not redeemed, verify offer text is readable

### 5.5 Redemption Status
1. Navigate to `/tracking/redeem/VALID_TRACKING_ID`
2. **Verify**:
   - Loading state shows
   - Status displays: "Already Redeemed" or "Not Yet Redeemed"
   - Redeemed date shows if applicable

---

## Test 6: Error Handling

### 6.1 Network Error
1. Disconnect network
2. Try to load any page
3. **Verify**: Error state shows with retry option

### 6.2 401 Error (Token Expiry)
1. Manually expire token (clear localStorage or wait for expiry)
2. Try to access `/app/retail/dashboard`
3. **Verify**:
   - Automatic refresh attempt
   - If refresh fails: "Session expired" toast appears
   - Redirects to `/auth/retail/login`

### 6.3 Error Boundary
1. Trigger a React error (if possible via dev tools)
2. **Verify**: Error boundary catches it and shows user-friendly message
3. Click "Try again"
4. **Verify**: Page reloads

---

## Test 7: Accessibility

### 7.1 Keyboard Navigation
1. Tab through all interactive elements
2. **Verify**: Focus rings appear (Tiffany Blue)
3. Press Enter/Space on buttons
4. **Verify**: Actions trigger correctly

### 7.2 Screen Reader
1. Use screen reader (VoiceOver/NVDA)
2. Navigate through pages
3. **Verify**: All buttons have aria-labels
4. **Verify**: Form fields have labels
5. **Verify**: Error messages are announced

### 7.3 Focus Management
1. Open a modal (e.g., Preview Messages)
2. **Verify**: Focus moves to modal
3. Close modal
4. **Verify**: Focus returns to trigger button

---

## Test 8: Theme (Light Mode)

### 8.1 Retail Routes Light Mode
1. Navigate to any `/app/retail/*` route
2. **Verify**: Light mode theme applied (white background, dark text)
3. Navigate to `/auth/retail/login`
4. **Verify**: Light mode theme applied
5. Navigate to `/unsubscribe`
6. **Verify**: Light mode theme applied

### 8.2 Marketing Routes (Dark Mode)
1. Navigate to `/` (marketing landing)
2. **Verify**: Dark mode theme (if marketing uses dark)
3. **Verify**: Retail routes remain light mode

---

## Test 9: Performance

### 9.1 Page Load Times
1. Open browser DevTools → Network tab
2. Navigate to `/app/retail/dashboard`
3. **Verify**: Page loads in < 2 seconds (on good connection)
4. **Verify**: No unnecessary API calls

### 9.2 Caching
1. Load `/app/retail/campaigns`
2. Navigate away and back
3. **Verify**: Data loads from cache (no loading skeleton)
4. Wait 30+ seconds
5. Navigate back
6. **Verify**: Data refetches (staleTime expired)

---

## Test 10: Idempotency

### 10.1 Campaign Enqueue Idempotency
1. Create a draft campaign
2. Click "Send Campaign" → Confirm
3. **Verify**: Campaign enqueues
4. Immediately click "Send Campaign" again (if button still enabled)
5. **Verify**: Request is blocked or shows "Already sending" error
6. **Verify**: Only one enqueue request was sent (check Network tab)

### 10.2 Refresh Retry Preserves Idempotency-Key
1. Open browser DevTools → Network tab
2. Create a draft campaign
3. Click "Send Campaign" → Confirm
4. Simulate 401 error (or wait for token expiry)
5. **Verify**: Refresh happens, original request retries
6. **Verify**: Idempotency-Key header is preserved in retry

---

## Test Checklist Summary

- [ ] Register new user
- [ ] Login existing user
- [ ] Login validation errors
- [ ] Auth guard redirects
- [ ] Dashboard loads and displays KPIs
- [ ] Dashboard error handling
- [ ] Billing page loads
- [ ] Subscribe to plan (Stripe redirect)
- [ ] Purchase credits (Stripe redirect)
- [ ] Manage subscription (Stripe portal)
- [ ] Campaigns list with search/filter
- [ ] Create campaign (all 4 steps)
- [ ] Campaign detail page
- [ ] Preview messages modal
- [ ] Send campaign (with confirmation)
- [ ] Campaign stats page
- [ ] Unsubscribe (valid token)
- [ ] Unsubscribe (invalid token)
- [ ] Resubscribe
- [ ] Offer landing page
- [ ] Redemption status page
- [ ] Network error handling
- [ ] 401 error handling (session expiry)
- [ ] Error boundary
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] Focus management
- [ ] Light mode theme (retail routes)
- [ ] Page load performance
- [ ] React Query caching
- [ ] Idempotency-Key preservation

---

## Expected Results

All tests should pass with:
- ✅ No console errors (except expected API errors for invalid inputs)
- ✅ All API calls return 200/201 (except intentional error tests)
- ✅ All redirects work correctly
- ✅ All loading/error states display appropriately
- ✅ All validations work as expected
- ✅ Theme is light mode for all retail routes

---

## Known Issues

None currently. All implemented features have full parity with legacy.

---

## Notes

- Use test accounts with known data for consistent results
- Some tests require backend to be running and accessible
- Stripe redirects require Stripe test mode configuration
- Public routes require valid tokens/IDs from actual SMS messages

