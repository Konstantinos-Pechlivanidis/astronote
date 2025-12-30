'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { contactSchema } from '@/src/lib/retail/validators';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/src/lib/retail/api/contacts';

interface ContactFormProps {
  contact?: Contact | null
  onSubmit: (_data: z.infer<typeof contactSchema>) => void
  isLoading?: boolean
}

export function ContactForm({ contact, onSubmit, isLoading }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema as any),
    defaultValues: contact
      ? {
        phone: contact.phone || '',
        email: contact.email || '',
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        gender: contact.gender || null,
        birthday: contact.birthday
          ? new Date(contact.birthday).toISOString().split('T')[0]
          : '',
        isSubscribed: contact.isSubscribed !== undefined ? contact.isSubscribed : true,
      }
      : {
        phone: '',
        email: '',
        firstName: '',
        lastName: '',
        gender: null,
        birthday: '',
        isSubscribed: true,
      },
  });

  const handleFormSubmit = (formData: z.infer<typeof contactSchema>) => {
    // Convert birthday to ISO string if provided, otherwise null
    const submitData = {
      ...formData,
      phone: formData.phone.trim(),
      email: formData.email || undefined,
      firstName: formData.firstName || undefined,
      lastName: formData.lastName || undefined,
      gender: formData.gender || null,
      birthday: formData.birthday ? new Date(formData.birthday).toISOString() : undefined,
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-text-secondary mb-1">
          Phone <span className="text-red-400">*</span>
        </label>
        <Input
          {...register('phone')}
          type="tel"
          id="phone"
          placeholder="+306912345678"
        />
        <p className="mt-1 text-xs text-text-tertiary">
          Enter in E.164 format (e.g., +306912345678)
        </p>
        {errors.phone && (
          <p className="mt-1 text-sm text-red-400">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
          Email
        </label>
        <Input
          {...register('email')}
          type="email"
          id="email"
          placeholder="contact@example.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-text-secondary mb-1">
            First Name
          </label>
          <Input
            {...register('firstName')}
            type="text"
            id="firstName"
            maxLength={120}
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-400">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-text-secondary mb-1">
            Last Name
          </label>
          <Input
            {...register('lastName')}
            type="text"
            id="lastName"
            maxLength={120}
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-400">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="gender" className="block text-sm font-medium text-text-secondary mb-1">
          Gender
        </label>
        <Select {...register('gender')} id="gender">
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
        {errors.gender && (
          <p className="mt-1 text-sm text-red-400">{errors.gender.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="birthday" className="block text-sm font-medium text-text-secondary mb-1">
          Birthday
        </label>
        <Input
          {...register('birthday')}
          type="date"
          id="birthday"
          max={new Date().toISOString().split('T')[0]}
        />
        <p className="mt-1 text-xs text-text-tertiary">
          Used for age-based filtering (18+ rule)
        </p>
        {errors.birthday && (
          <p className="mt-1 text-sm text-red-400">{errors.birthday.message}</p>
        )}
      </div>

      {contact && (
        <div>
          <label className="flex items-center gap-2">
            <input
              {...register('isSubscribed')}
              type="checkbox"
              className="w-4 h-4 text-accent border-border rounded focus:ring-accent"
            />
            <span className="text-sm font-medium text-text-secondary">Subscribed to SMS</span>
          </label>
          <p className="mt-1 text-xs text-text-tertiary">
            Uncheck to unsubscribe this contact
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          size="sm"
        >
          {isLoading ? 'Saving...' : contact ? 'Update Contact' : 'Create Contact'}
        </Button>
      </div>
    </form>
  );
}

