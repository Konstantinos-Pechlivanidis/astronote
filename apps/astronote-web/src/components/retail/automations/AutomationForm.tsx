'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { automationMessageSchema } from '@/src/lib/retail/validators';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { Automation } from '@/src/lib/retail/api/automations';

interface AutomationFormProps {
  automation?: Automation | null
  onSubmit: (_data: z.infer<typeof automationMessageSchema>) => void
  isSubmitting?: boolean
  onCancel?: () => void
}

export function AutomationForm({ automation, onSubmit, isSubmitting, onCancel }: AutomationFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof automationMessageSchema>>({
    resolver: zodResolver(automationMessageSchema as any),
    mode: 'onChange',
    defaultValues: {
      messageBody: automation?.messageBody || '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="messageBody" className="block text-sm font-medium text-text-secondary mb-1">
          Message Text <span className="text-red-400">*</span>
        </label>
        <Textarea
          {...register('messageBody')}
          id="messageBody"
          rows={6}
          maxLength={2000}
          placeholder="Enter your automation message. Use {{first_name}} for personalization."
        />
        <p className="mt-1 text-xs text-text-tertiary">
          Max 2000 characters. Use variables like {'{{'}first_name{'}}'} for personalization.
        </p>
        {errors.messageBody && (
          <p className="mt-1 text-sm text-red-400">{errors.messageBody.message}</p>
        )}
      </div>

      {/* Placeholder info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs font-medium text-blue-900 mb-1">Available placeholders:</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• {'{{'}first_name{'}}'} - Contact&apos;s first name</li>
          <li>• {'{{'}last_name{'}}'} - Contact&apos;s last name</li>
          <li>• {'{{'}email{'}}'} - Contact&apos;s email</li>
        </ul>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        {onCancel && (
          <Button type="button" onClick={onCancel} disabled={isSubmitting} variant="outline" size="sm">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

