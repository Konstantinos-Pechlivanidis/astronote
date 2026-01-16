'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCampaign } from '@/src/features/shopify/campaigns/hooks/useCampaign';
import { useUpdateCampaign } from '@/src/features/shopify/campaigns/hooks/useCampaignMutations';
import { useAudiences } from '@/src/features/shopify/audiences/hooks/useAudiences';
import { useDiscounts } from '@/src/features/shopify/discounts/hooks/useDiscounts';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { AppPageHeader } from '@/src/components/app/AppPageHeader';
import { Logo } from '@/src/components/brand/Logo';
import { SmsInPhonePreview } from '@/src/components/phone/SmsInPhonePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, AlertCircle } from 'lucide-react';
import type { ScheduleType } from '@/src/lib/shopify/api/campaigns';

// Sentinel value for "No discount" (must be non-empty for Radix Select)
const UI_NONE = '__none__';

/**
 * Campaign Edit Page
 * Edit an existing campaign (only if draft or scheduled)
 */
export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useCampaign(id);
  const updateCampaign = useUpdateCampaign();
  const { data: audiencesData } = useAudiences();
  const { data: discountsData } = useDiscounts();

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    audience: 'all',
    discountId: UI_NONE,
    scheduleType: 'immediate' as ScheduleType,
    scheduleAt: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load campaign data when available
  useEffect(() => {
    if (campaign) {
      // Check if campaign can be edited
      const canEdit = campaign.status === 'draft' || campaign.status === 'scheduled';
      if (!canEdit) {
        router.push(`/app/shopify/campaigns/${id}`);
        return;
      }

      setFormData({
        name: campaign.name || '',
        message: campaign.message || '',
        audience: typeof campaign.audience === 'string' ? campaign.audience : 'all',
        discountId: campaign.discountId || UI_NONE,
        scheduleType: campaign.scheduleType || 'immediate',
        scheduleAt: campaign.scheduleAt
          ? new Date(campaign.scheduleAt).toISOString().slice(0, 16)
          : '',
      });
    }
  }, [campaign, id, router]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    } else if (formData.name.length > 200) {
      newErrors.name = 'Campaign name must be less than 200 characters';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.length > 1600) {
      newErrors.message = 'Message must be less than 1600 characters';
    }

    if (formData.scheduleType === 'scheduled') {
      if (!formData.scheduleAt) {
        newErrors.scheduleAt = 'Schedule date and time are required';
      } else {
        const scheduleDate = new Date(formData.scheduleAt);
        if (isNaN(scheduleDate.getTime())) {
          newErrors.scheduleAt = 'Invalid date and time';
        } else if (scheduleDate <= new Date()) {
          newErrors.scheduleAt = 'Schedule date must be in the future';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      const campaignData: any = {
        name: formData.name.trim(),
        message: formData.message.trim(),
        audience: formData.audience || 'all',
        scheduleType: formData.scheduleType,
        scheduleAt:
          formData.scheduleType === 'scheduled' && formData.scheduleAt
            ? new Date(formData.scheduleAt).toISOString()
            : undefined,
      };

      // Convert sentinel to null for API
      if (formData.discountId && formData.discountId !== UI_NONE) {
        campaignData.discountId = formData.discountId;
      } else {
        campaignData.discountId = null;
      }

      await updateCampaign.mutateAsync({ id, data: campaignData });
      router.push(`/app/shopify/campaigns/${id}`);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Calculate SMS parts
  const smsParts = Math.ceil(formData.message.length / 160);
  const smsCount = formData.message.length > 0 ? smsParts : 0;

  const unsubscribePreviewUrl = useMemo(() => {
    // Best-effort placeholder: backend will generate a real /s/:token link at send time.
    const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    return `${base}/s/xxxxxxxxxx`;
  }, []);

  const previewMessage = useMemo(() => {
    const sampleDiscount =
      discountsData?.discounts?.find((d) => d.id === formData.discountId)?.code || 'SAVE10';
    const replaced = (formData.message || '')
      .replaceAll('{{firstName}}', 'Jane')
      .replaceAll('{{lastName}}', 'Doe')
      .replaceAll('{{discountCode}}', sampleDiscount);
    return `${replaced}\n\nUnsubscribe: ${unsubscribePreviewUrl}`;
  }, [formData.message, formData.discountId, discountsData?.discounts, unsubscribePreviewUrl]);

  // Loading state
  if (campaignLoading) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <AppPageHeader
            title={
              <span className="inline-flex items-center gap-3">
                <Logo size="sm" />
                <span>Edit Campaign</span>
              </span>
            }
            backHref="/app/shopify/campaigns"
          />
          <RetailCard className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded bg-surface-light" />
              ))}
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  // Error state
  if (campaignError || !campaign) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <AppPageHeader
            title={
              <span className="inline-flex items-center gap-3">
                <Logo size="sm" />
                <span>Edit Campaign</span>
              </span>
            }
            backHref="/app/shopify/campaigns"
          />
          <RetailCard variant="danger" className="p-6">
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">Campaign Not Found</h3>
              <p className="text-sm text-text-secondary mb-4">
                {campaignError instanceof Error
                  ? campaignError.message
                  : 'The campaign you are looking for does not exist.'}
              </p>
              <Link href="/app/shopify/campaigns">
                <Button variant="outline">Back to Campaigns</Button>
              </Link>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  // Check if campaign can be edited
  const canEdit = campaign.status === 'draft' || campaign.status === 'scheduled';
  if (!canEdit) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <AppPageHeader
            title={
              <span className="inline-flex items-center gap-3">
                <Logo size="sm" />
                <span>Edit Campaign</span>
              </span>
            }
            backHref={`/app/shopify/campaigns/${id}`}
          />
          <RetailCard variant="danger" className="p-6">
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">Cannot Edit Campaign</h3>
              <p className="text-sm text-text-secondary mb-4">
                Only draft and scheduled campaigns can be edited.
              </p>
              <Link href={`/app/shopify/campaigns/${id}`}>
                <Button variant="outline">Back to Campaign</Button>
              </Link>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <AppPageHeader
          title={
            <span className="inline-flex items-center gap-3">
              <Logo size="sm" />
              <span>Edit Campaign</span>
            </span>
          }
          description={`Editing: ${campaign.name}`}
          backHref={`/app/shopify/campaigns/${id}`}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2">
            <RetailCard className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
                className="space-y-6"
              >
                {/* Campaign Name */}
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-text-secondary">
                  Campaign Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Summer Sale 2025"
                    maxLength={200}
                    className={errors.name ? 'border-red-400' : ''}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                  )}
                  <p className="mt-1 text-xs text-text-tertiary">
                    {formData.name.length}/200 characters
                  </p>
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="message"
                    className="mb-2 block text-sm font-medium text-text-secondary"
                  >
                  Message <span className="text-red-400">*</span>
                  </label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Enter your SMS message here. Use {{firstName}} for personalization."
                    rows={8}
                    maxLength={1600}
                    className={errors.message ? 'border-red-400' : ''}
                  />
                  {errors.message && (
                    <p className="mt-1 text-sm text-red-400">{errors.message}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary">
                    <span>{formData.message.length}/1600 characters</span>
                    <span>
                      {smsCount} SMS part{smsCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Audience Selection */}
                <div>
                  <label htmlFor="audience" className="mb-2 block text-sm font-medium text-text-secondary">
                  Target Audience <span className="text-red-400">*</span>
                  </label>
                  <Select
                    value={formData.audience}
                    onValueChange={(value) => setFormData({ ...formData, audience: value })}
                  >
                    <SelectTrigger id="audience" className={errors.audience ? 'border-red-400' : ''}>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      {audiencesData?.audiences
                        ?.filter((a) => a.isAvailable)
                        .filter((a) => {
                        // Sanitize: ensure audience.id is a non-empty string
                          const id = String(a?.id ?? '').trim();
                          return id !== '';
                        })
                        .map((audience) => {
                        // Sanitize audience ID
                          const audienceId = String(audience.id ?? '').trim();
                          if (!audienceId) return null;
                          return (
                            <SelectItem key={audienceId} value={audienceId}>
                              <div className="flex items-center justify-between w-full">
                                <span>{audience.name}</span>
                                <span className="ml-2 text-xs text-text-tertiary">
                                ({audience.contactCount} contacts)
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })
                        .filter(Boolean)}
                    </SelectContent>
                  </Select>
                  {errors.audience && (
                    <p className="mt-1 text-sm text-red-400">{errors.audience}</p>
                  )}
                  {audiencesData?.audiences?.find((a) => a.id === formData.audience)?.description && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      {audiencesData.audiences.find((a) => a.id === formData.audience)?.description}
                    </p>
                  )}
                </div>

                {/* Discount Selection */}
                <div>
                  <label htmlFor="discount" className="mb-2 block text-sm font-medium text-text-secondary">
                  Discount Code <span className="text-text-tertiary">(Optional)</span>
                  </label>
                  <Select
                    value={formData.discountId}
                    onValueChange={(value) => setFormData({ ...formData, discountId: value })}
                  >
                    <SelectTrigger id="discount">
                      <SelectValue placeholder="No discount code" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UI_NONE}>No discount code</SelectItem>
                      {discountsData?.discounts
                        ?.filter((d) => d.isActive && !d.isExpired)
                        .filter((d) => {
                        // Sanitize: ensure discount.id is a non-empty string
                          const id = String(d?.id ?? '').trim();
                          return id !== '';
                        })
                        .map((discount) => {
                        // Sanitize discount ID
                          const discountId = String(discount.id ?? '').trim();
                          if (!discountId) return null;
                          return (
                            <SelectItem key={discountId} value={discountId}>
                              <div className="flex items-center justify-between w-full">
                                <span>{discount.code}</span>
                                {discount.title && (
                                  <span className="ml-2 text-xs text-text-tertiary">— {discount.title}</span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })
                        .filter(Boolean)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-text-tertiary">
                  Add a discount code to include in your campaign message
                  </p>
                </div>

                {/* Schedule Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Schedule
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="immediate"
                        checked={formData.scheduleType === 'immediate'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            scheduleType: e.target.value as ScheduleType,
                            scheduleAt: '',
                          })
                        }
                        className="h-4 w-4 accent-accent"
                      />
                      <div>
                        <div className="text-sm font-medium text-text-primary">Save as Draft</div>
                        <div className="text-xs text-text-tertiary">
                        Save for later. You can send it manually from the campaigns list.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="scheduleType"
                        value="scheduled"
                        checked={formData.scheduleType === 'scheduled'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            scheduleType: e.target.value as ScheduleType,
                          })
                        }
                        className="h-4 w-4 accent-accent"
                      />
                      <div>
                        <div className="text-sm font-medium text-text-primary">Schedule for Later</div>
                        <div className="text-xs text-text-tertiary">
                        Set a specific date and time to send automatically.
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Schedule Date/Time Picker */}
                  {formData.scheduleType === 'scheduled' && (
                    <div className="mt-4">
                      <label
                        htmlFor="scheduleAt"
                        className="mb-2 block text-sm font-medium text-text-secondary"
                      >
                      Schedule Date & Time <span className="text-red-400">*</span>
                      </label>
                      <Input
                        id="scheduleAt"
                        type="datetime-local"
                        value={formData.scheduleAt}
                        onChange={(e) => setFormData({ ...formData, scheduleAt: e.target.value })}
                        min={new Date().toISOString().slice(0, 16)}
                        className={errors.scheduleAt ? 'border-red-400' : ''}
                      />
                      {errors.scheduleAt && (
                        <p className="mt-1 text-sm text-red-400">{errors.scheduleAt}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <Link href={`/app/shopify/campaigns/${id}`}>
                    <Button type="button" variant="outline">
                    Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={updateCampaign.isPending}
                    className="flex-1"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {updateCampaign.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </RetailCard>
          </div>

          {/* Preview/Info Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-6">
              {/* Phone Preview */}
              <RetailCard className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Message Preview</h3>
                <div className="flex justify-center lg:justify-start">
                  <SmsInPhonePreview
                    message={previewMessage}
                    senderName="Astronote"
                    variant="shopify"
                    size="md"
                    showCounts={true}
                  />
                </div>
                <p className="mt-3 text-xs text-text-tertiary">
                  Unsubscribe link will be appended automatically and shortened: <span className="font-medium">Unsubscribe: {unsubscribePreviewUrl}</span>
                </p>
              </RetailCard>

              {/* Additional Info */}
              <RetailCard className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Campaign Details</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-2">Name</div>
                    <div className="text-text-primary">
                      {formData.name || <span className="text-text-tertiary">Untitled Campaign</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-2">Audience</div>
                    <div className="text-text-primary">
                      {audiencesData?.audiences?.find((a) => a.id === formData.audience)?.name || 'All Contacts'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-2">Discount</div>
                    <div className="text-text-primary">
                      {formData.discountId
                        ? discountsData?.discounts?.find((d) => d.id === formData.discountId)?.code || 'N/A'
                        : 'No discount'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-2">Schedule</div>
                    <div className="text-text-primary">
                      {formData.scheduleType === 'immediate' ? (
                        'Save as Draft'
                      ) : formData.scheduleAt ? (
                        new Date(formData.scheduleAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        <span className="text-text-tertiary">Select date and time</span>
                      )}
                    </div>
                  </div>
                </div>
              </RetailCard>
            </div>
          </div>
        </div>
      </div>
    </RetailPageLayout>
  );
}

