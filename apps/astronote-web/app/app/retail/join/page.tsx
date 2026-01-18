'use client';
/* eslint-disable @next/next/no-img-element */

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  ImageUp,
  Link2,
  Palette,
  QrCode,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import {
  useJoinBranding,
  useSaveJoinBranding,
  useUploadJoinLogo,
  useUploadJoinOgImage,
  useDeleteJoinLogo,
  useDeleteJoinOgImage,
} from '@/src/features/retail/settings/hooks/useJoinBranding';
import {
  usePublicLinks,
  useRotatePublicLinks,
} from '@/src/features/retail/contacts/hooks/usePublicLinks';
import { ColorPickerModal } from '@/src/components/retail/join/ColorPickerModal';

const COLOR_PRESETS = [
  '#111827',
  '#1F2937',
  '#4B5563',
  '#3B82F6',
  '#22C55E',
  '#F97316',
  '#A855F7',
  '#EC4899',
];
const DEFAULT_PRIMARY = '#111827';
const DEFAULT_SECONDARY = '#4B5563';
const DEFAULT_BACKGROUND = '#FFFFFF';
const DEFAULT_TEXT = '#111827';
const DEFAULT_ACCENT = '#3B82F6';
const QR_SIZE = 240;

const SHOW_ROTATE = process.env.NEXT_PUBLIC_JOIN_ROTATE_UI === 'true';
const MESSENGER_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '';
const ENABLE_NFC_COLOR_CUSTOMIZATION = false; // Feature flag: color customization temporarily disabled

type Language = 'en' | 'el';

type BrandingForm = {
  storeDisplayName: string;
  logoUrl: string;
  ogImageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  marketingHeadline: string;
  marketingBullets: string;
  merchantBlurb: string;
  // Bilingual fields
  headlineEn: string;
  headlineEl: string;
  subheadlineEn: string;
  subheadlineEl: string;
  bulletsEn: string;
  bulletsEl: string;
  merchantBlurbEn: string;
  merchantBlurbEl: string;
  pageTitle: string;
  pageDescription: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
};

export default function NfcSignupPage() {
  const { data, isLoading, refetch } = useJoinBranding();
  const save = useSaveJoinBranding();
  const uploadLogo = useUploadJoinLogo();
  const uploadOg = useUploadJoinOgImage();
  const deleteLogo = useDeleteJoinLogo();
  const deleteOg = useDeleteJoinOgImage();
  const rotate = useRotatePublicLinks();
  const { data: links, refetch: refetchLinks } = usePublicLinks();

  const [colorModal, setColorModal] = useState<keyof BrandingForm | null>(null);
  const [shareSupported, setShareSupported] = useState(false);
  const [messengerSupported, setMessengerSupported] = useState(false);
  const [editLang, setEditLang] = useState<Language>('en'); // Language toggle for bilingual editing
  const [form, setForm] = useState<BrandingForm>({
    storeDisplayName: '',
    logoUrl: '',
    ogImageUrl: '',
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
    backgroundColor: DEFAULT_BACKGROUND,
    textColor: DEFAULT_TEXT,
    accentColor: DEFAULT_ACCENT,
    marketingHeadline: '',
    marketingBullets: '',
    merchantBlurb: '',
    // Bilingual fields
    headlineEn: '',
    headlineEl: '',
    subheadlineEn: '',
    subheadlineEl: '',
    bulletsEn: '',
    bulletsEl: '',
    merchantBlurbEn: '',
    merchantBlurbEl: '',
    pageTitle: '',
    pageDescription: '',
    websiteUrl: '',
    facebookUrl: '',
    instagramUrl: '',
  });

  useEffect(() => {
    if (data?.branding) {
      setForm({
        storeDisplayName: data.branding.storeDisplayName || data.branding.storeName || '',
        logoUrl: data.branding.logoUrl || '',
        ogImageUrl: data.branding.ogImageUrl || '',
        primaryColor: data.branding.primaryColor || DEFAULT_PRIMARY,
        secondaryColor: data.branding.secondaryColor || DEFAULT_SECONDARY,
        backgroundColor: data.branding.backgroundColor || DEFAULT_BACKGROUND,
        textColor: data.branding.textColor || DEFAULT_TEXT,
        accentColor: data.branding.accentColor || DEFAULT_ACCENT,
        marketingHeadline: data.branding.marketingHeadline || '',
        marketingBullets: (data.branding.marketingBullets || []).join('\n'),
        merchantBlurb: data.branding.merchantBlurb || '',
        // Bilingual fields
        headlineEn: data.branding.headlineEn || '',
        headlineEl: data.branding.headlineEl || '',
        subheadlineEn: data.branding.subheadlineEn || '',
        subheadlineEl: data.branding.subheadlineEl || '',
        bulletsEn: (data.branding.bulletsEn || []).join('\n'),
        bulletsEl: (data.branding.bulletsEl || []).join('\n'),
        merchantBlurbEn: data.branding.merchantBlurbEn || '',
        merchantBlurbEl: data.branding.merchantBlurbEl || '',
        pageTitle: data.branding.pageTitle || '',
        pageDescription: data.branding.pageDescription || '',
        websiteUrl: data.branding.websiteUrl || '',
        facebookUrl: data.branding.facebookUrl || '',
        instagramUrl: data.branding.instagramUrl || '',
      });
    }
  }, [data?.branding]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShareSupported(Boolean(navigator.share));
    const ua = navigator.userAgent || '';
    setMessengerSupported(Boolean(MESSENGER_APP_ID) || /FBAN|FBAV|Messenger/i.test(ua));
  }, []);

  const joinUrl = links?.canonicalJoinUrl || links?.joinUrl || '';

  const qrUrl = useMemo(() => {
    if (!joinUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(
      joinUrl,
    )}`;
  }, [joinUrl]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const bullets = form.marketingBullets
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    // Parse bilingual bullets
    const bulletsEn = form.bulletsEn
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);
    const bulletsEl = form.bulletsEl
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    try {
      await save.mutateAsync({
        storeDisplayName: form.storeDisplayName || null,
        logoUrl: form.logoUrl || null,
        ogImageUrl: form.ogImageUrl || null,
        primaryColor: form.primaryColor || DEFAULT_PRIMARY,
        secondaryColor: form.secondaryColor || DEFAULT_SECONDARY,
        backgroundColor: form.backgroundColor || DEFAULT_BACKGROUND,
        textColor: form.textColor || DEFAULT_TEXT,
        accentColor: form.accentColor || DEFAULT_ACCENT,
        marketingHeadline: form.marketingHeadline || null,
        marketingBullets: bullets.length ? bullets : null,
        merchantBlurb: form.merchantBlurb || null,
        // Bilingual fields
        headlineEn: form.headlineEn || null,
        headlineEl: form.headlineEl || null,
        subheadlineEn: form.subheadlineEn || null,
        subheadlineEl: form.subheadlineEl || null,
        bulletsEn: bulletsEn.length ? bulletsEn : null,
        bulletsEl: bulletsEl.length ? bulletsEl : null,
        merchantBlurbEn: form.merchantBlurbEn || null,
        merchantBlurbEl: form.merchantBlurbEl || null,
        pageTitle: form.pageTitle || null,
        pageDescription: form.pageDescription || null,
        websiteUrl: form.websiteUrl || null,
        facebookUrl: form.facebookUrl || null,
        instagramUrl: form.instagramUrl || null,
      });

      toast.success('Branding saved');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Save failed');
    }
  };

  const handleUpload = async (file: File | undefined | null, type: 'logo' | 'og') => {
    if (!file) return;
    try {
      if (type === 'logo') {
        await uploadLogo.mutateAsync(file);
      } else {
        await uploadOg.mutateAsync(file);
      }
      toast.success(type === 'logo' ? 'Logo uploaded' : 'OG image uploaded');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await deleteLogo.mutateAsync();
      toast.success('Logo removed');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Remove failed');
    }
  };

  const handleRemoveOg = async () => {
    try {
      await deleteOg.mutateAsync();
      toast.success('OG image removed');
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Remove failed');
    }
  };

  const handleRotate = async () => {
    await rotate.mutateAsync();
    refetchLinks();
    toast.success('Join link rotated');
  };

  const handleCopy = async () => {
    if (!joinUrl) return;
    await navigator.clipboard?.writeText(joinUrl);
    toast.success('Link copied');
  };

  const handleNativeShare = async () => {
    if (!joinUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: form.storeDisplayName || 'Join our list',
        text: 'Join our store to receive offers.',
        url: joinUrl,
      });
    } catch {
      // User canceled share dialog.
    }
  };

  const handleWhatsAppShare = () => {
    if (!joinUrl) return;
    const text = `${form.storeDisplayName || 'Join our list'}\n${joinUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleMessengerShare = () => {
    if (!joinUrl) return;
    const encoded = encodeURIComponent(joinUrl);
    if (MESSENGER_APP_ID) {
      window.open(
        `https://www.facebook.com/dialog/send?link=${encoded}&app_id=${MESSENGER_APP_ID}&redirect_uri=${encoded}`,
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }
    window.location.href = `fb-messenger://share?link=${encoded}`;
  };

  const handleDownloadQr = async () => {
    if (!qrUrl) return;
    try {
      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error('QR download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const baseName =
        form.storeDisplayName?.trim() || data?.branding?.storeDisplayName || 'join';
      const safeName =
        baseName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'join';
      anchor.href = url;
      anchor.download = `${safeName}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Unable to download QR');
    }
  };

  return (
    <RetailPageLayout>
      <RetailPageHeader
        title="NFC & Signup"
        description="Share a join link via NFC, QR, or social channels and customize the signup experience."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-6">
          <RetailCard>
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Your Join Link</h3>
                  <p className="text-sm text-text-secondary">
                    Share this link on NFC tags, receipts, or social media to collect opt-ins.
                  </p>
                </div>
                <Link2 className="h-5 w-5 text-text-tertiary" />
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] items-start">
                <div className="space-y-4">
                  <div className="rounded-md border border-border bg-surface-light p-3 text-sm break-all">
                    {joinUrl || 'Generating...'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={handleCopy} disabled={!joinUrl}>
                      Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => joinUrl && window.open(joinUrl, '_blank', 'noopener,noreferrer')}
                      disabled={!joinUrl}
                    >
                      Open
                    </Button>
                    {shareSupported ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleNativeShare}
                        disabled={!joinUrl}
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleWhatsAppShare}
                      disabled={!joinUrl}
                    >
                      WhatsApp
                    </Button>
                    {messengerSupported ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleMessengerShare}
                        disabled={!joinUrl}
                      >
                        Messenger
                      </Button>
                    ) : null}
                  </div>
                  <details className="rounded-md border border-border bg-surface-light px-3 py-2">
                    <summary className="cursor-pointer text-sm text-text-secondary">
                      Advanced
                    </summary>
                    <div className="mt-3 space-y-2">
                      {SHOW_ROTATE ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRotate}
                          disabled={rotate.isPending}
                        >
                          {rotate.isPending ? 'Rotating...' : 'Rotate link'}
                        </Button>
                      ) : (
                        <p className="text-xs text-text-tertiary">
                          Rotation is disabled in this environment.
                        </p>
                      )}
                      <p className="text-xs text-text-tertiary">
                        Rotating invalidates join links already printed on older NFC tags.
                      </p>
                    </div>
                  </details>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-text-secondary">
                    <span>QR code</span>
                    <QrCode className="h-4 w-4" />
                  </div>
                  <div className="flex justify-center">
                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt="Join QR"
                        className="h-44 w-44 border border-border rounded bg-white"
                      />
                    ) : (
                      <div className="h-44 w-44 bg-surface-light border border-border rounded animate-pulse" />
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleDownloadQr}
                    disabled={!joinUrl}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                </div>
              </div>
            </div>
          </RetailCard>

          <RetailCard>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                    <Palette className="h-5 w-5 text-text-tertiary" />
                    Branding & Content
                  </div>
                  <p className="text-sm text-text-secondary">
                    Customize the public join page your customers will see.
                  </p>
                </div>
                <ImageUp className="h-5 w-5 text-text-tertiary" />
              </div>

              <div>
                <label className="text-sm text-text-secondary">Store display name</label>
                <Input
                  value={form.storeDisplayName}
                  onChange={(e) => setForm((f) => ({ ...f, storeDisplayName: e.target.value }))}
                  placeholder="Your store"
                  required
                />
              </div>

              {/* Language toggle for bilingual content editing */}
              <div className="space-y-3 rounded-lg border border-border bg-surface-light p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Bilingual Content</p>
                    <p className="text-xs text-text-secondary">Edit headlines, subheadlines, and benefits in both languages. Leave empty to use Astronote defaults.</p>
                  </div>
                  <div className="inline-flex rounded-lg bg-surface-dark p-1">
                    <button
                      type="button"
                      onClick={() => setEditLang('en')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                        editLang === 'en'
                          ? 'bg-white text-text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditLang('el')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                        editLang === 'el'
                          ? 'bg-white text-text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      GR
                    </button>
                  </div>
                </div>

                {/* EN fields */}
                {editLang === 'en' && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm text-text-secondary">Headline (EN)</label>
                      <Input
                        value={form.headlineEn}
                        onChange={(e) => setForm((f) => ({ ...f, headlineEn: e.target.value }))}
                        placeholder="Subscribe to get member benefits"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">Subheadline (EN)</label>
                      <Textarea
                        value={form.subheadlineEn}
                        onChange={(e) => setForm((f) => ({ ...f, subheadlineEn: e.target.value }))}
                        rows={2}
                        placeholder="Get offers, updates, and member-only perks from this store."
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">Benefits (EN) — one per line, format: Title — Description</label>
                      <Textarea
                        value={form.bulletsEn}
                        onChange={(e) => setForm((f) => ({ ...f, bulletsEn: e.target.value }))}
                        rows={5}
                        placeholder="Exclusive discounts — Members get better deals and limited offers.&#10;Early access — Be first to know about new arrivals."
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">Extra message (EN)</label>
                      <Textarea
                        value={form.merchantBlurbEn}
                        onChange={(e) => setForm((f) => ({ ...f, merchantBlurbEn: e.target.value }))}
                        rows={3}
                        maxLength={500}
                        placeholder="Additional message for your customers..."
                      />
                    </div>
                  </div>
                )}

                {/* EL fields */}
                {editLang === 'el' && (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm text-text-secondary">Headline (GR)</label>
                      <Input
                        value={form.headlineEl}
                        onChange={(e) => setForm((f) => ({ ...f, headlineEl: e.target.value }))}
                        placeholder="Write the Greek headline"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">Subheadline (GR)</label>
                      <Textarea
                        value={form.subheadlineEl}
                        onChange={(e) => setForm((f) => ({ ...f, subheadlineEl: e.target.value }))}
                        rows={2}
                        placeholder="Describe the offer in Greek (offers, updates, perks)."
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">Benefits (GR) — one per line, format: Title — Description</label>
                      <Textarea
                        value={form.bulletsEl}
                        onChange={(e) => setForm((f) => ({ ...f, bulletsEl: e.target.value }))}
                        rows={5}
                        placeholder="Example: Exclusive discounts — Members get better pricing.&#10;Early access — Be first to know about new arrivals."
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">Extra message (GR)</label>
                      <Textarea
                        value={form.merchantBlurbEl}
                        onChange={(e) => setForm((f) => ({ ...f, merchantBlurbEl: e.target.value }))}
                        rows={3}
                        maxLength={500}
                        placeholder="Additional message for customers (Greek)..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="font-semibold text-text-primary">Logo upload</div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="h-14 w-14 rounded border border-border bg-white flex items-center justify-center">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
                    ) : (
                      <span className="text-xs text-text-tertiary">Logo</span>
                    )}
                  </div>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => handleUpload(e.target.files?.[0], 'logo')}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRemoveLogo}
                    disabled={!form.logoUrl || deleteLogo.isPending}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {ENABLE_NFC_COLOR_CUSTOMIZATION && (
                <div className="space-y-3">
                  <div className="font-semibold text-text-primary">Colors</div>
                  <p className="text-sm text-text-secondary">
                    Choose a primary and accent color. Use background + gradient end for a soft gradient.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {([
                      ['primaryColor', 'Primary'],
                      ['accentColor', 'Accent'],
                      ['backgroundColor', 'Background'],
                      ['secondaryColor', 'Gradient end'],
                    ] as Array<[keyof BrandingForm, string]>).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 bg-surface-light"
                        onClick={() => setColorModal(key)}
                      >
                        <span className="text-sm text-text-secondary">{label}</span>
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-text-tertiary">{form[key]}</span>
                          <span
                            className="h-6 w-6 rounded border border-border"
                            style={{ backgroundColor: form[key] }}
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!ENABLE_NFC_COLOR_CUSTOMIZATION && (
                <div className="rounded-md border border-border bg-surface-light px-4 py-3">
                  <p className="text-sm text-text-tertiary">
                    Color themes will be available soon.
                  </p>
                </div>
              )}

              <div>
                <div className="font-semibold text-text-primary">Social links</div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-sm text-text-secondary">Website</label>
                    <Input
                      value={form.websiteUrl}
                      onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Instagram</label>
                    <Input
                      value={form.instagramUrl}
                      onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-sm text-text-secondary">Facebook</label>
                    <Input
                      value={form.facebookUrl}
                      onChange={(e) => setForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              <details className="rounded-md border border-border bg-surface-light px-4 py-3">
                <summary className="cursor-pointer text-sm text-text-secondary">
                  Advanced branding controls
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-text-secondary">Text color</label>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 w-full justify-between"
                        onClick={() => setColorModal('textColor')}
                      >
                        <span>{form.textColor}</span>
                        <span
                          className="h-5 w-5 rounded border border-border"
                          style={{ backgroundColor: form.textColor }}
                        />
                      </Button>
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">OG image upload</label>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-12 w-12 rounded border border-border bg-white flex items-center justify-center">
                          {form.ogImageUrl ? (
                            <img src={form.ogImageUrl} alt="OG" className="h-10 w-10 object-contain" />
                          ) : (
                            <span className="text-[10px] text-text-tertiary">OG</span>
                          )}
                        </div>
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleUpload(e.target.files?.[0], 'og')}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleRemoveOg}
                          disabled={!form.ogImageUrl || deleteOg.isPending}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-text-secondary">Page title (SEO)</label>
                      <Input
                        value={form.pageTitle}
                        onChange={(e) => setForm((f) => ({ ...f, pageTitle: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">Page description</label>
                      <Input
                        value={form.pageDescription}
                        onChange={(e) => setForm((f) => ({ ...f, pageDescription: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-text-secondary">Logo URL (optional)</label>
                      <Input
                        value={form.logoUrl}
                        onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-secondary">OG image URL (optional)</label>
                      <Input
                        value={form.ogImageUrl}
                        onChange={(e) => setForm((f) => ({ ...f, ogImageUrl: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </details>

              <div className="flex gap-2">
                <Button type="submit" disabled={save.isPending || isLoading}>
                  {save.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button type="button" variant="outline" onClick={() => refetch()} disabled={isLoading}>
                  Refresh
                </Button>
              </div>
            </form>
          </RetailCard>
        </div>

        <div className="space-y-6">
          <RetailCard className="bg-surface-light">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <Eye className="h-5 w-5 text-text-tertiary" />
                  Live Preview
                </div>
                <p className="text-sm text-text-secondary">
                  Preview the public join page with your current branding.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-white">
                {joinUrl ? (
                  <iframe
                    title="Join page preview"
                    src={joinUrl}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-surface" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => joinUrl && window.open(joinUrl, '_blank', 'noopener,noreferrer')}
                  disabled={!joinUrl}
                >
                  Preview in new tab
                </Button>
                <Button size="sm" variant="ghost" onClick={() => refetchLinks()}>
                  Refresh preview
                </Button>
              </div>
            </div>
          </RetailCard>
        </div>
      </div>

      {ENABLE_NFC_COLOR_CUSTOMIZATION && (
        <>
          <ColorPickerModal
            open={colorModal === 'primaryColor'}
            onClose={() => setColorModal(null)}
            label="Primary"
            value={form.primaryColor}
            presets={COLOR_PRESETS}
            onChange={(value) => setForm((f) => ({ ...f, primaryColor: value }))}
          />
          <ColorPickerModal
            open={colorModal === 'accentColor'}
            onClose={() => setColorModal(null)}
            label="Accent"
            value={form.accentColor}
            presets={COLOR_PRESETS}
            onChange={(value) => setForm((f) => ({ ...f, accentColor: value }))}
          />
          <ColorPickerModal
            open={colorModal === 'secondaryColor'}
            onClose={() => setColorModal(null)}
            label="Gradient End"
            value={form.secondaryColor}
            presets={COLOR_PRESETS}
            onChange={(value) => setForm((f) => ({ ...f, secondaryColor: value }))}
          />
          <ColorPickerModal
            open={colorModal === 'backgroundColor'}
            onClose={() => setColorModal(null)}
            label="Background"
            value={form.backgroundColor}
            presets={COLOR_PRESETS}
            onChange={(value) => setForm((f) => ({ ...f, backgroundColor: value }))}
          />
          <ColorPickerModal
            open={colorModal === 'textColor'}
            onClose={() => setColorModal(null)}
            label="Text"
            value={form.textColor}
            presets={COLOR_PRESETS}
            onChange={(value) => setForm((f) => ({ ...f, textColor: value }))}
          />
        </>
      )}
    </RetailPageLayout>
  );
}
