'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignSchema } from '@/src/lib/retail/validators';
import { z } from 'zod';
import { useCreateCampaign } from '@/src/features/retail/campaigns/hooks/useCreateCampaign';
import { AudiencePreviewPanel } from '@/src/features/retail/campaigns/components/AudiencePreviewPanel';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const STEPS = [
  { id: 1, name: 'Basics', description: 'Campaign name and message' },
  { id: 2, name: 'Audience', description: 'Select target audience' },
  { id: 3, name: 'Schedule', description: 'When to send' },
  { id: 4, name: 'Review', description: 'Confirm and create' },
];

export default function NewCampaignPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema as any),
    mode: 'onChange',
    defaultValues: {
      name: '',
      messageText: '',
      scheduleType: 'now',
      filterGender: null,
      filterAgeGroup: null,
    } as z.infer<typeof campaignSchema>,
  });

  const createMutation = useCreateCampaign();

  // Get current filter values for preview
  const currentFilters = {
    filterGender: watch('filterGender') || null,
    filterAgeGroup: watch('filterAgeGroup') || null,
    nameSearch: null,
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await trigger(['name', 'messageText']);
      if (isValid) setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const onSubmit = (data: any) => {
    if (isSubmitting || createMutation.isPending) {
      return;
    }

    const submitData = {
      name: data.name,
      messageText: data.messageText || null,
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Create Campaign</h1>
        <p className="text-sm text-text-secondary mt-1">Set up a new SMS campaign in a few simple steps</p>
      </div>

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
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                          ? 'bg-accent text-white'
                          : 'bg-surface-light text-text-tertiary'
                    }`}
                  >
                    {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-medium text-text-primary">{step.name}</div>
                    <div className="text-xs text-text-secondary">{step.description}</div>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-surface-light'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <GlassCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: Basics */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Campaign Basics</h3>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">
                    Campaign Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    {...register('name')}
                    type="text"
                    id="name"
                    maxLength={200}
                    placeholder="Summer Sale 2025"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{(errors.name as any).message}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="messageText"
                    className="block text-sm font-medium text-text-secondary mb-2"
                  >
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
                    <p className="mt-1 text-sm text-red-400">
                      {(errors.messageText as any).message}
                    </p>
                  )}
                </div>
                {Object.keys(errors).length > 0 && (errors.name || errors.messageText) && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-sm text-red-400">Please fix the errors above before proceeding.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Audience */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Target Audience</h3>
                <div>
                  <label
                    htmlFor="filterGender"
                    className="block text-sm font-medium text-text-secondary mb-2"
                  >
                    Gender Filter
                  </label>
                  <Select
                    {...register('filterGender')}
                    id="filterGender"
                  >
                    <option value="">Any</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div>
                  <label
                    htmlFor="filterAgeGroup"
                    className="block text-sm font-medium text-text-secondary mb-2"
                  >
                    Age Group Filter
                  </label>
                  <Select
                    {...register('filterAgeGroup')}
                    id="filterAgeGroup"
                  >
                    <option value="">Any</option>
                    <option value="18_24">18-24</option>
                    <option value="25_39">25-39</option>
                    <option value="40_plus">40+</option>
                  </Select>
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
                <h3 className="text-lg font-semibold text-text-primary mb-4">Schedule</h3>
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
                      className="w-4 h-4 text-accent"
                    />
                    <span className="text-sm font-medium text-text-primary">Save as draft (send later)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...register('scheduleType')}
                      value="later"
                      className="w-4 h-4 text-accent"
                    />
                    <span className="text-sm font-medium text-text-primary">Schedule for later</span>
                  </label>
                </div>
                {watch('scheduleType') === 'later' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="scheduledDate"
                        className="block text-sm font-medium text-text-secondary mb-2"
                      >
                        Date
                      </label>
                      <Input
                        {...register('scheduledDate')}
                        type="date"
                        id="scheduledDate"
                        min={new Date().toISOString().split('T')[0]}
                      />
                      {errors.scheduledDate && (
                        <p className="mt-1 text-sm text-red-400">
                          {(errors.scheduledDate as any).message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="scheduledTime"
                        className="block text-sm font-medium text-text-secondary mb-2"
                      >
                        Time
                      </label>
                      <Input {...register('scheduledTime')} type="time" id="scheduledTime" />
                      {errors.scheduledTime && (
                        <p className="mt-1 text-sm text-red-400">
                          {(errors.scheduledTime as any).message}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Review & Create</h3>
                {createMutation.isError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-400">
                      {(createMutation.error as any)?.response?.data?.message ||
                        'Failed to create campaign. Please try again.'}
                    </p>
                  </div>
                )}
                <div className="bg-surface-light rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-sm font-medium text-text-secondary">Campaign Name:</span>
                    <span className="ml-2 text-sm text-text-primary">{watch('name')}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-text-secondary">Message:</span>
                    <div className="mt-1 text-sm text-text-primary bg-background p-2 rounded border border-border whitespace-pre-wrap">
                      {watch('messageText') || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-text-secondary">Gender Filter:</span>
                    <span className="ml-2 text-sm text-text-primary capitalize">
                      {watch('filterGender') || 'Any'}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-text-secondary">Age Group:</span>
                    <span className="ml-2 text-sm text-text-primary">
                      {watch('filterAgeGroup') ? watch('filterAgeGroup')?.replace('_', '-') || 'Any' : 'Any'}
                    </span>
                  </div>
                  {audienceCount !== null && (
                    <div>
                      <span className="text-sm font-medium text-text-secondary">Recipients:</span>
                      <span className="ml-2 text-sm text-text-primary">
                        {audienceCount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-text-secondary">Schedule:</span>
                    <span className="ml-2 text-sm text-text-primary">
                      {watch('scheduledDate') && watch('scheduledTime')
                        ? `${watch('scheduledDate')} at ${watch('scheduledTime')}`
                        : 'Draft (send later)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <Button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                variant="outline"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {currentStep < 4 ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending}
                >
                  {isSubmitting || createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                </Button>
              )}
            </div>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}

