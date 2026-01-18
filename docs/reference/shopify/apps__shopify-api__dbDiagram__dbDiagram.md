// Astronote - Multi-tenant SMS Marketing (Shopify + Mitto + Stripe)
// DBML for dbdiagram.io

Table stores {
  id uuid [pk]
  shop_domain varchar [not null, unique] // myshop.myshopify.com
  shopify_shop_id bigint [not null]      // Shopify shop ID
  name varchar
  currency varchar
  timezone varchar
  default_sender varchar                 // e.g. store name
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table users {
  id uuid [pk]
  store_id uuid [not null]
  email varchar
  role varchar [not null, default: "merchant"] // merchant | admin
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (email)
  }
}

Table shopify_sessions {
  id uuid [pk]
  store_id uuid [not null]
  session_id varchar [not null, unique]
  access_token_encrypted text [not null]
  scope varchar
  expires_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
  }
}

Table mitto_credentials {
  id uuid [pk]
  store_id uuid [not null, unique]
  traffic_account_id uuid [not null] // Mitto trafficAccountId
  api_key_encrypted text [not null]  // X-Mitto-API-Key (encrypted)
  sender_default varchar
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table contacts {
  id uuid [pk]
  store_id uuid [not null]
  first_name varchar
  last_name varchar
  birth_date date
  phone_e164 varchar [not null]      // +3069...
  country_code varchar [not null]    // GR, CY, etc (mandatory)
  email varchar
  is_subscribed boolean [not null, default: true]
  unsubscribed_at timestamptz
  source varchar [not null, default: "banner"] // banner | checkout | import | api
  consent_at timestamptz
  consent_source varchar             // banner, checkout, etc
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (store_id, phone_e164) [unique]
    (phone_e164)
    (is_subscribed)
  }
}

Table contact_lists {
  id uuid [pk]
  store_id uuid [not null]
  name varchar [not null]
  kind varchar [not null, default: "list"] // list | segment
  rules_json json                          // for segments (optional)
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
  }
}

Table contact_list_members {
  id uuid [pk]
  store_id uuid [not null]
  list_id uuid [not null]
  contact_id uuid [not null]
  created_at timestamptz [not null]

  indexes {
    (store_id)
    (list_id, contact_id) [unique]
  }
}

Table banners {
  id uuid [pk]
  store_id uuid [not null]
  name varchar [not null]
  is_enabled boolean [not null, default: true]
  design_json json [not null]               // UI config for extension
  trigger_rules_json json                   // pages, delay, exit intent etc
  success_action varchar [not null, default: "none"] // none | discount_code
  selected_discount_code_id uuid
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
  }
}

Table opt_in_events {
  id uuid [pk]
  store_id uuid [not null]
  banner_id uuid
  contact_id uuid
  phone_e164 varchar [not null]
  source varchar [not null, default: "banner"]
  ip varchar
  user_agent text
  page_url text
  utm_json json
  created_at timestamptz [not null]

  indexes {
    (store_id)
    (banner_id)
    (contact_id)
  }
}

Table templates_global {
  id uuid [pk]
  name varchar [not null]
  category varchar [not null] // promo | abandoned_cart | welcome | etc
  body_text text [not null]   // supports {First_Name} etc
  example_metrics_json json   // e.g. conversion rate, ctr (display only)
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table campaigns {
  id uuid [pk]
  store_id uuid [not null]
  name varchar [not null]
  status varchar [not null, default: "draft"] // draft | scheduled | sending | completed | failed
  sender varchar [not null]                   // store or custom
  message_text text [not null]                // with placeholders
  audience_type varchar [not null, default: "list"] // list | segment | all
  audience_list_id uuid
  scheduled_at timestamptz
  sent_at timestamptz
  mitto_bulk_id uuid
  totals_json json                            // recipients, sent, delivered, failed
  created_by_user_id uuid
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (status)
    (scheduled_at)
  }
}

Table outbound_messages {
  id uuid [pk]
  store_id uuid [not null]
  contact_id uuid
  campaign_id uuid
  automation_run_id uuid
  phone_e164 varchar [not null]
  sender varchar [not null]
  text text [not null]
  mitto_message_id varchar
  mitto_bulk_id uuid
  delivery_status varchar [not null, default: "Queued"] // Queued | Sent | Delivered | Failed | Unknown
  error_code varchar
  error_message text
  message_parts int [not null, default: 1]
  cost_credits int [not null, default: 1]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (campaign_id)
    (automation_run_id)
    (contact_id)
    (mitto_message_id)
    (delivery_status)
  }
}

Table short_links {
  id uuid [pk]
  store_id uuid [not null]
  code varchar [not null, unique]            // shortened path
  type varchar [not null]                    // unsubscribe | click
  target_url text                            // where to redirect (for click links)
  contact_id uuid
  outbound_message_id uuid
  campaign_id uuid
  created_at timestamptz [not null]
  expires_at timestamptz

  indexes {
    (store_id)
    (type)
    (contact_id)
    (campaign_id)
    (outbound_message_id)
  }
}

Table link_clicks {
  id uuid [pk]
  store_id uuid [not null]
  short_link_id uuid [not null]
  contact_id uuid
  outbound_message_id uuid
  ip varchar
  user_agent text
  referrer text
  created_at timestamptz [not null]

  indexes {
    (store_id)
    (short_link_id)
    (contact_id)
  }
}

Table unsubscribes {
  id uuid [pk]
  store_id uuid [not null]
  contact_id uuid [not null]
  method varchar [not null, default: "link"] // link | support | admin
  ip varchar
  user_agent text
  created_at timestamptz [not null]

  indexes {
    (store_id)
    (contact_id)
  }
}

Table discount_codes_cache {
  id uuid [pk]
  store_id uuid [not null]
  shopify_price_rule_id bigint
  shopify_discount_code_id bigint
  code varchar [not null]
  starts_at timestamptz
  ends_at timestamptz
  status varchar [not null, default: "active"] // active | expired | disabled
  raw_json json
  last_synced_at timestamptz [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (store_id, code) [unique]
  }
}

Table automations {
  id uuid [pk]
  store_id uuid [not null]
  type varchar [not null]                    // welcome | abandoned_checkout | post_purchase
  is_enabled boolean [not null, default: false]
  sender varchar [not null]
  template_text text [not null]              // placeholders supported
  delay_seconds int [not null, default: 0]   // e.g. 1800 for 30 minutes
  settings_json json                         // trigger rules / filters
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (type) [unique]
  }
}

Table automation_runs {
  id uuid [pk]
  store_id uuid [not null]
  automation_id uuid [not null]
  contact_id uuid
  shopify_event_type varchar                 // orders/create, checkouts/update etc
  shopify_event_id varchar                   // order id / checkout token
  status varchar [not null, default: "scheduled"] // scheduled | running | completed | failed | cancelled
  scheduled_for timestamptz
  started_at timestamptz
  finished_at timestamptz
  error_message text
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (automation_id)
    (status)
    (scheduled_for)
  }
}

Table shopify_orders {
  id uuid [pk]
  store_id uuid [not null]
  shopify_order_id bigint [not null]
  order_number varchar
  currency varchar
  total_price numeric
  customer_phone_e164 varchar
  customer_email varchar
  created_at timestamptz [not null]
  raw_json json

  indexes {
    (store_id)
    (store_id, shopify_order_id) [unique]
  }
}

Table shopify_checkouts {
  id uuid [pk]
  store_id uuid [not null]
  checkout_token varchar [not null]      // Shopify checkout token
  cart_token varchar
  phone_e164 varchar
  line_items_json json
  total_price numeric
  currency varchar
  is_completed boolean [not null, default: false]
  completed_at timestamptz
  last_updated_at timestamptz [not null]
  raw_json json

  indexes {
    (store_id)
    (store_id, checkout_token) [unique]
    (is_completed)
  }
}

Table stripe_customers {
  id uuid [pk]
  store_id uuid [not null, unique]
  stripe_customer_id varchar [not null, unique]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table stripe_subscriptions {
  id uuid [pk]
  store_id uuid [not null]
  stripe_subscription_id varchar [not null, unique]
  plan varchar [not null]                 // monthly | yearly
  status varchar [not null]               // active | past_due | canceled | incomplete...
  current_period_end timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (store_id)
    (status)
  }
}

Table credit_ledger {
  id uuid [pk]
  store_id uuid [not null]
  type varchar [not null]                 // grant | purchase | spend | refund | adjustment
  amount int [not null]                   // + or - credits
  unit_price_eur numeric                  // for purchases (optional)
  reference_type varchar                  // subscription | checkout | campaign | message
  reference_id uuid
  note text
  created_at timestamptz [not null]

  indexes {
    (store_id)
    (type)
    (created_at)
  }
}

Table audit_logs {
  id uuid [pk]
  store_id uuid
  actor_user_id uuid
  action varchar [not null]
  entity_type varchar
  entity_id uuid
  meta_json json
  created_at timestamptz [not null]

  indexes {
    (store_id)
    (actor_user_id)
    (created_at)
  }
}

// Relationships
Ref: stores.id < users.store_id
Ref: stores.id < shopify_sessions.store_id
Ref: stores.id < mitto_credentials.store_id
Ref: stores.id < contacts.store_id
Ref: stores.id < contact_lists.store_id
Ref: contact_lists.id < contact_list_members.list_id
Ref: contacts.id < contact_list_members.contact_id
Ref: stores.id < banners.store_id
Ref: banners.id < opt_in_events.banner_id
Ref: contacts.id < opt_in_events.contact_id
Ref: stores.id < campaigns.store_id
Ref: users.id < campaigns.created_by_user_id
Ref: stores.id < outbound_messages.store_id
Ref: contacts.id < outbound_messages.contact_id
Ref: campaigns.id < outbound_messages.campaign_id
Ref: stores.id < short_links.store_id
Ref: contacts.id < short_links.contact_id
Ref: outbound_messages.id < short_links.outbound_message_id
Ref: stores.id < link_clicks.store_id
Ref: short_links.id < link_clicks.short_link_id
Ref: stores.id < unsubscribes.store_id
Ref: contacts.id < unsubscribes.contact_id
Ref: stores.id < discount_codes_cache.store_id
Ref: stores.id < automations.store_id
Ref: automations.id < automation_runs.automation_id
Ref: stores.id < automation_runs.store_id
Ref: contacts.id < automation_runs.contact_id
Ref: stores.id < shopify_orders.store_id
Ref: stores.id < shopify_checkouts.store_id
Ref: stores.id < stripe_customers.store_id
Ref: stores.id < stripe_subscriptions.store_id
Ref: stores.id < credit_ledger.store_id
Ref: stores.id < audit_logs.store_id
Ref: users.id < audit_logs.actor_user_id
