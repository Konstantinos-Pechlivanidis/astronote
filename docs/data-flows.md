# Data Flow Diagrams

**Generated**: 2025-01-XX  
**Purpose**: Step-by-step data flow diagrams for critical system operations

## 1. Authentication & Session Flow

### Shopify Extension (App Bridge)

```mermaid
sequenceDiagram
    participant FE as Frontend (Shopify Extension)
    participant Shopify as Shopify App Bridge
    participant BE as Backend API
    participant DB as Database

    FE->>Shopify: Request session token
    Shopify->>FE: Session token (JWT)
    FE->>BE: POST /auth/shopify-token<br/>{sessionToken}
    BE->>Shopify: Verify session token
    Shopify->>BE: Verified shop domain
    BE->>DB: Find or create Shop
    DB->>BE: Shop record
    BE->>BE: Generate app JWT token
    BE->>FE: {token, store, expiresIn}
    FE->>BE: API requests with Bearer token
    BE->>BE: Verify JWT, resolve store
    BE->>DB: Query with shopId filter
    DB->>BE: Scoped data
    BE->>FE: Response
```

### Web App (OAuth Flow)

```mermaid
sequenceDiagram
    participant User as User Browser
    participant FE as Frontend Web App
    participant BE as Backend API
    participant Shopify as Shopify OAuth
    participant DB as Database

    User->>FE: Click "Install App"
    FE->>BE: GET /auth/shopify?shop=<domain>
    BE->>Shopify: Redirect to OAuth
    Shopify->>User: OAuth consent page
    User->>Shopify: Grant permissions
    Shopify->>BE: GET /auth/callback?code=...
    BE->>BE: Verify HMAC
    BE->>Shopify: Exchange code for access token
    Shopify->>BE: Access token
    BE->>DB: Find or create Shop
    DB->>BE: Shop record
    BE->>BE: Register webhooks
    BE->>BE: Generate app JWT token
    BE->>FE: Redirect with token
    FE->>BE: API requests with Bearer token
```

## 2. Campaign Creation → Enqueue → Send Flow

```mermaid
sequenceDiagram
    participant User as User
    participant API as API Endpoint
    participant Service as Campaigns Service
    participant DB as Database
    participant Queue as BullMQ Queue
    participant Worker as Queue Worker
    participant Mitto as Mitto API

    User->>API: POST /campaigns<br/>{name, message, audience}
    API->>Service: createCampaign(shopId, data)
    Service->>DB: Transaction: Create Campaign + Metrics
    DB->>Service: Campaign created
    Service->>API: Campaign object
    API->>User: 201 Created

    User->>API: POST /campaigns/:id/enqueue
    API->>Service: enqueueCampaign(shopId, campaignId)
    
    Note over Service,DB: Phase 1: Validation & Recipient Resolution
    Service->>DB: Get campaign (with shopId filter)
    DB->>Service: Campaign
    Service->>Service: Validate status (must be draft/scheduled)
    Service->>DB: Resolve recipients (shopId + audience filter)
    DB->>Service: Array of contacts
    
    Note over Service,DB: Phase 2: Credit Reservation (Transaction)
    Service->>Service: Calculate required credits
    Service->>DB: Transaction: Reserve credits
    DB->>DB: Check wallet balance - reserved
    DB->>DB: Create CreditReservation
    DB->>Service: Reservation created
    
    Note over Service,DB: Phase 3: Status Update & Recipient Creation (Transaction)
    Service->>DB: Transaction: Update campaign status to "sending"
    Service->>DB: Create CampaignRecipient records (bulk)
    DB->>Service: Recipients created
    
    Note over Service,Queue: Phase 4: Queue Jobs
    Service->>Service: Batch recipients (5000 per batch)
    loop For each batch
        Service->>Queue: Add bulkSms job<br/>{campaignId, batch, reservationId}
        Queue->>Service: Job ID
    end
    Service->>API: {ok: true, enqueuedJobs: N}
    API->>User: 200 OK

    Note over Worker,Mitto: Phase 5: Job Processing
    Queue->>Worker: Process bulkSms job
    Worker->>DB: Get campaign + recipients (shopId filter)
    DB->>Worker: Campaign + Recipients
    Worker->>Service: Personalize messages
    Worker->>Service: Append unsubscribe links
    Worker->>Mitto: Bulk SMS API call
    Mitto->>Worker: Bulk ID + Message IDs
    Worker->>DB: Update CampaignRecipient<br/>(status, mittoMessageId, bulkId)
    Worker->>DB: Create MessageLog records
    Worker->>DB: Debit credits (release reservation)
    Worker->>DB: Update CampaignMetrics
    Worker->>Queue: Job completed

    Note over Mitto,DB: Phase 6: Delivery Status Updates
    Mitto->>API: POST /mitto/delivery-status (webhook)
    API->>Service: Update delivery status
    Service->>DB: Update CampaignRecipient.deliveryStatus
    Service->>DB: Update CampaignMetrics
    Service->>DB: Update MessageLog.deliveryStatus
```

### Critical Transaction Boundaries

1. **Credit Reservation**: Must be atomic with balance check
2. **Status Update + Recipient Creation**: Must be atomic to prevent orphaned recipients
3. **Credit Debit**: Must be atomic with message send to prevent double-charging

## 3. Contacts Import & Deduplication Flow

```mermaid
sequenceDiagram
    participant User as User
    participant API as API Endpoint
    participant Service as Contacts Service
    participant DB as Database

    User->>API: POST /contacts/import<br/>{csv: "phone,email,name..."}
    API->>Service: importCsv(shopId, csvData)
    
    Service->>Service: Parse CSV
    Service->>Service: Validate phone numbers (E.164)
    Service->>Service: Normalize emails
    
    Note over Service,DB: Deduplication Strategy
    Service->>DB: Find existing contacts<br/>(shopId + phoneE164 OR email)
    DB->>Service: Existing contacts map
    
    loop For each CSV row
        alt Contact exists (by phone)
            Service->>Service: Update existing contact
            Service->>DB: Update Contact<br/>(email, firstName, lastName, tags)
        else Contact exists (by email only)
            Service->>Service: Merge: update phone, keep email
            Service->>DB: Update Contact
        else New contact
            Service->>DB: Create Contact<br/>(shopId, phoneE164, email, ...)
        end
    end
    
    Service->>API: {imported: N, skipped: M, errors: []}
    API->>User: 200 OK
```

### Deduplication Rules

1. **Primary Key**: `(shopId, phoneE164)` - unique constraint
2. **Secondary Key**: `(shopId, email)` - unique constraint
3. **Merge Strategy**: 
   - If phone matches → update all fields
   - If email matches but phone differs → update phone (phone is primary)
   - If neither matches → create new contact

## 4. Unsubscribe/Opt-Out Flow

```mermaid
sequenceDiagram
    participant User as SMS Recipient
    participant FE as Frontend
    participant API as Backend API
    participant Service as Unsubscribe Service
    participant DB as Database

    Note over Service: URL Generation (during SMS send)
    Service->>Service: generateUnsubscribeToken(contactId, shopId, phoneE164)
    Service->>Service: Sign token with HMAC
    Service->>Service: Build URL: ${FRONTEND_URL}/shopify/unsubscribe/${token}
    Service->>User: SMS with unsubscribe link

    Note over User,DB: Unsubscribe Process
    User->>FE: Click unsubscribe link
    FE->>API: GET /unsubscribe/:token
    API->>Service: verifyUnsubscribeToken(token)
    Service->>Service: Verify HMAC signature
    Service->>Service: Check token expiration (30 days)
    Service->>DB: Get contact (shopId + phoneE164)
    DB->>Service: Contact
    Service->>API: Contact info for confirmation page
    API->>FE: Unsubscribe page
    FE->>User: Show confirmation

    User->>FE: Confirm unsubscribe
    FE->>API: POST /unsubscribe/:token
    API->>Service: processUnsubscribe(token)
    Service->>Service: Verify token again
    Service->>DB: Update Contact.smsConsent = 'opted_out'
    DB->>Service: Updated
    Service->>API: {success: true}
    API->>FE: Success response
    FE->>User: Confirmation message
```

### Security Measures

1. **Token Signing**: HMAC-SHA256 with secret key
2. **Token Expiration**: 30 days
3. **Verification**: Token verified on both GET and POST
4. **No Authentication Required**: Public endpoint (token is the auth)

## 5. Billing/Credits Flow

### Credit Purchase Flow

```mermaid
sequenceDiagram
    participant User as User
    participant API as API Endpoint
    participant Service as Billing Service
    participant Stripe as Stripe API
    participant DB as Database
    participant Webhook as Stripe Webhook

    User->>API: POST /billing/purchase<br/>{packageId, currency}
    API->>Service: createPurchase(shopId, packageId)
    Service->>DB: Get Package
    DB->>Service: Package (credits, price)
    Service->>Stripe: Create checkout session
    Stripe->>Service: Session ID + URL
    Service->>DB: Create Purchase record (status: pending)
    Service->>API: {sessionId, url}
    API->>User: Redirect to Stripe

    User->>Stripe: Complete payment
    Stripe->>Webhook: POST /webhooks/stripe<br/>{event: checkout.completed}
    Webhook->>Service: Handle Stripe webhook
    Service->>Service: Verify signature
    Service->>DB: Update Purchase (status: paid)
    Service->>DB: Create CreditTransaction (type: credit)
    Service->>DB: Update Wallet.balance
    Service->>DB: Update Shop.credits
    Stripe->>User: Redirect to success page
```

### Credit Reservation → Debit → Refund Flow

```mermaid
sequenceDiagram
    participant Campaign as Campaign Enqueue
    participant Service as Wallet Service
    participant DB as Database
    participant Mitto as Mitto API

    Campaign->>Service: reserveCredits(shopId, amount, {campaignId})
    Service->>DB: Transaction
    DB->>DB: Get Wallet
    DB->>DB: Sum active reservations
    DB->>DB: Check: balance - reserved >= amount
    alt Insufficient credits
        DB->>Service: Error: InsufficientCreditsError
        Service->>Campaign: Throw error
    else Sufficient credits
        DB->>DB: Create CreditReservation
        DB->>Service: Reservation
        Service->>Campaign: Reservation ID
    end

    Note over Service,Mitto: During SMS Send
    Service->>Mitto: Send SMS
    Mitto->>Service: Success
    Service->>DB: Transaction
    DB->>DB: Debit credits (create CreditTransaction type: debit)
    DB->>DB: Update Wallet.balance
    DB->>DB: Update CreditReservation.status = 'released'
    DB->>DB: Update CampaignMetrics.totalSent

    alt Hard failure (immediate)
        Mitto->>Service: Delivery failed (hard failure)
        Service->>DB: Transaction
        DB->>DB: Refund credits (create CreditTransaction type: refund)
        DB->>DB: Update Wallet.balance
        DB->>DB: Update CampaignMetrics.totalFailed
    end
```

### Credit Reconciliation

```mermaid
sequenceDiagram
    participant Scheduler as Periodic Scheduler
    participant Service as Delivery Status Service
    participant Mitto as Mitto API
    participant DB as Database

    Scheduler->>Service: startPeriodicStatusUpdates()
    loop Every 5 minutes
        Service->>DB: Find campaigns with status='sending'
        DB->>Service: Campaigns
        loop For each campaign
            Service->>DB: Get recipients with status='sent'
            DB->>Service: Recipients with mittoMessageId
            Service->>Mitto: Get delivery status (bulk)
            Mitto->>Service: Status updates
            loop For each update
                alt Status: Delivered
                    Service->>DB: Update CampaignRecipient.deliveryStatus
                    Service->>DB: Update CampaignMetrics.totalDelivered
                else Status: Failed
                    Service->>DB: Update CampaignRecipient.deliveryStatus
                    Service->>DB: Update CampaignMetrics.totalFailed
                    Service->>DB: Refund credits (if not already refunded)
                    Service->>DB: Update Wallet.balance
                end
            end
        end
    end
```

## 6. Automation Trigger Flow

```mermaid
sequenceDiagram
    participant Shopify as Shopify Webhook
    participant API as Backend API
    participant Service as Event Processing
    participant DB as Database
    participant Queue as BullMQ Queue
    participant Worker as Queue Worker
    participant Mitto as Mitto API

    Shopify->>API: POST /automation-webhooks/orders/create<br/>{order, shop_domain}
    API->>Service: validateShopifyWebhook()
    Service->>Service: Verify HMAC
    Service->>Service: Deduplicate event (EventProcessingState)
    Service->>DB: Check lastEventId
    alt Duplicate event
        DB->>Service: Event already processed
        Service->>API: 200 OK (skip)
    else New event
        Service->>DB: Update EventProcessingState
        Service->>DB: Get active automations for trigger type
        DB->>Service: UserAutomations
        loop For each automation
            Service->>DB: Get contact (by customer ID)
            DB->>Service: Contact
            alt Contact not found or no consent
                Service->>Service: Skip automation
            else Contact eligible
                Service->>Queue: Add automationTrigger job
                Queue->>Worker: Process job
                Worker->>Service: triggerAutomation()
                Service->>Service: Process message template
                Service->>Service: Append unsubscribe link
                Service->>Mitto: Send SMS
                Mitto->>Worker: Success
                Worker->>DB: Create AutomationLog
                Worker->>DB: Create MessageLog
                Worker->>DB: Debit credits
            end
        end
        Service->>API: 200 OK
    end
```

## 7. Points Where System Can Double-Send or Get Stuck

### Risk 1: Campaign Double-Enqueue

**Scenario**: User clicks "Send" button twice quickly

**Current Protection**:
- Status check: Campaign must be `draft` or `scheduled` to enqueue
- Status update to `sending` is atomic
- If status is already `sending`, enqueue returns early

**Gap**: Race condition if two requests hit simultaneously before status update

**Recommendation**: Add database-level unique constraint or use advisory locks

### Risk 2: Campaign Stuck in "Sending" Status

**Scenario**: Queue worker crashes mid-send, campaign never completes

**Current Protection**:
- Periodic status updates check `sending` campaigns
- Reconciliation updates metrics based on actual delivery status

**Gap**: Campaign status never transitions to `sent` if all recipients processed but status not updated

**Recommendation**: Add reconciliation job that checks if all recipients processed and updates status

### Risk 3: Credit Double-Debit

**Scenario**: Worker processes same job twice (retry after partial failure)

**Current Protection**:
- Credit debit happens after successful Mitto API call
- CampaignRecipient status prevents duplicate sends (unique constraint on `(campaignId, phoneE164)`)

**Gap**: If job retries after partial batch send, credits may be debited twice

**Recommendation**: Idempotency keys for credit transactions, check before debit

### Risk 4: Automation Double-Trigger

**Scenario**: Same Shopify event processed twice

**Current Protection**:
- `EventProcessingState` table tracks last processed event ID
- Deduplication check before processing

**Gap**: Race condition if two webhooks arrive simultaneously

**Recommendation**: Database unique constraint on `(shopId, automationType, lastEventId)` or use advisory locks

## 8. Idempotency Strategy

### Campaign Enqueue
- **Idempotency Key**: `campaign-${campaignId}-enqueue-${timestamp}`
- **Check**: Campaign status must be `draft` or `scheduled`
- **Result**: If already `sending`, return existing job count

### SMS Send
- **Idempotency Key**: `sms-${campaignId}-${phoneE164}`
- **Check**: CampaignRecipient unique constraint `(campaignId, phoneE164)`
- **Result**: If recipient exists, skip send

### Credit Transaction
- **Idempotency Key**: `credit-${shopId}-${campaignId}-${type}-${timestamp}`
- **Check**: None currently
- **Recommendation**: Add idempotency key to CreditTransaction meta field

### Webhook Processing
- **Idempotency Key**: `webhook-${shopId}-${eventId}`
- **Check**: EventProcessingState.lastEventId
- **Result**: Skip if event already processed

