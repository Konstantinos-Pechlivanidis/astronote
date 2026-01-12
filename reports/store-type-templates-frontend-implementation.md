# Store-Type Templates Frontend Implementation

**Date:** 2025-01-30  
**Status:** ✅ **COMPLETE**

## Summary

Updated the Shopify frontend to correctly fetch and display the new store-type template library. The frontend now:
- Displays store-type categories (Fashion & Apparel, Beauty & Cosmetics, etc.)
- Uses defensive mapping to prevent crashes from missing/invalid data
- Ensures Radix Select constraints (no empty SelectItem values)
- Sorts categories by display order
- Handles both Retail-aligned fields (`name`/`text`) and backward compatibility fields (`title`/`content`)

## Files Updated

### 1. `apps/astronote-web/src/lib/shopify/api/templates.ts`

**Changes:**
- Updated `Template` interface to include both Retail-aligned fields (`name`, `text`) and backward compatibility fields (`title`, `content`)
- Added `STORE_TYPE_CATEGORY_ORDER` constant for display order
- Added `sortCategories()` function to sort categories by display order
- Added helper functions:
  - `getTemplateName()` - Get template display name with fallback
  - `getTemplateContent()` - Get template display content with fallback
  - `sanitizeCategory()` - Sanitize category names (ensure non-empty)
  - `sanitizeTemplateId()` - Sanitize template IDs (ensure non-empty)
- Updated `templatesApi.getCategories()` to sanitize and sort categories
- Updated `templatesApi.list()` to sort categories in response

### 2. `apps/astronote-web/app/app/shopify/templates/page.tsx`

**Changes:**
- Imported helper functions from templates API
- Updated category filtering to use sanitized categories from `useMemo`
- Updated template filtering to validate template IDs
- Replaced direct `template.title` and `template.content` access with `getTemplateName()` and `getTemplateContent()`
- Simplified category SelectItem mapping (categories already sanitized)
- Fixed "Clear Filters" button to use `UI_ALL` sentinel instead of empty string
- Added fallback for category display ("Uncategorized" if missing)

### 3. `apps/astronote-web/app/app/shopify/templates/[id]/page.tsx`

**Changes:**
- Imported helper functions from templates API
- Replaced direct `template.title` and `template.content` access with helper functions
- Added fallback for category display ("Uncategorized" if missing)

## DTO/Type Schema

### Template Interface

```typescript
export interface Template {
  id: string;
  // Retail-aligned fields (primary)
  name: string;
  text: string;
  // Backward compatibility fields
  title?: string;
  content?: string;
  // Category (store-type category name)
  category: string;
  // Metadata
  language?: string;
  goal?: string | null;
  suggestedMetrics?: string | null;
  eshopType?: string;
  previewImage?: string | null;
  tags?: string[];
  // Statistics
  conversionRate?: number | null;
  productViewsIncrease?: number | null;
  clickThroughRate?: number | null;
  averageOrderValue?: number | null;
  customerRetention?: number | null;
  useCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
```

### TemplatesListResponse Interface

```typescript
export interface TemplatesListResponse {
  items?: Template[];
  templates?: Template[];
  total?: number;
  page?: number;
  pageSize?: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  categories?: string[];
}
```

## Category Rendering Strategy

### Display Order

Categories are sorted by display order:
1. Store-type categories first (in predefined order):
   - Fashion & Apparel
   - Beauty & Cosmetics
   - Electronics & Gadgets
   - Home & Living
   - Health & Wellness
   - Food & Beverage
   - Jewelry & Accessories
   - Baby & Kids
   - Sports & Fitness
   - Pet Supplies
2. Other categories alphabetically (if any)

### UI Component

- **Type:** Dropdown (Radix Select)
- **Default:** "All Categories" (sentinel value `UI_ALL = '__all__'`)
- **Filtering:** When category selected, templates are filtered by backend API
- **No empty values:** All categories are sanitized before rendering

## Radix Select Constraints

### ✅ No Empty SelectItem Values

1. **Sentinel for "All":**
   ```typescript
   const UI_ALL = '__all__';
   const [categoryFilter, setCategoryFilter] = useState(UI_ALL);
   ```

2. **Category Sanitization:**
   ```typescript
   const categories = useMemo(() => {
     if (!categoriesData) return [];
     return categoriesData
       .map(cat => sanitizeCategory(cat))
       .filter((cat): cat is string => cat !== null);
   }, [categoriesData]);
   ```

3. **SelectItem Rendering:**
   ```typescript
   <SelectItem value={UI_ALL}>All Categories</SelectItem>
   {categories.map((category) => (
     <SelectItem key={category} value={category}>
       {category}
     </SelectItem>
   ))}
   ```

4. **Template ID Validation:**
   ```typescript
   const validTemplates = allTemplates.filter((t) => {
     const id = sanitizeTemplateId(t.id);
     return id !== null;
   });
   ```

## Defensive Mapping

### Category Mapping
- ✅ All categories sanitized (non-empty strings only)
- ✅ Invalid categories filtered out
- ✅ Categories sorted by display order

### Template Mapping
- ✅ All templates validated (non-empty IDs only)
- ✅ Invalid templates filtered out
- ✅ Template names/content use fallbacks:
  - Name: `template.name || template.title || '(Untitled)'`
  - Content: `template.text || template.content || ''`
  - Category: `template.category || 'Uncategorized'`

### API Response Handling
- ✅ Handles both `items` and `templates` field names
- ✅ Categories sorted automatically in API client
- ✅ Empty/null values handled gracefully

## Template Display

### Required Fields Shown
1. **Title/Name** - Uses `getTemplateName()` helper
2. **Category Badge** - Store-type category name with fallback
3. **Body/Message Preview** - Uses `getTemplateContent()` helper
4. **Optional Metadata:**
   - Tags (if available)
   - Performance statistics (if available)
   - Usage count (if available)

### Template Purpose Tags

Templates include purpose tags in the `tags` array:
- `welcome` - Welcome/opt-in confirmation
- `abandoned-cart` - Abandoned cart reminder
- `promo` / `discount` / `sale` - Promo/discount
- `back-in-stock` - Back in stock notification
- `order-update` / `shipped` / `tracking` - Order update

These are displayed as badges in the template card.

## Filtering Logic

### Category Filter
- **"All Categories":** Shows all templates (no category filter sent to API)
- **Specific Category:** Filters templates by category name (sent to API as `category` query param)

### Search Filter
- Searches across template name, content, and tags
- Debounced (300ms delay)

### Favorites Filter
- Filters templates by favorites stored in localStorage
- Works in combination with category and search filters

## Testing

### Manual Testing Checklist

1. ✅ Categories dropdown shows store-type categories in correct order
2. ✅ "All Categories" option works (shows all templates)
3. ✅ Category filtering works (shows only templates in selected category)
4. ✅ No empty SelectItem values rendered
5. ✅ Templates display correctly with name/content
6. ✅ Category badges show store-type names
7. ✅ Missing fields don't crash UI (fallbacks work)
8. ✅ Search works across templates
9. ✅ Favorites filter works
10. ✅ Pagination works

### Test Files

No test files were added as the frontend doesn't have an existing test setup. The implementation includes defensive coding to prevent runtime errors.

## Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Templates page shows store-type categories | ✅ |
| Users can filter by category | ✅ |
| "All categories" exists and works without empty string | ✅ |
| Every template shows title, category, body, metadata | ✅ |
| Data mapping is robust (no crashes) | ✅ |
| No SelectItem renders with empty value | ✅ |
| Frontend types align with backend DTOs | ✅ |

## Summary

✅ **All requirements met:**
- Store-type categories displayed correctly
- Category filtering works
- Radix Select constraints satisfied (no empty values)
- Defensive mapping prevents crashes
- Template display uses correct fields with fallbacks
- Types align with backend DTOs

**The frontend now correctly displays the new store-type template library.**

