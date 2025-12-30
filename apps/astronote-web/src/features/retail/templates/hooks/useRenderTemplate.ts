import { useMutation } from '@tanstack/react-query';
import { templatesApi, type TemplateRenderParams } from '@/src/lib/retail/api/templates';

export function useRenderTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, contact }: { templateId: number; contact: TemplateRenderParams['contact'] }) => {
      const res = await templatesApi.render(templateId, { contact });
      return res.data;
    },
  });
}

