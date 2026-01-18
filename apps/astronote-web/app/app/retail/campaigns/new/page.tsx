'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignSchema } from '@/src/lib/retail/validators';
import { z } from 'zod';
import { useCreateCampaign } from '@/src/features/retail/campaigns/hooks/useCreateCampaign';
import { AudiencePreviewPanel } from '@/src/features/retail/campaigns/components/AudiencePreviewPanel';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { SmsInPhonePreview } from '@/src/components/phone/SmsInPhonePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

const STEPS = [
  { id: 1, name: 'Basics', description: 'Campaign name and message' },
  { id: 2, name: 'Audience', description: 'Select target audience' },
  { id: 3, name: 'Schedule', description: 'When to send' },
  { id: 4, name: 'Review', description: 'Confirm and create' },
] as const;

export default function NewCampaignPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    register,
    control,
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

  const messageRegister = register('messageText');

  const createMutation = useCreateCampaign();

  const currentFilters = {
    filterGender: watch('filterGender') || null,
    filterAgeGroup: watch('filterAgeGroup') || null,
    nameSearch: null,
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await trigger(['name', 'messageText']);
      if (isValid) setCurrentStep(2);
      return;
    }
    if (currentStep < 4) setCurrentStep(s => s + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(s => s - 1);
  };

  const onSubmit = (data: any) => {
    if (isSubmitting || createMutation.isPending) return;

    const scheduleFields =
      data.scheduleType === 'later' &&
      data.scheduledDate &&
      data.scheduledTime
        ? {
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
        }
        : {};

    const submitData = {
      name: data.name,
      messageText: data.messageText || null,
      filterGender:
        data.filterGender && data.filterGender.trim()
          ? data.filterGender
          : null,
      filterAgeGroup:
        data.filterAgeGroup && data.filterAgeGroup.trim()
          ? data.filterAgeGroup
          : null,
      ...scheduleFields,
    };

    setIsSubmitting(true);
    createMutation.mutate(submitData, {
      onSuccess: () => setIsSubmitting(false),
      onError: () => setIsSubmitting(false),
    });
  };

  const insertVariable = (variable: string) => {
    const token = `{{${variable}}}`;
    const current = watch('messageText') || '';
    const el = messageRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
      setValue('messageText', next, { shouldDirty: true, shouldTouch: true });
      setTimeout(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      }, 0);
      return;
    }
    setValue('messageText', current + token, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          Create Campaign
        </h1>
        <p className="text-sm text-text-secondary">
          Set up a new SMS campaign in a few simple steps.
        </p>
      </div>

      <div className="mx-auto w-full max-w-4xl">
        {/* Step indicator */}
        <div className="mb-8">
          <div className="rounded-2xl border border-border bg-background/60 p-4 backdrop-blur-sm">
            <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-0">
              {STEPS.map((step, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === STEPS.length - 1;
                const isDone = currentStep > step.id;
                const isActive = currentStep === step.id;

                return (
                  <li key={step.id} className="flex flex-1 items-center">
                    {/* left connector */}
                    <div
                      className={[
                        'hidden sm:block h-[2px] flex-1 rounded-full',
                        isFirst
                          ? 'bg-transparent'
                          : isDone
                            ? 'bg-green-500'
                            : 'bg-border',
                      ].join(' ')}
                    />

                    {/* step */}
                    <div className="flex flex-1 items-start gap-3 sm:flex-none sm:flex-col sm:items-center sm:gap-2">
                      <div
                        className={[
                          'relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold',
                          'ring-1 ring-inset transition-colors',
                          isDone
                            ? 'bg-green-500 text-white ring-green-500/25'
                            : isActive
                              ? 'bg-accent text-white ring-accent/25'
                              : 'bg-surface-light text-text-tertiary ring-border',
                        ].join(' ')}
                      >
                        {isDone ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <span>{step.id}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div
                          className={[
                            'text-sm font-semibold',
                            isActive
                              ? 'text-text-primary'
                              : 'text-text-secondary',
                          ].join(' ')}
                        >
                          {step.name}
                        </div>
                        <div className="text-xs text-text-tertiary">
                          {step.description}
                        </div>
                      </div>
                    </div>

                    {/* right connector */}
                    <div
                      className={[
                        'hidden sm:block h-[2px] flex-1 rounded-full',
                        isLast
                          ? 'bg-transparent'
                          : isDone
                            ? 'bg-green-500'
                            : 'bg-border',
                      ].join(' ')}
                    />
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <RetailCard>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Basics */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="lg:hidden flex items-center gap-2 rounded-xl border border-border bg-surface-light px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mobileTab === 'edit' ? 'default' : 'ghost'}
                    className="flex-1"
                    onClick={() => setMobileTab('edit')}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mobileTab === 'preview' ? 'default' : 'ghost'}
                    className="flex-1"
                    onClick={() => setMobileTab('preview')}
                  >
                    Preview
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Form Column */}
                  <div
                    className={`lg:col-span-2 space-y-4 min-w-0 ${
                      mobileTab === 'preview' ? 'hidden lg:block' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-text-primary">
                        Campaign Basics
                      </h3>
                      <p className="text-sm text-text-secondary">
                        Give your campaign a clear name and write your SMS
                        message.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="name"
                        className="mb-2 block text-sm font-medium text-text-secondary"
                      >
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
                        <p className="mt-1 text-sm text-red-400">
                          {(errors.name as any).message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="messageText"
                        className="mb-2 block text-sm font-medium text-text-secondary"
                      >
                        Message Text <span className="text-red-400">*</span>
                      </label>
                      <Textarea
                        {...messageRegister}
                        id="messageText"
                        rows={6}
                        maxLength={2000}
                        placeholder="Enter your SMS message here. Use {{firstName}} for personalization."
                        ref={el => {
                          messageRegister.ref(el);
                          messageRef.current = el;
                        }}
                      />
                      <p className="mt-1 text-xs text-text-tertiary">
                        Max 2000 characters. Use variables like {'{{'}firstName
                        {'}}'} for personalization.
                      </p>
                      {errors.messageText && (
                        <p className="mt-1 text-sm text-red-400">
                          {(errors.messageText as any).message}
                        </p>
                      )}
                      <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-light p-3">
                        <div className="flex flex-wrap gap-2">
                          {['firstName', 'lastName'].map(v => (
                            <Button
                              key={v}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => insertVariable(v)}
                            >
                              {'{{'}
                              {v}
                              {'}}'}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-text-secondary">
                          Personalization supports the variables above. Use the exact casing shown.
                        </p>
                        <p className="text-xs text-text-secondary">
                          Unsubscribe is appended automatically at send time and shortened by the system.
                        </p>
                        <p className="text-xs text-text-tertiary">
                          Keep messages concise; the preview shows length and GSM character counts.
                        </p>
                      </div>
                    </div>

                    {Object.keys(errors).length > 0 &&
                      (errors.name || errors.messageText) && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                        <p className="text-sm text-red-400">
                          Please fix the errors above before proceeding.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Preview Column (Desktop: Sticky, Mobile: Below) */}
                  <div
                    className={`lg:col-span-1 min-w-0 ${
                      mobileTab === 'edit' ? 'hidden lg:block' : ''
                    }`}
                  >
                    <div className="lg:sticky lg:top-24 max-w-full overflow-hidden">
                      <RetailCard className="p-6">
                        <h3 className="text-lg font-semibold text-text-primary mb-4">
                          Message Preview
                        </h3>
                        <div className="flex justify-center lg:justify-start">
                          <SmsInPhonePreview
                            message={watch('messageText') || ''}
                            senderName="Astronote"
                            variant="retail"
                            size="md"
                            showCounts={true}
                          />
                        </div>
                      </RetailCard>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Audience */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Target Audience
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Narrow down who should receive this message.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label
                      htmlFor="filterGender"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      Gender Filter
                    </label>
                    <Controller
                      name="filterGender"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || undefined}
                          onValueChange={value => {
                            field.onChange(value || null);
                          }}
                        >
                          <SelectTrigger id="filterGender">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="min-w-0">
                    <label
                      htmlFor="filterAgeGroup"
                      className="mb-2 block text-sm font-medium text-text-secondary"
                    >
                      Age Group Filter
                    </label>
                    <Controller
                      name="filterAgeGroup"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || undefined}
                          onValueChange={value => {
                            field.onChange(value || null);
                          }}
                        >
                          <SelectTrigger id="filterAgeGroup">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="18_24">18-24</SelectItem>
                            <SelectItem value="25_39">25-39</SelectItem>
                            <SelectItem value="40_plus">40+</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
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
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Schedule
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Save as draft or schedule a send time.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...register('scheduleType')}
                      value="now"
                      defaultChecked
                      onChange={e => {
                        if (e.target.checked) {
                          setValue('scheduledDate', '');
                          setValue('scheduledTime', '');
                        }
                      }}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="text-sm font-medium text-text-primary">
                      Save as draft (send later)
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...register('scheduleType')}
                      value="later"
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="text-sm font-medium text-text-primary">
                      Schedule for later
                    </span>
                  </label>
                </div>

                {watch('scheduleType') === 'later' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label
                        htmlFor="scheduledDate"
                        className="mb-2 block text-sm font-medium text-text-secondary"
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

                    <div className="min-w-0">
                      <label
                        htmlFor="scheduledTime"
                        className="mb-2 block text-sm font-medium text-text-secondary"
                      >
                        Time
                      </label>
                      <Input
                        {...register('scheduledTime')}
                        type="time"
                        id="scheduledTime"
                      />
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
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Review & Create
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Double-check details before creating.
                  </p>
                </div>

                {createMutation.isError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-sm text-red-400">
                      {(createMutation.error as any)?.response?.data?.message ||
                        'Failed to create campaign. Please try again.'}
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-surface-light p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-secondary">
                      Campaign Name:
                    </span>
                    <span className="text-sm text-text-primary">
                      {watch('name') || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-sm font-medium text-text-secondary">
                      Message:
                    </span>
                    <div className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm text-text-primary">
                      {watch('messageText') || '—'}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-secondary">
                        Gender Filter:
                      </span>
                      <span className="text-sm text-text-primary capitalize">
                        {watch('filterGender') || 'All'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-secondary">
                        Age Group:
                      </span>
                      <span className="text-sm text-text-primary">
                        {watch('filterAgeGroup')
                          ? watch('filterAgeGroup')?.replace('_', '-')
                          : 'All'}
                      </span>
                    </div>
                  </div>

                  {audienceCount !== null && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-secondary">
                        Recipients:
                      </span>
                      <span className="text-sm text-text-primary">
                        {audienceCount.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-secondary">
                      Schedule:
                    </span>
                    <span className="text-sm text-text-primary">
                      {watch('scheduledDate') && watch('scheduledTime')
                        ? `${watch('scheduledDate')} at ${watch('scheduledTime')}`
                        : 'Draft (send later)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between border-t border-border pt-6">
              <Button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                variant="outline"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {currentStep < 4 ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending}
                >
                  {isSubmitting || createMutation.isPending
                    ? 'Creating...'
                    : 'Create Campaign'}
                </Button>
              )}
            </div>
          </form>
        </RetailCard>
      </div>
    </div>
  );
}
