'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { profileUpdateSchema } from '@/src/lib/retail/validators';
import { useUpdateUser } from '@/src/features/retail/settings/hooks/useUpdateUser';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import type { RetailUser } from '@/src/features/retail/auth/useRetailAuth';

const COMMON_TIMEZONES = [
  { value: 'Europe/Athens', label: 'Europe/Athens (Greece)' },
  { value: 'Europe/London', label: 'Europe/London (UK)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (France)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (Germany)' },
  { value: 'America/New_York', label: 'America/New_York (US Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (US Central)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (US Pacific)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UAE)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Japan)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (Australia)' },
];

interface ProfileFormProps {
  user?: RetailUser | null
}

export function ProfileForm({ user }: ProfileFormProps) {
  const updateMutation = useUpdateUser();
  const [isDirty, setIsDirty] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty: formIsDirty },
  } = useForm<z.infer<typeof profileUpdateSchema>>({
    resolver: zodResolver(profileUpdateSchema as any),
    mode: 'onChange',
    defaultValues: {
      company: user?.company || '',
      senderName: user?.senderName || '',
      timezone: user?.timezone || '',
    },
  });

  // Track if form is dirty
  useEffect(() => {
    setIsDirty(formIsDirty);
  }, [formIsDirty]);

  // Reset form when user data changes
  useEffect(() => {
    if (user) {
      reset({
        company: user.company || '',
        senderName: user.senderName || '',
        timezone: user.timezone || '',
      });
    }
  }, [user, reset]);

  const onSubmit = (formData: z.infer<typeof profileUpdateSchema>) => {
    // Only send fields that have values (or null to clear)
    const updateData: Record<string, string | null> = {};
    if (formData.company !== undefined) {
      updateData.company = formData.company || null;
    }
    if (formData.senderName !== undefined) {
      updateData.senderName = formData.senderName || null;
    }
    if (formData.timezone !== undefined) {
      updateData.timezone = formData.timezone || null;
    }

    updateMutation.mutate(updateData, {
      onSuccess: () => {
        setIsDirty(false);
      },
    });
  };

  const timezoneValue = watch('timezone');
  const isCustomTimezone = timezoneValue && !COMMON_TIMEZONES.find((tz) => tz.value === timezoneValue);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Email (read-only) */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
          Email
        </label>
        <Input
          type="email"
          id="email"
          value={user?.email || ''}
          disabled
          className="bg-surface-light text-text-tertiary cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-text-tertiary">Email cannot be changed</p>
      </div>

      {/* Company */}
      <div>
        <label htmlFor="company" className="block text-sm font-medium text-text-secondary mb-1">
          Company / Store Name
        </label>
        <Input
          {...register('company')}
          type="text"
          id="company"
          maxLength={160}
          placeholder="Your company or store name"
        />
        <p className="mt-1 text-xs text-text-tertiary">Max 160 characters</p>
        {errors.company && (
          <p className="mt-1 text-sm text-red-400">{errors.company.message}</p>
        )}
      </div>

      {/* Sender Name */}
      <div>
        <label htmlFor="senderName" className="block text-sm font-medium text-text-secondary mb-1">
          SMS Sender Name
        </label>
        <Input
          {...register('senderName')}
          type="text"
          id="senderName"
          maxLength={11}
          placeholder="ASTRONOTE"
        />
        <p className="mt-1 text-xs text-text-tertiary">
          Max 11 characters, letters and numbers only. This appears as the sender name in SMS messages.
        </p>
        {errors.senderName && (
          <p className="mt-1 text-sm text-red-400">{errors.senderName.message}</p>
        )}
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-text-secondary mb-1">
          Timezone
        </label>
        <Controller
          name="timezone"
          control={control}
          defaultValue={user?.timezone || ''}
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={(value) => {
                // Handle clearing selection - set to empty string if value is undefined
                field.onChange(value || '');
              }}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone..." />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
                {user?.timezone && !COMMON_TIMEZONES.find((tz) => tz.value === user.timezone) && (
                  <SelectItem value={user.timezone}>{user.timezone} (Current)</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        />
        {isCustomTimezone && (
          <p className="mt-1 text-xs text-amber-400">
            Your current timezone is not in the common list. You can keep it or select a new one.
          </p>
        )}
        <p className="mt-1 text-xs text-text-tertiary">
          Used for scheduling campaigns. Format: Region/City (e.g., Europe/Athens)
        </p>
        {errors.timezone && (
          <p className="mt-1 text-sm text-red-400">{errors.timezone.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button type="submit" disabled={!isDirty || updateMutation.isPending} size="sm">
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

