'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLayout as PublicPreviewLayout } from '@/src/components/retail/public/PublicLayout';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { useBranding, useSaveBranding } from '@/src/features/retail/settings/hooks/useBranding';
import { usePublicLinks } from '@/src/features/retail/contacts/hooks/usePublicLinks';

const LANDING_PAGE_URL = process.env.NEXT_PUBLIC_LANDING_PAGE_URL || 'https://astronote.app';

export default function BrandingPage() {
  const { data, refetch } = useBranding();
  const save = useSaveBranding();
  const { data: links } = usePublicLinks();
  const joinUrl = links?.canonicalJoinUrl || links?.joinUrl || '';
  const [benefitsInput, setBenefitsInput] = useState<string>('');
  const [form, setForm] = useState({
    storeName: '',
    storeDisplayName: '',
    logoUrl: '',
    primaryColor: '',
    accentColor: '',
    backgroundStyle: '',
    headline: '',
    subheadline: '',
    incentiveText: '',
    legalText: '',
    privacyUrl: '',
    termsUrl: '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        storeName: data.storeName || '',
        storeDisplayName: (data as any).storeDisplayName || data.storeName || '',
        logoUrl: data.logoUrl || '',
        primaryColor: data.primaryColor || '',
        accentColor: data.accentColor || '',
        backgroundStyle: data.backgroundStyle || '',
        headline: data.headline || '',
        subheadline: (data as any).subheadline || '',
        incentiveText: (data as any).incentiveText || '',
        legalText: (data as any).legalText || '',
        privacyUrl: data.privacyUrl || '',
        termsUrl: data.termsUrl || '',
      });
      const benefits = (data as any).benefitsJson || data.benefits || [];
      if (benefits && Array.isArray(benefits)) {
        setBenefitsInput(benefits.join('\n'));
      }
    }
  }, [data]);

  const benefits = useMemo(() => {
    return benefitsInput
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [benefitsInput]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({
      ...form,
      benefits,
    });
    refetch();
  };

  const previewBranding = {
    ...form,
    storeName: form.storeDisplayName || form.storeName,
    benefits,
    incentiveText: form.incentiveText,
    privacyUrl: form.privacyUrl,
  };

  return (
    <RetailPageLayout>
      <RetailPageHeader
        title="Join Page / NFC Branding"
        description="Customize the public join page shown to your customers."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <RetailCard>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-text-secondary">Store name</label>
                <Input
                  value={form.storeName}
                  onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary">Display name</label>
                <Input
                  value={form.storeDisplayName}
                  onChange={(e) => setForm((f) => ({ ...f, storeDisplayName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-text-secondary">Logo URL</label>
              <Input
                value={form.logoUrl}
                onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-text-secondary">Primary color (hex)</label>
                <Input
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary">Accent color (hex)</label>
                <Input
                  value={form.accentColor}
                  onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-text-secondary">Headline</label>
                <Input
                  value={form.headline}
                  onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary">Subheadline</label>
                <Input
                  value={form.subheadline}
                  onChange={(e) => setForm((f) => ({ ...f, subheadline: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-text-secondary">Benefits (3–5, one per line)</label>
              <Textarea
                value={benefitsInput}
                onChange={(e) => setBenefitsInput(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm text-text-secondary">Incentive text</label>
              <Textarea
                value={form.incentiveText}
                onChange={(e) => setForm((f) => ({ ...f, incentiveText: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm text-text-secondary">Legal text / GDPR note</label>
              <Textarea
                value={form.legalText}
                onChange={(e) => setForm((f) => ({ ...f, legalText: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-text-secondary">Privacy URL</label>
                <Input
                  value={form.privacyUrl}
                  onChange={(e) => setForm((f) => ({ ...f, privacyUrl: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary">Terms URL</label>
                <Input
                  value={form.termsUrl}
                  onChange={(e) => setForm((f) => ({ ...f, termsUrl: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" type="button" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
            {joinUrl && (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-text-secondary">Join link</div>
                <div className="rounded-md border border-border bg-surface-light p-3 text-sm break-all">
                  {joinUrl}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(joinUrl)}
                  >
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(joinUrl, '_blank')}
                  >
                    Open
                  </Button>
                </div>
              </div>
            )}
          </form>
        </RetailCard>

        <RetailCard className="bg-surface-light">
          <div className="text-sm text-text-secondary mb-3">Live preview</div>
          <div className="border border-border rounded-lg overflow-hidden">
            <PublicPreviewLayout>
              <div className="p-4 bg-background">
                <PublicCard>
                  <div className="space-y-3 text-center">
                    {previewBranding.logoUrl ? (
                      <img src={previewBranding.logoUrl} alt={previewBranding.storeName} className="mx-auto h-12 object-contain" />
                    ) : null}
                    <p className="text-sm text-text-secondary">{previewBranding.storeName || 'Το κατάστημα'}</p>
                    <h3 className="text-xl font-semibold text-text-primary">
                      {previewBranding.headline || 'Πάρε πρώτος τις προσφορές μας'}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {previewBranding.subheadline || 'Άφησε τα στοιχεία σου για να λαμβάνεις αποκλειστικές προσφορές & ενημερώσεις.'}
                    </p>
                    <div className="text-left space-y-1">
                      <p className="text-sm font-medium text-text-primary">Τι κερδίζεις</p>
                      <ul className="text-sm text-text-secondary space-y-1">
                        {(previewBranding.benefits || []).map((b: string, idx: number) => (
                          <li key={idx}>• {b}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-xs text-text-tertiary">
                      Provided by <a className="underline" href={LANDING_PAGE_URL} target="_blank" rel="noreferrer">Astronote</a>
                    </p>
                  </div>
                </PublicCard>
              </div>
            </PublicPreviewLayout>
          </div>
        </RetailCard>
      </div>
    </RetailPageLayout>
  );
}
