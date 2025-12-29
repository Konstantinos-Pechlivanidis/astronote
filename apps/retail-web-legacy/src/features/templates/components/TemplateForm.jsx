import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { templateSchema } from '../../../lib/validators';

const CATEGORIES = [
  { value: 'generic', label: 'Generic' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gym', label: 'Gym' },
  { value: 'sports_club', label: 'Sports Club' },
  { value: 'hotels', label: 'Hotels' },
];

const SUPPORTED_PLACEHOLDERS = ['{{first_name}}', '{{last_name}}', '{{email}}'];

export default function TemplateForm({ template, onSubmit, isLoading, onCancel, systemUserId = 1 }) {
  const isSystem = template && template.ownerId === systemUserId;
  const isEdit = !!template && !isSystem;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(templateSchema),
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
  const foundPlaceholders = [];
  let match;
  while ((match = placeholderRegex.exec(textValue)) !== null) {
    const placeholder = `{{${match[1]}}}`;
    if (!foundPlaceholders.includes(placeholder)) {
      foundPlaceholders.push(placeholder);
    }
  }

  const unsupportedPlaceholders = foundPlaceholders.filter(
    (p) => !SUPPORTED_PLACEHOLDERS.includes(p.toLowerCase())
  );

  const handleFormSubmit = (data) => {
    // Check for unsupported placeholders
    if (unsupportedPlaceholders.length > 0) {
      // Show error - validation will prevent submit
      return;
    }

    const submitData = {
      ...data,
      name: data.name.trim(),
      text: data.text.trim(),
      goal: data.goal?.trim() || null,
      suggestedMetrics: data.suggestedMetrics?.trim() || null,
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Template Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register('name')}
          type="text"
          id="name"
          maxLength={200}
          disabled={isSystem}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="e.g., Welcome Message"
        />
        <p className="mt-1 text-xs text-gray-500">
          {watch('name')?.length || 0} / 200 characters
        </p>
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-1">
          Template Text <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('text')}
          id="text"
          rows={6}
          maxLength={2000}
          disabled={isSystem}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
          placeholder="Hello {{first_name}}! Welcome to our store."
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {textLength} / {maxTextLength} characters
          </p>
          {textLength > 160 && (
            <p className="text-xs text-yellow-600">
              ~{Math.ceil(textLength / 160)} SMS parts
            </p>
          )}
        </div>
        {errors.text && <p className="mt-1 text-sm text-red-600">{errors.text.message}</p>}
        {unsupportedPlaceholders.length > 0 && (
          <p className="mt-1 text-sm text-red-600">
            Unsupported placeholders: {unsupportedPlaceholders.join(', ')}. Supported:{' '}
            {SUPPORTED_PLACEHOLDERS.join(', ')}
          </p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-xs font-medium text-blue-900 mb-1">Supported Placeholders:</p>
        <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
          <li>
            <code className="bg-blue-100 px-1 rounded">{'{{first_name}}'}</code> - Contact's first
            name
          </li>
          <li>
            <code className="bg-blue-100 px-1 rounded">{'{{last_name}}'}</code> - Contact's last
            name
          </li>
          <li>
            <code className="bg-blue-100 px-1 rounded">{'{{email}}'}</code> - Contact's email
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            {...register('category')}
            id="category"
            disabled={isSystem}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
            Language
          </label>
          <select
            {...register('language')}
            id="language"
            disabled={isSystem}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="en">English</option>
            <option value="gr">Greek</option>
          </select>
          {errors.language && (
            <p className="mt-1 text-sm text-red-600">{errors.language.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-1">
          Goal (Optional)
        </label>
        <input
          {...register('goal')}
          type="text"
          id="goal"
          maxLength={200}
          disabled={isSystem}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="e.g., Welcome new customers"
        />
        <p className="mt-1 text-xs text-gray-500">
          {watch('goal')?.length || 0} / 200 characters
        </p>
        {errors.goal && <p className="mt-1 text-sm text-red-600">{errors.goal.message}</p>}
      </div>

      <div>
        <label htmlFor="suggestedMetrics" className="block text-sm font-medium text-gray-700 mb-1">
          Suggested Metrics (Optional)
        </label>
        <input
          {...register('suggestedMetrics')}
          type="text"
          id="suggestedMetrics"
          maxLength={500}
          disabled={isSystem}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="e.g., Open rate, click-through"
        />
        <p className="mt-1 text-xs text-gray-500">
          {watch('suggestedMetrics')?.length || 0} / 500 characters
        </p>
        {errors.suggestedMetrics && (
          <p className="mt-1 text-sm text-red-600">{errors.suggestedMetrics.message}</p>
        )}
      </div>

      {isSystem && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-sm text-yellow-800">
            This is a system template and cannot be edited. Use "Duplicate" to create your own
            copy.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        {!isSystem && (
          <button
            type="submit"
            disabled={isLoading || unsupportedPlaceholders.length > 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </button>
        )}
      </div>
    </form>
  );
}

