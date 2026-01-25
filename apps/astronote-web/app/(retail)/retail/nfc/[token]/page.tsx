'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { useNfcInfo } from '@/src/features/retail/public/hooks/useNfcInfo';
import { useNfcSubmit } from '@/src/features/retail/public/hooks/useNfcSubmit';
import { Button } from '@/components/ui/button';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string;
  phoneNational: string;
  birthday: string;
  gender: string;
  gdprConsent: boolean;
};

const COUNTRY_STORAGE_KEY = 'retail_phone_country_code';

export default function NfcPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : null;
  const { data, isLoading, error } = useNfcInfo(token);
  const submitMutation = useNfcSubmit(token);

  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: '+30',
    phoneNational: '',
    birthday: '',
    gender: '',
    gdprConsent: true,
  });

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(COUNTRY_STORAGE_KEY) : null;
    const phoneDefaultCountry = data?.phoneDefaultCountry ?? '';
    if (saved) {
      setForm((f) => ({ ...f, phoneCountryCode: saved }));
    } else if (phoneDefaultCountry) {
      setForm((f) => ({ ...f, phoneCountryCode: `+${phoneDefaultCountry.replace('+', '')}` }));
    }
  }, [data?.phoneDefaultCountry]);

  const storeName = data?.storeName || 'The store';

  const handleChange = (key: keyof FormState, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'phoneCountryCode' && typeof value === 'string') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COUNTRY_STORAGE_KEY, value);
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const payload = {
      ...form,
      phoneCountryCode: form.phoneCountryCode || '+30',
      phoneNational: form.phoneNational,
      birthday: form.birthday || undefined,
      gender: form.gender || undefined,
    };

    await submitMutation.mutateAsync(payload);
  };

  if (!token) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError title="Invalid link" message="The NFC link is not valid." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (error || !data?.ok) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError title="Error" message="Store not found or NFC link inactive." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (submitMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Thank you!"
            message="The contact was added."
          />
          <div className="mt-4">
            <Button
              className="w-full bg-accent text-[#041b1f] hover:bg-accent-hover"
              onClick={() => submitMutation.reset()}
            >
              Add another number
            </Button>
          </div>
        </PublicCard>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCard>
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-text-secondary">Connect customer to {storeName}</p>
            <h1 className="text-2xl font-bold text-text-primary">Add contact details</h1>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3">
              <input
                required
                name="firstName"
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="First name"
                className="w-full rounded-md border border-border bg-surface px-3 py-3 text-base text-text-primary placeholder:text-text-tertiary"
                autoComplete="given-name"
              />
              <input
                name="lastName"
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder="Last name (optional)"
                className="w-full rounded-md border border-border bg-surface px-3 py-3 text-base text-text-primary placeholder:text-text-tertiary"
                autoComplete="family-name"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  name="phoneCountryCode"
                  value={form.phoneCountryCode}
                  onChange={(e) => handleChange('phoneCountryCode', e.target.value)}
                  className="col-span-1 rounded-md border border-border bg-surface px-3 py-3 text-base text-text-primary placeholder:text-text-tertiary"
                  autoComplete="tel-country-code"
                  inputMode="tel"
                />
                <input
                  required
                  name="phoneNational"
                  value={form.phoneNational}
                  onChange={(e) => handleChange('phoneNational', e.target.value)}
                  placeholder="Mobile number"
                  className="col-span-2 rounded-md border border-border bg-surface px-3 py-3 text-base text-text-primary placeholder:text-text-tertiary"
                  autoComplete="tel-national"
                  inputMode="tel"
                />
              </div>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-md border border-border bg-surface px-3 py-3 text-base text-text-primary placeholder:text-text-tertiary"
                autoComplete="email"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="birthday"
                  type="date"
                  value={form.birthday}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleChange('birthday', e.target.value)}
                  placeholder="Birthday"
                  className="w-full rounded-md border border-border bg-surface px-3 py-3 text-base text-text-primary placeholder:text-text-tertiary"
                  autoComplete="bday"
                />
                <select
                  name="gender"
                  value={form.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-3 text-base text-text-primary"
                >
                  <option value="">Select gender (optional)</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.gdprConsent}
                  onChange={(e) => handleChange('gdprConsent', e.target.checked)}
                  className="mt-1"
                  required
                />
                <span>
                  I agree to store my details for communication (GDPR).
                </span>
              </label>
            </div>
            <Button
              type="submit"
              className="w-full bg-accent text-[#041b1f] hover:bg-accent-hover"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Sending…' : 'Submit'}
            </Button>
            {submitMutation.error && (
              <p className="text-sm text-red-300">
                {(submitMutation.error as any)?.response?.data?.message || 'Something went wrong. Please try again.'}
              </p>
            )}
          </form>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}
