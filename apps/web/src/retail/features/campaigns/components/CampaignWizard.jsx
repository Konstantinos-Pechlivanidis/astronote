import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignSchema } from '../../../lib/validators';
import { useCreateCampaign } from '../hooks/useCreateCampaign';
import AudiencePreviewPanel from './AudiencePreviewPanel';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const STEPS = [
  { id: 1, name: 'Basics', description: 'Campaign name and message' },
  { id: 2, name: 'Audience', description: 'Select target audience' },
  { id: 3, name: 'Schedule', description: 'When to send' },
  { id: 4, name: 'Review', description: 'Confirm and create' },
];

export default function CampaignWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [audienceCount, setAudienceCount] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm({
    resolver: zodResolver(campaignSchema),
    mode: 'onChange',
    defaultValues: {
      scheduleType: 'now',
      filterGender: '', // P0 FIX: Default to empty string (Any) instead of undefined
      filterAgeGroup: '', // P0 FIX: Default to empty string (Any) instead of undefined
    },
  });

  const createMutation = useCreateCampaign();

  // Get current filter values for preview
  const currentFilters = {
    filterGender: watch('filterGender') || null,
    filterAgeGroup: watch('filterAgeGroup') || null,
    nameSearch: null, // Not exposed in UI yet
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await trigger(['name', 'messageText']);
      if (isValid) setCurrentStep(2);
    } else if (currentStep === 2) {
      // Audience step - can proceed without preview
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Schedule step - can always proceed (draft is valid)
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const onSubmit = (data) => {
    // Prevent double-submit
    if (isSubmitting || createMutation.isPending) {
      return;
    }

    // P0 FIX: Convert empty strings to null for filters (to allow "Any" option)
    // P0 FIX: Remove templateId - campaigns are independent from templates
    const submitData = {
      name: data.name,
      messageText: data.messageText || null, // Required - campaigns must have messageText
      filterGender: data.filterGender && data.filterGender.trim() ? data.filterGender : null,
      filterAgeGroup: data.filterAgeGroup && data.filterAgeGroup.trim() ? data.filterAgeGroup : null,
      ...(data.scheduleType === 'later' && data.scheduledDate && data.scheduledTime
        ? { scheduledDate: data.scheduledDate, scheduledTime: data.scheduledTime }
        : {}),
    };

    setIsSubmitting(true);
    createMutation.mutate(submitData, {
      onSuccess: () => {
        setIsSubmitting(false);
      },
      onError: () => {
        setIsSubmitting(false);
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                    currentStep > step.id
                      ? 'bg-green-600 text-white'
                      : currentStep === step.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className="text-sm font-medium text-gray-900">{step.name}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6">
        {/* Step 1: Basics */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Basics</h3>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                maxLength={200}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Summer Sale 2025"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="messageText" className="block text-sm font-medium text-gray-700 mb-1">
                Message Text <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('messageText')}
                id="messageText"
                rows={6}
                maxLength={2000}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.messageText ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your SMS message here. Use {{firstName}} for personalization."
              />
              <p className="mt-1 text-xs text-gray-500">
                Max 2000 characters. Use variables like {'{{'}firstName{'}}'} for personalization.
              </p>
              {errors.messageText && (
                <p className="mt-1 text-sm text-red-600">{errors.messageText.message}</p>
              )}
            </div>
            {Object.keys(errors).length > 0 && (errors.name || errors.messageText) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Please fix the errors above before proceeding.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Audience */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Target Audience</h3>
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
            <AudiencePreviewPanel
              filters={currentFilters}
              onCountResolved={setAudienceCount}
            />
          </div>
        )}

        {/* Step 3: Schedule */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h3>
            <div>
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="radio"
                  {...register('scheduleType')}
                  value="now"
                  defaultChecked
                  onChange={(e) => {
                    if (e.target.checked) {
                      setValue('scheduledDate', '');
                      setValue('scheduledTime', '');
                    }
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Save as draft (send later)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  {...register('scheduleType')}
                  value="later"
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Schedule fields will be enabled
                    }
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Schedule for later</span>
              </label>
            </div>
            {watch('scheduleType') === 'later' && (
              <div className="grid grid-cols-2 gap-4">
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
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Review & Create</h3>
            {createMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">
                  {createMutation.error?.response?.data?.message || 'Failed to create campaign. Please try again.'}
                </p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Campaign Name:</span>
                <span className="ml-2 text-sm text-gray-900">{watch('name')}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Message:</span>
                <div className="mt-1 text-sm text-gray-900 bg-white p-2 rounded border border-gray-200 whitespace-pre-wrap">
                  {watch('messageText') || '—'}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Gender Filter:</span>
                <span className="ml-2 text-sm text-gray-900 capitalize">
                  {watch('filterGender') || 'Any'}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Age Group:</span>
                <span className="ml-2 text-sm text-gray-900">
                  {watch('filterAgeGroup') ? watch('filterAgeGroup').replace('_', '-') : 'Any'}
                </span>
              </div>
              {audienceCount !== null && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Recipients:</span>
                  <span className="ml-2 text-sm text-gray-900">
                    {audienceCount.toLocaleString()}
                  </span>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-700">Schedule:</span>
                <span className="ml-2 text-sm text-gray-900">
                  {watch('scheduledDate') && watch('scheduledTime')
                    ? `${watch('scheduledDate')} at ${watch('scheduledTime')}`
                    : 'Draft (send later)'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || createMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || createMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

