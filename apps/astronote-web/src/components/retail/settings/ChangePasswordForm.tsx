'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { passwordChangeSchema } from '@/src/lib/retail/validators';
import { useChangePassword } from '@/src/features/retail/settings/hooks/useChangePassword';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export function ChangePasswordForm() {
  const changePasswordMutation = useChangePassword();
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema as any),
    mode: 'onChange',
  });

  const onSubmit = (formData: z.infer<typeof passwordChangeSchema>) => {
    changePasswordMutation.mutate(
      {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      },
      {
        onSuccess: () => {
          reset(); // Clear form on success
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Current Password */}
      <div>
        <label htmlFor="oldPassword" className="block text-sm font-medium text-text-secondary mb-1">
          Current Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Input
            {...register('currentPassword')}
            type={showOldPassword ? 'text' : 'password'}
            id="oldPassword"
            placeholder="Enter your current password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowOldPassword(!showOldPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.currentPassword && (
          <p className="mt-1 text-sm text-red-400">{errors.currentPassword.message}</p>
        )}
      </div>

      {/* New Password */}
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary mb-1">
          New Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Input
            {...register('newPassword')}
            type={showNewPassword ? 'text' : 'password'}
            id="newPassword"
            placeholder="Enter your new password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">Must be at least 8 characters</p>
        {errors.newPassword && (
          <p className="mt-1 text-sm text-red-400">{errors.newPassword.message}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1">
          Confirm New Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Input
            {...register('confirmPassword')}
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            placeholder="Confirm your new password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Error Display */}
      {changePasswordMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-400">
            {(changePasswordMutation.error as any)?.response?.data?.message ||
              'Failed to change password. Please try again.'}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button type="submit" disabled={changePasswordMutation.isPending} size="sm">
          {changePasswordMutation.isPending ? 'Changing Password...' : 'Change Password'}
        </Button>
      </div>
    </form>
  );
}

