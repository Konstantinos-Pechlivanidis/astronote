'use client';

import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { campaignSchema } from '@/src/lib/retail/validators';
import { useCampaign } from '@/src/features/retail/campaigns/hooks/useCampaign';
import { useUpdateCampaign } from '@/src/features/retail/campaigns/hooks/useUpdateCampaign';
import { AudiencePreviewPanel } from '@/src/features/retail/campaigns/components/AudiencePreviewPanel';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = Number(params.id);
  const { data: campaign, isLoading, error, refetch } = useCampaign(campaignId);
  const updateMutation = useUpdateCampaign();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema as any),
    mode: 'onChange',
  });

  // Get current filter values for preview (updates as user changes form)
  const currentFilters = {
    filterGender: watch('filterGender') || null,
    filterAgeGroup: watch('filterAgeGroup') || null,
    nameSearch: null,
  };

  // Pre-fill form when campaign loads
  useEffect(() => {
    if (campaign) {
      const scheduledAt = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;
      const scheduleType = scheduledAt && scheduledAt > new Date() ? 'later' : 'now';

      reset({
        name: campaign.name || '',
        messageText: campaign.messageText || '',
        filterGender: campaign.filterGender || '',
        filterAgeGroup: campaign.filterAgeGroup || '',
        scheduleType,
        scheduledDate: scheduledAt ? format(scheduledAt, 'yyyy-MM-dd') : '',
        scheduledTime: scheduledAt ? format(scheduledAt, 'HH:mm') : '',
      } as any);
    }
  }, [campaign, reset]);

  const onSubmit = (formData: z.infer<typeof campaignSchema>) => {
    // Convert empty strings to null for filters (to allow "Any" option)
    const submitData = {
      name: formData.name,
      messageText: formData.messageText || undefined,
      filterGender: formData.filterGender && formData.filterGender.trim() ? formData.filterGender : null,
      filterAgeGroup:
        formData.filterAgeGroup && formData.filterAgeGroup.trim() ? formData.filterAgeGroup : null,
      ...(formData.scheduleType === 'later' && formData.scheduledDate && formData.scheduledTime
        ? { scheduledDate: formData.scheduledDate, scheduledTime: formData.scheduledTime }
        : {}),
    };
    updateMutation.mutate(
      { id: campaignId, data: submitData },
      {
        onSuccess: () => {
          router.push(`/app/retail/campaigns/${campaignId}`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Edit Campaign" description="Loading..." />
          <RetailCard>
            <div className="py-8 text-center">
              <p className="text-sm text-text-secondary">Loading campaign details...</p>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  if (error) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Edit Campaign" description="Error loading campaign" />
          <RetailCard variant="danger">
            <div className="py-8 text-center">
              <p className="mb-4 text-red-400">Error loading campaign</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  if (!campaign) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Edit Campaign" description="Campaign not found" />
          <RetailCard>
            <div className="py-8 text-center">
              <p className="text-text-secondary">Campaign not found</p>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  // Check if campaign can be edited
  const canEdit = ['draft', 'scheduled'].includes(campaign.status);
  if (!canEdit) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/app/retail/campaigns/${campaignId}`}
              className="flex items-center gap-2 text-text-secondary transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
          <RetailPageHeader
            title="Edit Campaign"
            description={`Cannot edit campaign with status: ${campaign.status}`}
          />
          <RetailCard>
            <div className="mb-4 flex items-center gap-4">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  campaign.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : campaign.status === 'sending'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {campaign.status}
              </span>
              <h3 className="text-lg font-semibold text-text-primary">{campaign.name}</h3>
            </div>
            <p className="mb-4 text-text-secondary">
              This campaign cannot be edited because it is {campaign.status}. Only draft and scheduled
              campaigns can be edited.
            </p>
            <Link href={`/app/retail/campaigns/${campaignId}`}>
              <Button variant="outline" size="sm">
                Back to Campaign Details
              </Button>
            </Link>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/app/retail/campaigns/${campaignId}`}
            className="flex items-center gap-2 text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaign
          </Link>
        </div>
        <RetailPageHeader
          title={`Edit Campaign: ${campaign.name}`}
          description="Modify your campaign details and schedule"
        />

        <RetailCard className="mx-auto max-w-4xl">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
              {/* Campaign Name */}
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-text-secondary">
                  Campaign Name <span className="text-red-400">*</span>
                </label>
                <Input {...register('name')} type="text" id="name" maxLength={200} />
                {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>}
              </div>

              {/* Message Text */}
              <div>
                <label htmlFor="messageText" className="mb-1 block text-sm font-medium text-text-secondary">
                  Message Text <span className="text-red-400">*</span>
                </label>
                <Textarea
                  {...register('messageText')}
                  id="messageText"
                  rows={6}
                  maxLength={2000}
                  placeholder="Enter your SMS message here. Use {{firstName}} for personalization."
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  Max 2000 characters. Use variables like {'{{'}firstName{'}}'} for personalization.
                </p>
                {errors.messageText && (
                  <p className="mt-1 text-sm text-red-400">{errors.messageText.message}</p>
                )}
              </div>

              {/* Audience Filters */}
              <div className="border-t border-border pt-6">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">Target Audience</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="filterGender" className="mb-1 block text-sm font-medium text-text-secondary">
                      Gender Filter
                    </label>
                    <Select {...register('filterGender')} id="filterGender">
                      <option value="">Any</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="filterAgeGroup" className="mb-1 block text-sm font-medium text-text-secondary">
                      Age Group Filter
                    </label>
                    <Select {...register('filterAgeGroup')} id="filterAgeGroup">
                      <option value="">Any</option>
                      <option value="18_24">18-24</option>
                      <option value="25_39">25-39</option>
                      <option value="40_plus">40+</option>
                    </Select>
                  </div>
                </div>
                <div className="mt-4">
                  <AudiencePreviewPanel filters={currentFilters} />
                </div>
              </div>

              {/* Schedule */}
              <div className="border-t border-border pt-6">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">Schedule</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...register('scheduleType')}
                      value="now"
                      className="h-4 w-4 text-accent"
                    />
                    <span className="text-sm font-medium text-text-secondary">Save as draft (send later)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...register('scheduleType')}
                      value="later"
                      className="h-4 w-4 text-accent"
                    />
                    <span className="text-sm font-medium text-text-secondary">Schedule for later</span>
                  </label>
                </div>
                {watch('scheduleType') === 'later' && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="scheduledDate" className="mb-1 block text-sm font-medium text-text-secondary">
                        Date
                      </label>
                      <Input
                        {...register('scheduledDate')}
                        type="date"
                        id="scheduledDate"
                        min={new Date().toISOString().split('T')[0]}
                      />
                      {errors.scheduledDate && (
                        <p className="mt-1 text-sm text-red-400">{errors.scheduledDate.message}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="scheduledTime" className="mb-1 block text-sm font-medium text-text-secondary">
                        Time
                      </label>
                      <Input {...register('scheduledTime')} type="time" id="scheduledTime" />
                      {errors.scheduledTime && (
                        <p className="mt-1 text-sm text-red-400">{errors.scheduledTime.message}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-4 border-t border-border pt-6">
                <Link href={`/app/retail/campaigns/${campaignId}`}>
                  <Button type="button" variant="outline" size="sm">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={updateMutation.isPending} size="sm">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        </RetailCard>
      </div>
    </RetailPageLayout>
  );
}

