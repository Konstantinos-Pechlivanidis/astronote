# Diff Summary (Shopify Tax/VAT Parity)

- Default Stripe Tax flag now aligns with Retail (`STRIPE_TAX_ENABLED` defaults to true unless explicitly set to false).
- Stripe customer sync now derives tax treatment and sets `tax_exempt` (reverse for EU B2B), normalizes country uppercase, and passes tax_exempt on create/update.
- Subscription updates now honor Stripe Tax by setting `automatic_tax.enabled=true` when the tax flag is on.
