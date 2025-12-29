import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { automationMessageSchema } from '../../../lib/validators';

export default function AutomationForm({ automation, onSubmit, isSubmitting, onCancel }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(automationMessageSchema),
    mode: 'onChange',
    defaultValues: {
      messageBody: automation?.messageBody || '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="messageBody" className="block text-sm font-medium text-gray-700 mb-1">
          Message Text <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('messageBody')}
          id="messageBody"
          rows={6}
          maxLength={500}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            errors.messageBody ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter your automation message. Use {{first_name}} for personalization."
        />
        <p className="mt-1 text-xs text-gray-500">
          Max 500 characters. Use variables like {'{{'}first_name{'}}'} for personalization.
        </p>
        {errors.messageBody && (
          <p className="mt-1 text-sm text-red-600">{errors.messageBody.message}</p>
        )}
      </div>

      {/* Placeholder info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs font-medium text-blue-900 mb-1">Available placeholders:</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• {'{{'}first_name{'}}'} - Contact's first name</li>
          <li>• {'{{'}last_name{'}}'} - Contact's last name</li>
          <li>• {'{{'}email{'}}'} - Contact's email</li>
        </ul>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

