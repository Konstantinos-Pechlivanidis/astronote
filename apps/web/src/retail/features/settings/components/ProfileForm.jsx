import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileUpdateSchema } from '../../../lib/validators';
import { useUpdateUser } from '../api/settings.queries';
import { toast } from 'sonner';

// Common timezones for dropdown
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

export default function ProfileForm({ user }) {
  const updateMutation = useUpdateUser();
  const [isDirty, setIsDirty] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty: formIsDirty },
  } = useForm({
    resolver: zodResolver(profileUpdateSchema),
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

  const onSubmit = (data) => {
    // Only send fields that have values (or null to clear)
    const updateData = {};
    if (data.company !== undefined) {
      updateData.company = data.company || null;
    }
    if (data.senderName !== undefined) {
      updateData.senderName = data.senderName || null;
    }
    if (data.timezone !== undefined) {
      updateData.timezone = data.timezone || null;
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
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={user?.email || ''}
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
      </div>

      {/* Company */}
      <div>
        <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
          Company / Store Name
        </label>
        <input
          {...register('company')}
          type="text"
          id="company"
          maxLength={160}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            errors.company ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Your company or store name"
        />
        <p className="mt-1 text-xs text-gray-500">Max 160 characters</p>
        {errors.company && (
          <p className="mt-1 text-sm text-red-600">{errors.company.message}</p>
        )}
      </div>

      {/* Sender Name */}
      <div>
        <label htmlFor="senderName" className="block text-sm font-medium text-gray-700 mb-1">
          SMS Sender Name
        </label>
        <input
          {...register('senderName')}
          type="text"
          id="senderName"
          maxLength={11}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            errors.senderName ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="ASTRONOTE"
        />
        <p className="mt-1 text-xs text-gray-500">
          Max 11 characters, letters and numbers only. This appears as the sender name in SMS messages.
        </p>
        {errors.senderName && (
          <p className="mt-1 text-sm text-red-600">{errors.senderName.message}</p>
        )}
      </div>

      {/* Timezone */}
      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
          Timezone
        </label>
        <select
          {...register('timezone')}
          id="timezone"
          defaultValue={user?.timezone || ''}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            errors.timezone ? 'border-red-300' : 'border-gray-300'
          }`}
        >
          <option value="">Select timezone...</option>
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
          {user?.timezone && !COMMON_TIMEZONES.find((tz) => tz.value === user.timezone) && (
            <option value={user.timezone}>
              {user.timezone} (Current)
            </option>
          )}
        </select>
        {user?.timezone && !COMMON_TIMEZONES.find((tz) => tz.value === user.timezone) && (
          <p className="mt-1 text-xs text-amber-600">
            Your current timezone is not in the common list. You can keep it or select a new one.
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Used for scheduling campaigns. Format: Region/City (e.g., Europe/Athens)
        </p>
        {errors.timezone && (
          <p className="mt-1 text-sm text-red-600">{errors.timezone.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={!isDirty || updateMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

