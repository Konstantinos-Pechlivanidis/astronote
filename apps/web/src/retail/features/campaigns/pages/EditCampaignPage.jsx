import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import PageHeader from '../../../components/common/PageHeader';
import ErrorState from '../../../components/common/ErrorState';
import LoadingState from '../../../components/common/LoadingState';
import StatusBadge from '../../../components/common/StatusBadge';
import { useCampaign } from '../hooks/useCampaign';
import { useUpdateCampaign } from '../hooks/useUpdateCampaign';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignSchema } from '../../../lib/validators';
import AudiencePreviewPanel from '../components/AudiencePreviewPanel';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function EditCampaignPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const campaignId = Number(id);
  const { data: campaign, isLoading, error, refetch } = useCampaign(campaignId);
  const updateMutation = useUpdateCampaign();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
    reset,
  } = useForm({
    resolver: zodResolver(campaignSchema),
    mode: 'onChange',
  });

  // Get current filter values for preview (updates as user changes form)
  const currentFilters = {
    filterGender: watch('filterGender') || null,
    filterAgeGroup: watch('filterAgeGroup') || null,
    nameSearch: null, // Not exposed in UI yet
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
      });
    }
  }, [campaign, reset]);


  const onSubmit = (data) => {
    // P0 FIX: Convert empty strings to null for filters (to allow "Any" option)
    const submitData = {
      name: data.name,
      messageText: data.messageText || null,
      filterGender: data.filterGender && data.filterGender.trim() ? data.filterGender : null,
      filterAgeGroup: data.filterAgeGroup && data.filterAgeGroup.trim() ? data.filterAgeGroup : null,
      ...(data.scheduleType === 'later' && data.scheduledDate && data.scheduledTime
        ? { scheduledDate: data.scheduledDate, scheduledTime: data.scheduledTime }
        : {}),
    };
    updateMutation.mutate(
      { id: campaignId, data: submitData },
      {
        onSuccess: () => {
          navigate(`/app/campaigns/${campaignId}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Edit Campaign" subtitle="Loading..." />
        <LoadingState message="Loading campaign details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Edit Campaign" subtitle="Error loading campaign" />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <PageHeader title="Edit Campaign" subtitle="Campaign not found" />
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Campaign not found</p>
        </div>
      </div>
    );
  }

  // Check if campaign can be edited
  const canEdit = ['draft', 'scheduled'].includes(campaign.status);
  if (!canEdit) {
    return (
      <div>
        <div className="mb-4">
          <button
            onClick={() => navigate(`/app/campaigns/${campaignId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Campaign
          </button>
        </div>
        <PageHeader
          title="Edit Campaign"
          subtitle={`Cannot edit campaign with status: ${campaign.status}`}
        />
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <StatusBadge status={campaign.status} />
            <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
          </div>
          <p className="text-gray-600 mb-4">
            This campaign cannot be edited because it is {campaign.status}. Only draft and scheduled campaigns can be edited.
          </p>
          <button
            onClick={() => navigate(`/app/campaigns/${campaignId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Campaign Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => navigate(`/app/campaigns/${campaignId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaign
        </button>
      </div>
      <PageHeader
        title="Edit Campaign"
        subtitle={`Modify campaign: ${campaign.name}`}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Campaign Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              type="text"
              id="name"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Message Text */}
          <div>
            <label htmlFor="messageText" className="block text-sm font-medium text-gray-700 mb-1">
              Message Text <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('messageText')}
              id="messageText"
              rows={6}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your SMS message here. Use {{firstName}} for personalization."
            />
            <p className="mt-1 text-xs text-gray-500">
              Max 2000 characters. Use variables like {'{{'}firstName{'}}'} for personalization.
            </p>
            {errors.messageText && (
              <p className="mt-1 text-sm text-red-600">{errors.messageText.message}</p>
            )}
          </div>

          {/* Audience Filters */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Target Audience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="filterGender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender Filter
                </label>
                <select
                  {...register('filterGender')}
                  id="filterGender"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Any</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="filterAgeGroup" className="block text-sm font-medium text-gray-700 mb-1">
                  Age Group Filter
                </label>
                <select
                  {...register('filterAgeGroup')}
                  id="filterAgeGroup"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Any</option>
                  <option value="18_24">18-24</option>
                  <option value="25_39">25-39</option>
                  <option value="40_plus">40+</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <AudiencePreviewPanel filters={currentFilters} />
            </div>
          </div>

          {/* Schedule */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  {...register('scheduleType')}
                  value="now"
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Save as draft (send later)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  {...register('scheduleType')}
                  value="later"
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Schedule for later</span>
              </label>
            </div>
            {watch('scheduleType') === 'later' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    {...register('scheduledDate')}
                    type="date"
                    id="scheduledDate"
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.scheduledDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.scheduledDate.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    {...register('scheduledTime')}
                    type="time"
                    id="scheduledTime"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.scheduledTime && (
                    <p className="mt-1 text-sm text-red-600">{errors.scheduledTime.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(`/app/campaigns/${campaignId}`)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

