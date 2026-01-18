# Store-Type Templates System - Specification

## Current State Analysis

### Backend (apps/shopify-api)
- **Schema:** Template model has:
  - `category` field (String) - currently uses generic types: "welcome", "promotion", "reminder", etc.
  - `eshopType` field (EshopType enum) - currently: fashion, beauty, electronics, food, services, home, sports, books, toys, generic
  - `shopId` nullable - ✅ Already supports global templates (shopId = NULL)
  - `isPublic` default true - ✅ Already supports public templates
  - `templateKey` - ✅ Stable unique key exists

- **Current Problem:**
  - Templates are organized by `eshopType` (which is good)
  - BUT `category` uses generic functional types (welcome, promotion, reminder) instead of store-type categories
  - Frontend sees generic categories, not store types

- **API Endpoints:**
  - `GET /api/templates` - Returns templates with category field
  - `GET /api/templates/categories` - Returns distinct categories from templates
  - Categories are extracted from template.category field

### Frontend (apps/astronote-web)
- **Templates Page:** `apps/astronote-web/app/app/shopify/templates/page.tsx`
- **Category Filter:** Uses `useTemplateCategories()` hook
- **Current Issue:** Shows generic categories (welcome, promotion, etc.) instead of store types

---

## Target Specification

### Store-Type Categories (10 Categories)

1. **Fashion & Apparel**
2. **Beauty & Cosmetics**
3. **Electronics & Gadgets**
4. **Home & Living**
5. **Health & Wellness**
6. **Food & Beverage**
7. **Jewelry & Accessories**
8. **Baby & Kids**
9. **Sports & Fitness**
10. **Pet Supplies**

### Template Types (5 per category = 50+ templates)

Each store-type category will have exactly 5 templates:

1. **Welcome / Opt-in Confirmation**
   - Purpose: Welcome new customers, confirm opt-in
   - Variables: {{firstName}}, {{shopName}}, {{discountCode}}

2. **Abandoned Cart Reminder**
   - Purpose: Recover abandoned carts
   - Variables: {{firstName}}, {{cartUrl}}, {{productName}}, {{discountCode}}

3. **Promo / Discount**
   - Purpose: Promote sales and discounts
   - Variables: {{firstName}}, {{discountCode}}, {{discountValue}}, {{shopName}}

4. **Back in Stock**
   - Purpose: Notify when products are back in stock
   - Variables: {{firstName}}, {{productName}}, {{cartUrl}}

5. **Order Update (Shipped / Delivered / Tracking)**
   - Purpose: Transactional order updates
   - Variables: {{firstName}}, {{orderNumber}}, {{trackingUrl}}, {{supportPhone}}

### Variable Set (Consistent Across All Templates)

- `{{firstName}}` - Customer first name
- `{{shopName}}` - Store name
- `{{discountCode}}` - Discount/promo code
- `{{discountValue}}` - Discount percentage or amount
- `{{cartUrl}}` - Shopping cart URL
- `{{productName}}` - Product name
- `{{orderNumber}}` - Order number
- `{{trackingUrl}}` - Shipping tracking URL
- `{{supportPhone}}` - Customer support phone number

### Template Rules

- **SMS-ready:** Short, concise, under 160 characters when possible
- **Clear CTA:** Every template has a clear call-to-action
- **Safe defaults:** Templates work even if variables are missing (no broken braces)
- **Language:** English only (language = "en")
- **Channel:** SMS (channel = "sms")
- **Purpose tags:** Array of purpose tags for filtering

### Data Model

- **Category:** Store-type name (e.g., "Fashion & Apparel")
- **Template Key:** Stable unique identifier (e.g., "fashion_apparel_welcome_01")
- **Global Scope:** All templates have shopId = NULL, isPublic = true
- **EshopType Mapping:** Map eshopType to store-type category:
  - fashion → "Fashion & Apparel"
  - beauty → "Beauty & Cosmetics"
  - electronics → "Electronics & Gadgets"
  - home → "Home & Living"
  - food → "Food & Beverage"
  - services → "Health & Wellness" (closest match)
  - sports → "Sports & Fitness"
  - books → Generic (no direct match, use "Fashion & Apparel" as fallback)
  - toys → "Baby & Kids"
  - generic → "Fashion & Apparel" (default)

### API Response Shape

```typescript
{
  items: [
    {
      id: string,
      name: string,
      category: "Fashion & Apparel", // Store-type category
      text: string,
      templateKey: string,
      eshopType: "fashion",
      // ... other fields
    }
  ],
  categories: [
    "Fashion & Apparel",
    "Beauty & Cosmetics",
    // ... all store-type categories
  ],
  total: number
}
```

---

## Implementation Plan

1. **Replace DEFAULT_TEMPLATES** with store-type organized templates
2. **Update category field** to use store-type names
3. **Update seed script** to use new template structure
4. **Update API** to return store-type categories
5. **Update frontend** to display store-type categories
6. **Verify** all shops see all templates

