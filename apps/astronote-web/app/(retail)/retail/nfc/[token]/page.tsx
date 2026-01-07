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

  const storeName = data?.storeName || 'Το κατάστημα';

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
    await submitMutation.mutateAsync({
      ...form,
      phoneCountryCode: form.phoneCountryCode || '+30',
      phoneNational: form.phoneNational,
    });
  };

  if (!token) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError title="Μη έγκυρος σύνδεσμος" message="Το NFC link δεν είναι έγκυρο." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Φόρτωση..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (error || !data?.ok) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError title="Σφάλμα" message="Δεν βρέθηκε το κατάστημα ή το NFC link είναι ανενεργό." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (submitMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Ευχαριστούμε!"
            message="Η εγγραφή ολοκληρώθηκε."
          />
          <div className="mt-4">
            <Button className="w-full" onClick={() => submitMutation.reset()}>
              Καταχώριση νέου αριθμού
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
            <p className="text-sm text-text-secondary">Σύνδεση πελάτη στο {storeName}</p>
            <h1 className="text-2xl font-bold text-text-primary">Καταχώριση στοιχείων</h1>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3">
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
                  autoComplete="tel-country-code"
                  inputMode="tel"
                />
                <input
                  required
                  name="phoneNational"
                  value={form.phoneNational}
                  onChange={(e) => handleChange('phoneNational', e.target.value)}
                  placeholder="Κινητό"
                  className="col-span-2 rounded-md border border-border bg-surface-light px-3 py-3 text-base"
                  autoComplete="tel-national"
                  inputMode="tel"
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
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.gdprConsent}
                  onChange={(e) => handleChange('gdprConsent', e.target.checked)}
                  className="mt-1"
                  required
                />
                <span>
                  Συμφωνώ με την αποθήκευση των στοιχείων μου για επικοινωνία (GDPR).
                </span>
              </label>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Αποστολή…' : 'Συνέχεια'}
            </Button>
            {submitMutation.error && (
              <p className="text-sm text-red-500">
                {(submitMutation.error as any)?.response?.data?.message || 'Κάτι πήγε στραβά. Προσπαθήστε ξανά.'}
              </p>
            )}
          </form>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}
