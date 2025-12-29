/**
 * Audience filter normalization utilities
 * Ensures frontend values match backend enum expectations
 */

/**
 * Normalize gender filter value to backend format
 * @param {string|null|undefined} value - Gender value from UI
 * @returns {string|null} Normalized value or null
 */
export function normalizeGender(value) {
  if (!value || value === '' || value === 'any') {
    return null;
  }
  
  // Backend expects: "male", "female", "other"
  const normalized = value.toLowerCase().trim();
  
  if (['male', 'female', 'other'].includes(normalized)) {
    return normalized;
  }
  
  // Fallback: return null if invalid
  return null;
}

/**
 * Normalize age group filter value to backend format
 * @param {string|null|undefined} value - Age group value from UI
 * @returns {string|null} Normalized value or null
 */
export function normalizeAgeGroup(value) {
  if (!value || value === '' || value === 'any') {
    return null;
  }
  
  // Backend expects: "18_24", "25_39", "40_plus"
  const normalized = value.toLowerCase().trim();
  
  // Handle variations
  if (normalized === '18-24' || normalized === '18_24') {
    return '18_24';
  }
  if (normalized === '25-39' || normalized === '25_39') {
    return '25_39';
  }
  if (normalized === '40+' || normalized === '40_plus' || normalized === '40-plus') {
    return '40_plus';
  }
  
  // Fallback: return null if invalid
  return null;
}

/**
 * Prepare filters payload for preview-audience endpoint
 * @param {Object} filters - Filter object from form
 * @param {string|null} filters.filterGender - Gender filter
 * @param {string|null} filters.filterAgeGroup - Age group filter
 * @param {string|null} filters.nameSearch - Name search (optional)
 * @returns {Object} Normalized payload
 */
export function preparePreviewPayload(filters) {
  return {
    filterGender: normalizeGender(filters?.filterGender),
    filterAgeGroup: normalizeAgeGroup(filters?.filterAgeGroup),
    nameSearch: filters?.nameSearch || null,
  };
}

