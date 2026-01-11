'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCreateContact } from '@/src/features/shopify/contacts/hooks/useContactMutations';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';

// Sentinel value for "Not specified" (must be non-empty for Radix Select)
const UI_NOT_SPECIFIED = '__not_specified__';

/**
 * Create Contact Page
 */
export default function NewContactPage() {
  const router = useRouter();
  const createContact = useCreateContact();

  const [formData, setFormData] = useState({
    phoneE164: '',
    firstName: '',
    lastName: '',
    email: '',
    gender: UI_NOT_SPECIFIED as 'male' | 'female' | 'other' | typeof UI_NOT_SPECIFIED,
    birthDate: '',
    smsConsent: 'unknown' as 'opted_in' | 'opted_out' | 'unknown',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Phone is required and must be E.164 format
    if (!formData.phoneE164.trim()) {
      newErrors.phoneE164 = 'Phone number is required';
    } else if (!/^\+[1-9]\d{1,14}$/.test(formData.phoneE164.trim())) {
      newErrors.phoneE164 = 'Phone number must be in E.164 format (e.g., +306977123456)';
    }

    // Email validation (optional but must be valid if provided)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Birth date validation (optional but must be valid if provided)
    if (formData.birthDate) {
      const birthDate = new Date(formData.birthDate);
      if (isNaN(birthDate.getTime())) {
        newErrors.birthDate = 'Invalid date';
      } else if (birthDate > new Date()) {
        newErrors.birthDate = 'Birth date cannot be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    try {
      const contactData: any = {
        phoneE164: formData.phoneE164.trim(),
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
        email: formData.email.trim() || null,
        gender: formData.gender || null,
        birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
        smsConsent: formData.smsConsent,
      };

      await createContact.mutateAsync(contactData);
      router.push('/app/shopify/contacts');
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/app/shopify/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <RetailPageHeader
            title="Create Contact"
            description="Add a new contact to your list"
          />
        </div>
      </div>

      <div className="max-w-2xl">
        <RetailCard className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Phone */}
            <div>
              <label htmlFor="phoneE164" className="mb-2 block text-sm font-medium text-text-secondary">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <Input
                id="phoneE164"
                type="tel"
                value={formData.phoneE164}
                onChange={(e) => setFormData({ ...formData, phoneE164: e.target.value })}
                placeholder="+306977123456"
                className={errors.phoneE164 ? 'border-red-400' : ''}
              />
              {errors.phoneE164 && (
                <p className="mt-1 text-sm text-red-400">{errors.phoneE164}</p>
              )}
              <p className="mt-1 text-xs text-text-tertiary">
                Must be in E.164 format (e.g., +306977123456)
              </p>
            </div>

            {/* First Name */}
            <div>
              <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-text-secondary">
                First Name
              </label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
                maxLength={100}
              />
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-text-secondary">
                Last Name
              </label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
                maxLength={100}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-text-secondary">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@example.com"
                className={errors.email ? 'border-red-400' : ''}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="gender" className="mb-2 block text-sm font-medium text-text-secondary">
                Gender
              </label>
              <Select
                value={formData.gender}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value as 'male' | 'female' | 'other' | typeof UI_NOT_SPECIFIED })
                }
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UI_NOT_SPECIFIED}>Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Birth Date */}
            <div>
              <label htmlFor="birthDate" className="mb-2 block text-sm font-medium text-text-secondary">
                Birth Date
              </label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className={errors.birthDate ? 'border-red-400' : ''}
              />
              {errors.birthDate && (
                <p className="mt-1 text-sm text-red-400">{errors.birthDate}</p>
              )}
            </div>

            {/* SMS Consent */}
            <div>
              <label htmlFor="smsConsent" className="mb-2 block text-sm font-medium text-text-secondary">
                SMS Consent
              </label>
              <Select
                value={formData.smsConsent}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    smsConsent: value as 'opted_in' | 'opted_out' | 'unknown',
                  })
                }
              >
                <SelectTrigger id="smsConsent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opted_in">Opted In</SelectItem>
                  <SelectItem value="opted_out">Opted Out</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Link href="/app/shopify/contacts">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createContact.isPending} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                {createContact.isPending ? 'Creating...' : 'Create Contact'}
              </Button>
            </div>
          </form>
        </RetailCard>
      </div>
    </div>
  );
}

