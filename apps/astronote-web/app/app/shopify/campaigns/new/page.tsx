'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useCreateCampaign } from '@/src/features/shopify/campaigns/hooks/useCampaignMutations';
import { useAudiences } from '@/src/features/shopify/audiences/hooks/useAudiences';
import { useDiscounts } from '@/src/features/shopify/discounts/hooks/useDiscounts';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { SmsPhonePreview } from '@/src/components/shared/SmsPhonePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Send, Clock } from 'lucide-react';
import type { ScheduleType } from '@/src/lib/shopify/api/campaigns';

/**
 * Campaign Create Page
 * Create a new campaign with name, message, and schedule options
 */
export default function NewCampaignPage() {
  const router = useRouter();
  const createCampaign = useCreateCampaign();

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    audience: 'all',
    discountId: '',
    scheduleType: 'immediate' as ScheduleType,
    scheduleAt: '',
  });

  // Fetch audiences and discounts
  const { data: audiencesData } = useAudiences();
  const { data: discountsData } = useDiscounts();

  // Check for template prefill from templates page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const templatePrefill = localStorage.getItem('shopify_template_prefill');
      if (templatePrefill) {
        try {
          const template = JSON.parse(templatePrefill);
          setFormData((prev) => ({
            ...prev,
            name: template.name || prev.name,
            message: template.message || prev.message,
          }));
          // Clear the prefill after using it
          localStorage.removeItem('shopify_template_prefill');
        } catch (error) {
          // Invalid JSON, ignore
        }
      }
    }
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleSubmit = async (action: 'draft' | 'send' | 'schedule') => {
    if (!validate()) {
      return;
    }

    try {
      const campaignData: any = {
        name: formData.name.trim(),
        message: formData.message.trim(),
        audience: formData.audience || 'all',
        scheduleType: action === 'draft' ? 'immediate' : formData.scheduleType,
        scheduleAt:
          action === 'schedule' && formData.scheduleAt
            ? new Date(formData.scheduleAt).toISOString()
            : undefined,
      };

      // Add discount if selected
      if (formData.discountId) {
        campaignData.discountId = formData.discountId;
      }

      const campaign = await createCampaign.mutateAsync(campaignData);

      // If send action, enqueue the campaign
      if (action === 'send' && campaign.id) {
        // The createCampaign hook will handle redirect
        // But we need to enqueue it separately
        // For now, just redirect to detail page - user can send from there
        router.push(`/app/shopify/campaigns/${campaign.id}`);
      } else {
        router.push(`/app/shopify/campaigns/${campaign.id}`);
      }
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Calculate SMS parts
  const smsParts = Math.ceil(formData.message.length / 160);
  const smsCount = formData.message.length > 0 ? smsParts : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/app/shopify/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <RetailPageHeader
            title="Create Campaign"
            description="Create a new SMS campaign"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <RetailCard className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit('draft');
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
                  <span>
                    {formData.message.length}/1600 characters
                  </span>
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
                      .map((audience) => (
                        <SelectItem key={audience.id} value={audience.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{audience.name}</span>
                            <span className="ml-2 text-xs text-text-tertiary">
                              ({audience.contactCount} contacts)
                            </span>
                          </div>
                        </SelectItem>
                      ))}
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
                    <SelectItem value="">No discount code</SelectItem>
                    {discountsData?.discounts
                      ?.filter((d) => d.isActive && !d.isExpired)
                      .map((discount) => (
                        <SelectItem key={discount.id} value={discount.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{discount.code}</span>
                            {discount.title && (
                              <span className="ml-2 text-xs text-text-tertiary">— {discount.title}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSubmit('draft')}
                  disabled={createCampaign.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Draft
                </Button>
                {formData.scheduleType === 'scheduled' ? (
                  <Button
                    type="button"
                    onClick={() => handleSubmit('schedule')}
                    disabled={createCampaign.isPending}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Schedule
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleSubmit('send')}
                    disabled={createCampaign.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Create & Send Now
                  </Button>
                )}
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
                <SmsPhonePreview
                  message={formData.message}
                  senderName="Astronote"
                  variant="shopify"
                  size="md"
                  showCounts={true}
                />
              </div>
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
                  <div className="text-sm font-medium text-text-secondary mb-2">Schedule</div>
                  <div className="text-text-primary">
                    {formData.scheduleType === 'immediate' ? (
                      'Save as Draft'
                    ) : formData.scheduleAt ? (
                      format(new Date(formData.scheduleAt), 'MMM d, yyyy HH:mm')
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
  );
}

