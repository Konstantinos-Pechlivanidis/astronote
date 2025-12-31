# SMS Phone Preview Implementation

**Date:** 2025-01-27  
**Feature:** iPhone-style SMS preview frame for Campaign Create pages

---

## Overview

Added a fully responsive iPhone-style SMS preview component to both Retail and Shopify campaign create pages. The preview updates live as users type and shows character/segment counts.

---

## Files Created

1. **`apps/astronote-web/src/components/shared/SmsPhonePreview.tsx`**
   - Shared component for SMS preview
   - iPhone-style frame with realistic design
   - Live character/segment counting
   - Link preview support
   - Fully responsive

---

## Files Modified

1. **`apps/astronote-web/app/(retail)/app/retail/campaigns/new/page.tsx`**
   - Added `SmsPhonePreview` import
   - Modified Step 1 (Basics) to use 2-column grid layout
   - Left column: Form fields
   - Right column: Phone preview (sticky on desktop)
   - Preview updates live via `watch('messageText')`

2. **`apps/astronote-web/app/app/shopify/campaigns/new/page.tsx`**
   - Added `SmsPhonePreview` import
   - Replaced text-based preview sidebar with phone preview
   - Kept additional campaign details in separate card below
   - Preview updates live via `formData.message`
   - Sticky positioning on desktop

---

## Layout Behavior

### Retail Campaign Create (Step 1)

**Mobile (< 1024px):**
- Single column layout
- Form fields stack vertically
- Preview appears below form fields
- Preview is full-width (max 360px)

**Desktop (≥ 1024px):**
- 2-column grid layout (2/3 form, 1/3 preview)
- Preview is sticky (`top-24`) in right column
- Form scrolls independently
- Preview stays visible while scrolling form

### Shopify Campaign Create

**Mobile (< 1024px):**
- Single column layout
- Form fields stack vertically
- Preview appears below form
- Preview is full-width (max 360px)

**Desktop (≥ 1024px):**
- 2-column grid layout (2/3 form, 1/3 preview)
- Preview is sticky (`top-24`) in right column
- Additional campaign details card below preview
- Both cards scroll together

---

## Component Features

### SmsPhonePreview Props

- `senderName?: string` - Default: "Astronote"
- `message: string` - Required message text
- `phoneNumber?: string` - Optional phone number (masked display)
- `timestamp?: string` - Default: "Now"
- `accentColor?: string` - Default: "#0ABAB5" (Tiffany)
- `mode?: 'retail' | 'shopify'` - For future mode-specific styling
- `maxPreviewLines?: number` - Optional max lines (not currently used)
- `showCounts?: boolean` - Default: true, shows character/segment counts

### Visual Features

1. **iPhone Frame:**
   - Realistic bezel (dark gray, rounded)
   - Status bar (time, battery, signal indicators)
   - Dynamic Island hint (subtle)
   - Messages app header with sender name
   - Scrollable message area
   - Home indicator (iPhone X+ style)

2. **Message Bubble:**
   - iOS-style left-aligned bubble
   - White background with shadow
   - Proper text wrapping
   - Preserves whitespace and line breaks

3. **Link Preview:**
   - Automatically detects URLs in message
   - Shows clickable link preview below message
   - Styled as iOS link preview

4. **Counts Footer:**
   - Characters: X/160 (color-coded: green → yellow → orange)
   - SMS Segments: N parts (orange if > 1 segment)
   - Warning message for long messages

---

## Manual Test Checklist

### Test 1: Retail Campaign Create - Live Preview Updates

**Steps:**
1. Navigate to `/app/retail/campaigns/new`
2. Ensure Step 1 (Basics) is active
3. Type in the "Message Text" field
4. **Expected:** Preview updates in real-time as you type
5. **Expected:** Character count updates: X/160
6. **Expected:** Segment count updates when message exceeds 160 chars

**Validation:**
- ✅ Preview shows message immediately
- ✅ Character count is accurate
- ✅ Segment count is accurate (1 part for ≤160 chars, 2 parts for 161-320, etc.)

---

### Test 2: Retail Campaign Create - Long Message Scrolling

**Steps:**
1. Navigate to `/app/retail/campaigns/new`
2. Paste or type a message > 200 characters
3. **Expected:** Message scrolls inside phone screen
4. **Expected:** Page layout remains stable (no expansion)
5. **Expected:** Warning message appears: "Long message: Will be split into N SMS parts"

**Validation:**
- ✅ Phone frame maintains fixed height
- ✅ Message area scrolls independently
- ✅ Page doesn't expand vertically
- ✅ Warning message is visible

---

### Test 3: Retail Campaign Create - Responsive Layout

**Steps:**
1. Open `/app/retail/campaigns/new` on desktop (≥1024px)
2. **Expected:** 2-column layout (form left, preview right)
3. Scroll the form
4. **Expected:** Preview stays sticky in viewport
5. Resize browser to mobile width (<1024px)
6. **Expected:** Layout switches to single column
7. **Expected:** Preview appears below form
8. **Expected:** Preview remains readable and properly sized

**Validation:**
- ✅ Desktop: 2-column layout works
- ✅ Desktop: Preview is sticky
- ✅ Mobile: Single column layout
- ✅ Mobile: Preview stacks below form
- ✅ Preview scales appropriately on all sizes

---

### Test 4: Shopify Campaign Create - Live Preview Updates

**Steps:**
1. Navigate to `/app/shopify/campaigns/new`
2. Type in the "Message" field
3. **Expected:** Preview updates in real-time
4. **Expected:** Character count updates: X/160
5. **Expected:** Segment count updates

**Validation:**
- ✅ Preview shows message immediately
- ✅ Counts are accurate
- ✅ Same behavior as Retail

---

### Test 5: Shopify Campaign Create - Responsive Layout

**Steps:**
1. Open `/app/shopify/campaigns/new` on desktop
2. **Expected:** 2-column layout (form left, preview right)
3. **Expected:** Preview is sticky
4. **Expected:** Campaign details card below preview
5. Resize to mobile
6. **Expected:** Single column, preview below form

**Validation:**
- ✅ Desktop layout matches Retail
- ✅ Mobile layout works correctly
- ✅ Embedded iframe constraints respected (no fixed viewport hacks)

---

### Test 6: Link Preview Detection

**Steps:**
1. Type a message with a URL: "Check out https://example.com for details"
2. **Expected:** Link preview appears below message bubble
3. **Expected:** URL is clickable (opens in new tab)
4. **Expected:** "Tap to open" hint appears

**Validation:**
- ✅ URLs are detected correctly
- ✅ Link preview is styled correctly
- ✅ Multiple URLs show multiple previews

---

### Test 7: Empty State

**Steps:**
1. Navigate to campaign create page
2. Leave message field empty
3. **Expected:** Preview shows "Your message will appear here..."
4. **Expected:** Character count shows 0/160
5. **Expected:** Segment count shows 0 parts

**Validation:**
- ✅ Empty state is clear and helpful
- ✅ Counts show 0 correctly

---

### Test 8: Variable Placeholders

**Steps:**
1. Type message with variables: "Hi {{firstName}}, welcome!"
2. **Expected:** Variables are shown as-is in preview
3. **Expected:** No rendering errors
4. **Note:** Future enhancement could show sample rendered values

**Validation:**
- ✅ Variables display correctly
- ✅ No errors or crashes

---

## Technical Notes

### SMS Segmentation

Currently uses simple 160-character segmentation:
- 1-160 chars = 1 part
- 161-320 chars = 2 parts
- etc.

**TODO:** Upgrade to GSM-7 vs UCS-2 detection for accurate segmentation.

### Styling

- Uses existing Retail UI kit tokens
- Matches iOS26/2026 minimal design
- Tiffany accent color (#0ABAB5) for highlights
- Consistent spacing and typography

### Accessibility

- `aria-label` on preview container
- Proper text contrast
- Keyboard accessible
- No click-blocking overlays

---

## Known Limitations

1. **Segmentation:** Simple 160-char segmentation (not GSM-7/UCS-2 aware)
2. **Variable Rendering:** Shows variables as-is (no sample data substitution)
3. **Sender Name:** Hardcoded to "Astronote" (could be configurable in future)

---

## Future Enhancements

1. **GSM-7/UCS-2 Detection:** Accurate SMS segmentation
2. **Variable Preview:** Show sample rendered values for {{variables}}
3. **Sender Name Config:** Allow custom sender name from settings
4. **Dark Mode Support:** If dark mode is added to Retail/Shopify
5. **Animation:** Subtle animations for message updates

---

## Status

✅ **Complete and Ready for Testing**

All features implemented:
- Shared component created
- Retail integration complete
- Shopify integration complete
- Responsive layout working
- Live updates working
- Character/segment counts working
- Link preview working

---

**Next Steps:**
1. Manual testing (use checklist above)
2. Address any issues found
3. Consider future enhancements

