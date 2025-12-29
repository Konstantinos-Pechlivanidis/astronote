import api from '../axios';
import { endpoints } from '../endpoints';

export const templatesApi = {
  /**
   * List templates (system + user's custom templates)
   * @param {Object} params - Query parameters
   * @param {string} params.language - Required: "en" or "gr"
   * @param {number} params.page - Optional, default 1
   * @param {number} params.pageSize - Optional, default 50, max 100
   * @param {string} params.q - Optional, search by name
   * @param {string} params.category - Optional, filter by category
   */
  list: (params) => {
    // Language is required by backend
    if (!params.language) {
      params.language = 'en'; // Default to English
    }
    return api.get(endpoints.templates.list, { params });
  },

  /**
   * Get single template (system or user's own)
   * @param {number} id - Template ID
   */
  get: (id) => api.get(endpoints.templates.detail(id)),

  /**
   * Create custom template (user's own)
   * @param {Object} data - Template data
   * @param {string} data.name - Required, max 200 chars
   * @param {string} data.text - Required, max 2000 chars
   * @param {string} data.category - Optional, default "generic"
   * @param {string} data.goal - Optional, max 200 chars
   * @param {string} data.suggestedMetrics - Optional, max 500 chars
   * @param {string} data.language - Optional, default "en"
   */
  create: (data) => api.post(endpoints.templates.create, data),

  /**
   * Update custom template (user's own only)
   * @param {number} id - Template ID
   * @param {Object} data - Template data (all fields optional)
   */
  update: (id, data) => api.put(endpoints.templates.update(id), data),

  /**
   * Delete custom template (user's own only)
   * @param {number} id - Template ID
   */
  delete: (id) => api.delete(endpoints.templates.delete(id)),

  /**
   * Render template with contact data (preview)
   * @param {number} id - Template ID
   * @param {Object} data - Contact data
   * @param {number} data.contactId - Optional, contact ID from DB
   * @param {Object} data.contact - Optional, contact object { firstName, lastName, email }
   */
  render: (id, data) => api.post(endpoints.templates.render(id), data),

  /**
   * Get template statistics (benchmark stats for system templates)
   * @param {number} id - Template ID
   */
  getStats: (id) => api.get(endpoints.templates.stats(id)),
};

