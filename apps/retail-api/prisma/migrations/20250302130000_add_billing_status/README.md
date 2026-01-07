Add billing status tracking to CampaignMessage:
- enum BillingStatus: pending, paid, failed
- fields: billingStatus, billingError, billedAt
- enables decoupling provider send status from billing retries.
