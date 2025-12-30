import { useMutation } from '@tanstack/react-query';
import { templatesApi, type TemplateRenderParams } from '@/src/lib/retail/api/templates';

export function useRenderTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, contactId, contact }: { templateId: number; contactId?: number; contact?: TemplateRenderParams['contact'] }) => {
      const params: TemplateRenderParams = {};
      if (contactId) {
        params.contactId = contactId;
      }
      if (contact) {
        params.contact = contact;
      }
      const res = await templatesApi.render(templateId, params);
      return res.data;
    },
  });
}

