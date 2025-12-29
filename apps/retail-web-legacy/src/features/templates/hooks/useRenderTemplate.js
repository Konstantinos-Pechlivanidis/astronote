import { useMutation } from '@tanstack/react-query';
import { templatesApi } from '../../../api/modules/templates';

/**
 * Hook to render template with contact data (for preview)
 * @param {Object} options
 * @param {number} options.templateId - Template ID
 * @param {Object} options.contact - Contact data { firstName?, lastName?, email? }
 * @param {number} options.contactId - Optional, contact ID from DB
 */
export function useRenderTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, contact, contactId }) => {
      const data = contactId ? { contactId } : { contact };
      const res = await templatesApi.render(templateId, data);
      return res.data;
    },
  });
}

