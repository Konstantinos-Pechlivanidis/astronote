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
import { GlassCard } from '@/components/ui/glass-card';
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
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Edit Campaign</h1>
          <p className="text-sm text-text-secondary mt-1">Loading...</p>
        </div>
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary">Loading campaign details...</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Edit Campaign</h1>
          <p className="text-sm text-text-secondary mt-1">Error loading campaign</p>
        </div>
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading campaign</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Edit Campaign</h1>
          <p className="text-sm text-text-secondary mt-1">Campaign not found</p>
        </div>
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-text-secondary">Campaign not found</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Check if campaign can be edited
  const canEdit = ['draft', 'scheduled'].includes(campaign.status);
  if (!canEdit) {
    return (
      <div>
        <div className="mb-4">
          <Link
            href={`/app/retail/campaigns/${campaignId}`}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Campaign
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Edit Campaign</h1>
          <p className="text-sm text-text-secondary mt-1">
            Cannot edit campaign with status: {campaign.status}
          </p>
        </div>
        <GlassCard>
          <div className="flex items-center gap-4 mb-4">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
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
          <p className="text-text-secondary mb-4">
            This campaign cannot be edited because it is {campaign.status}. Only draft and scheduled
            campaigns can be edited.
          </p>
          <Link href={`/app/retail/campaigns/${campaignId}`}>
            <Button variant="outline" size="sm">
              Back to Campaign Details
            </Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/app/retail/campaigns/${campaignId}`}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaign
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Edit Campaign</h1>
        <p className="text-sm text-text-secondary mt-1">Modify campaign: {campaign.name}</p>
      </div>

      <GlassCard className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6">
            {/* Campaign Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">
                Campaign Name <span className="text-red-400">*</span>
              </label>
              <Input {...register('name')} type="text" id="name" maxLength={200} />
              {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>}
            </div>

            {/* Message Text */}
            <div>
              <label htmlFor="messageText" className="block text-sm font-medium text-text-secondary mb-1">
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
              <h3 className="text-lg font-semibold text-text-primary mb-4">Target Audience</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="filterGender" className="block text-sm font-medium text-text-secondary mb-1">
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
                  <label htmlFor="filterAgeGroup" className="block text-sm font-medium text-text-secondary mb-1">
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
              <h3 className="text-lg font-semibold text-text-primary mb-4">Schedule</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    {...register('scheduleType')}
                    value="now"
                    className="w-4 h-4 text-accent"
                  />
                  <span className="text-sm font-medium text-text-secondary">Save as draft (send later)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    {...register('scheduleType')}
                    value="later"
                    className="w-4 h-4 text-accent"
                  />
                  <span className="text-sm font-medium text-text-secondary">Schedule for later</span>
                </label>
              </div>
              {watch('scheduleType') === 'later' && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="scheduledDate" className="block text-sm font-medium text-text-secondary mb-1">
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
                    <label htmlFor="scheduledTime" className="block text-sm font-medium text-text-secondary mb-1">
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
            <div className="flex justify-end gap-4 pt-6 border-t border-border">
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
      </GlassCard>
    </div>
  );
}

