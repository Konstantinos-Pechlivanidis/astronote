'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { templateSchema } from '@/src/lib/retail/validators';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import type { Template } from '@/src/lib/retail/api/templates';

const CATEGORIES = [
  { value: 'generic', label: 'Generic' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gym', label: 'Gym' },
  { value: 'sports_club', label: 'Sports Club' },
  { value: 'hotels', label: 'Hotels' },
];

const SUPPORTED_PLACEHOLDERS = ['{{first_name}}', '{{last_name}}', '{{email}}'];

interface TemplateFormProps {
  template?: Template | null
  onSubmit: (_data: z.infer<typeof templateSchema>) => void
  isLoading?: boolean
  systemUserId?: number
}

export function TemplateForm({ template, onSubmit, isLoading, systemUserId = 1 }: TemplateFormProps) {
  const isSystem = !!(template && template.ownerId === systemUserId);
  const isEdit = !!template && !isSystem;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema as any),
    defaultValues: template
      ? {
        name: template.name || '',
        text: template.text || '',
        category: template.category || 'generic',
        goal: template.goal || '',
        suggestedMetrics: template.suggestedMetrics || '',
        language: template.language || 'en',
      }
      : {
        name: '',
        text: '',
        category: 'generic',
        goal: '',
        suggestedMetrics: '',
        language: 'en',
      },
  });

  const textValue = watch('text') || '';
  const textLength = textValue.length;
  const maxTextLength = 2000;

  // Client-side placeholder validation
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  const foundPlaceholders: string[] = [];
  let match;
  while ((match = placeholderRegex.exec(textValue)) !== null) {
    const placeholder = `{{${match[1]}}}`;
    if (!foundPlaceholders.includes(placeholder)) {
      foundPlaceholders.push(placeholder);
    }
  }

  const unsupportedPlaceholders = foundPlaceholders.filter(
    (p) => !SUPPORTED_PLACEHOLDERS.includes(p.toLowerCase()),
  );

  const handleFormSubmit = (formData: z.infer<typeof templateSchema>) => {
    if (unsupportedPlaceholders.length > 0) {
      return;
    }

    const submitData = {
      ...formData,
      name: formData.name.trim(),
      text: formData.text.trim(),
      goal: formData.goal?.trim() || undefined,
      suggestedMetrics: formData.suggestedMetrics?.trim() || undefined,
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">
          Template Name <span className="text-red-400">*</span>
        </label>
        <Input
          {...register('name')}
          type="text"
          id="name"
          maxLength={200}
          disabled={isSystem}
          placeholder="e.g., Welcome Message"
        />
        <p className="mt-1 text-xs text-text-tertiary">
          {watch('name')?.length || 0} / 200 characters
        </p>
        {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="text" className="block text-sm font-medium text-text-secondary mb-1">
          Template Text <span className="text-red-400">*</span>
        </label>
        <Textarea
          {...register('text')}
          id="text"
          rows={6}
          maxLength={2000}
          disabled={isSystem}
          placeholder="Hello {{first_name}}! Welcome to our store."
          className="font-mono text-sm"
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-text-tertiary">
            {textLength} / {maxTextLength} characters
          </p>
          {textLength > 160 && (
            <p className="text-xs text-yellow-400">~{Math.ceil(textLength / 160)} SMS parts</p>
          )}
        </div>
        {errors.text && <p className="mt-1 text-sm text-red-400">{errors.text.message}</p>}
        {unsupportedPlaceholders.length > 0 && (
          <p className="mt-1 text-sm text-red-400">
            Unsupported placeholders: {unsupportedPlaceholders.join(', ')}. Supported:{' '}
            {SUPPORTED_PLACEHOLDERS.join(', ')}
          </p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-xs font-medium text-blue-900 mb-1">Supported Placeholders:</p>
        <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
          <li>
            <code className="bg-blue-100 px-1 rounded">{'{{first_name}}'}</code> - Contact&apos;s first name
          </li>
          <li>
            <code className="bg-blue-100 px-1 rounded">{'{{last_name}}'}</code> - Contact&apos;s last name
          </li>
          <li>
            <code className="bg-blue-100 px-1 rounded">{'{{email}}'}</code> - Contact&apos;s email
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-text-secondary mb-1">
            Category
          </label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange} disabled={isSystem}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && (
            <p className="mt-1 text-sm text-red-400">{errors.category.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="language" className="block text-sm font-medium text-text-secondary mb-1">
            Language
          </label>
          <Controller
            name="language"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange} disabled={isSystem}>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="gr">Greek</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.language && (
            <p className="mt-1 text-sm text-red-400">{errors.language.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="goal" className="block text-sm font-medium text-text-secondary mb-1">
          Goal (Optional)
        </label>
        <Input
          {...register('goal')}
          type="text"
          id="goal"
          maxLength={200}
          disabled={isSystem}
          placeholder="e.g., Welcome new customers"
        />
        <p className="mt-1 text-xs text-text-tertiary">
          {watch('goal')?.length || 0} / 200 characters
        </p>
        {errors.goal && <p className="mt-1 text-sm text-red-400">{errors.goal.message}</p>}
      </div>

      <div>
        <label htmlFor="suggestedMetrics" className="block text-sm font-medium text-text-secondary mb-1">
          Suggested Metrics (Optional)
        </label>
        <Input
          {...register('suggestedMetrics')}
          type="text"
          id="suggestedMetrics"
          maxLength={500}
          disabled={isSystem}
          placeholder="e.g., Open rate, click-through"
        />
        <p className="mt-1 text-xs text-text-tertiary">
          {watch('suggestedMetrics')?.length || 0} / 500 characters
        </p>
        {errors.suggestedMetrics && (
          <p className="mt-1 text-sm text-red-400">{errors.suggestedMetrics.message}</p>
        )}
      </div>

      {isSystem && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            This is a system template and cannot be edited. Use &quot;Duplicate&quot; to create your own copy.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        {!isSystem && (
          <Button
            type="submit"
            disabled={isLoading || unsupportedPlaceholders.length > 0}
            size="sm"
          >
            {isLoading ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </Button>
        )}
      </div>
    </form>
  );
}

