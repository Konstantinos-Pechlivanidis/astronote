'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { useJoinInfo } from '@/src/features/retail/public/hooks/useJoinInfo';
import { useJoinSubmit } from '@/src/features/retail/public/hooks/useJoinSubmit';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string;
  phoneNational: string;
};

const COUNTRY_KEY = 'retail_phone_cc';

export default function JoinPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : null;
  const info = useJoinInfo(token);
  const submit = useJoinSubmit(token);
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: '+30',
    phoneNational: '',
  });

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(COUNTRY_KEY) : null;
    const def = info.data?.defaults?.phoneCountryCode || '+30';
    setForm((f) => ({ ...f, phoneCountryCode: saved || def }));
  }, [info.data?.defaults?.phoneCountryCode]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'phoneCountryCode') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COUNTRY_KEY, value);
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit.mutateAsync({
      ...form,
      phoneCountryCode: form.phoneCountryCode || '+30',
      phoneNational: form.phoneNational,
    });
  };

  if (!token) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError title="Invalid link" message="This join link is invalid." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (info.isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (info.error || !info.data?.ok) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError title="Not available" message="This join link is inactive or invalid." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (submit.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Ευχαριστούμε!"
            message="Εγγραφήκατε με επιτυχία."
          />
          <div className="mt-4 text-center text-xs text-text-secondary">
            Provided by Astronote
          </div>
        </PublicCard>
      </PublicLayout>
    );
  }

  const branding = info.data.branding || {};

  return (
    <PublicLayout>
      <PublicCard>
        <div className="space-y-6">
          <div className="text-center space-y-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.storeName} className="mx-auto h-12 object-contain" />
            ) : null}
            <p className="text-sm text-text-secondary">{branding.storeName}</p>
            <h1 className="text-2xl font-bold text-text-primary">
              {branding.headline || 'Εγγραφή για προσφορές'}
            </h1>
            {branding.benefits && Array.isArray(branding.benefits) ? (
              <ul className="text-sm text-text-secondary space-y-1">
                {branding.benefits.slice(0, 5).map((b: any, idx: number) => (
                  <li key={idx}>• {b}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              required
              name="firstName"
              value={form.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="Όνομα"
              className="w-full rounded-md border border-border bg-surface-light px-3 py-3 text-base"
              autoComplete="given-name"
            />
            <input
              name="lastName"
              value={form.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Επώνυμο (προαιρετικό)"
              className="w-full rounded-md border border-border bg-surface-light px-3 py-3 text-base"
              autoComplete="family-name"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                name="phoneCountryCode"
                value={form.phoneCountryCode}
                onChange={(e) => handleChange('phoneCountryCode', e.target.value)}
                className="col-span-1 rounded-md border border-border bg-surface-light px-3 py-3 text-base"
                inputMode="tel"
                autoComplete="tel-country-code"
              />
              <input
                required
                name="phoneNational"
                value={form.phoneNational}
                onChange={(e) => handleChange('phoneNational', e.target.value)}
                placeholder="Κινητό"
                className="col-span-2 rounded-md border border-border bg-surface-light px-3 py-3 text-base"
                inputMode="tel"
                autoComplete="tel-national"
              />
            </div>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Email (προαιρετικό)"
              className="w-full rounded-md border border-border bg-surface-light px-3 py-3 text-base"
              autoComplete="email"
            />
            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? 'Αποστολή...' : 'Εγγραφή & Λήψη Προσφορών'}
            </Button>
            {submit.error && (
              <p className="text-sm text-red-500">
                {(submit.error as any)?.response?.data?.message || 'Κάτι πήγε στραβά.'}
              </p>
            )}
          </form>
          <div className="text-center text-xs text-text-secondary">
            Provided by Astronote
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}
