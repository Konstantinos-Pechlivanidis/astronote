'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCreateAutomation } from '@/src/features/shopify/automations/hooks/useAutomationMutations';
import { useAutomationVariables } from '@/src/features/shopify/automations/hooks/useAutomationVariables';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Info } from 'lucide-react';
import type { AutomationTrigger, AutomationStatus } from '@/src/lib/shopify/api/automations';

/**
 * Create Automation Page
 */
export default function NewAutomationPage() {
  const createAutomation = useCreateAutomation();

  const [formData, setFormData] = useState({
    name: '',
    trigger: '' as AutomationTrigger | '',
    message: '',
    status: 'draft' as AutomationStatus,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch variables when trigger is selected
  const { data: variablesData } = useAutomationVariables(
    formData.trigger || undefined,
  );

  const variables = variablesData?.variables || [];

  // Available trigger types
  const triggerOptions: Array<{ value: AutomationTrigger; label: string; description: string }> = [
    { value: 'welcome', label: 'Welcome Message', description: 'Send when a new contact is added' },
    { value: 'birthday', label: 'Birthday Message', description: 'Send on contact birthday' },
    { value: 'order_placed', label: 'Order Placed', description: 'Send when an order is placed' },
    { value: 'order_fulfilled', label: 'Order Fulfilled', description: 'Send when an order is fulfilled' },
    { value: 'order_confirmation', label: 'Order Confirmation', description: 'Send order confirmation' },
    { value: 'shipping_update', label: 'Shipping Update', description: 'Send shipping updates' },
    { value: 'delivery_confirmation', label: 'Delivery Confirmation', description: 'Send delivery confirmation' },
    { value: 'review_request', label: 'Review Request', description: 'Request product review' },
    { value: 'reorder_reminder', label: 'Reorder Reminder', description: 'Remind to reorder' },
    { value: 'cross_sell', label: 'Cross Sell', description: 'Cross-sell products' },
    { value: 'upsell', label: 'Upsell', description: 'Upsell products' },
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Automation name is required';
    } else if (formData.name.length > 255) {
      newErrors.name = 'Automation name must be less than 255 characters';
    }

    if (!formData.trigger) {
      newErrors.trigger = 'Trigger type is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    } else if (formData.message.length > 1600) {
      newErrors.message = 'Message must be less than 1600 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    try {
      await createAutomation.mutateAsync({
        name: formData.name.trim(),
        trigger: formData.trigger as AutomationTrigger,
        message: formData.message.trim(),
        status: formData.status,
      });
      // Navigation handled by mutation hook
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Calculate SMS parts
  const smsParts = Math.ceil(formData.message.length / 160);
  const smsCount = formData.message.length > 0 ? smsParts : 0;

  // Insert variable into message at cursor position
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.message;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = `${before}{{${variable}}}${after}`;

    setFormData({ ...formData, message: newText });

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length + 4; // {{variable}}
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/app/shopify/automations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
            Back
            </Button>
          </Link>
          <div className="flex-1">
            <RetailPageHeader
              title="Create Automation"
              description="Set up an automated SMS workflow"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Form */}
          <div className="lg:col-span-2">
            <RetailCard className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Automation Name */}
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-text-secondary">
                  Automation Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Welcome Message Automation"
                    maxLength={255}
                    className={errors.name ? 'border-red-400' : ''}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                  )}
                  <p className="mt-1 text-xs text-text-tertiary">
                    {formData.name.length}/255 characters
                  </p>
                </div>

                {/* Trigger Type */}
                <div>
                  <label htmlFor="trigger" className="mb-2 block text-sm font-medium text-text-secondary">
                  Trigger Type <span className="text-red-400">*</span>
                  </label>
                  <Select
                    value={formData.trigger}
                    onValueChange={(value) =>
                      setFormData({ ...formData, trigger: value as AutomationTrigger, message: '' })
                    }
                  >
                    <SelectTrigger id="trigger" className={errors.trigger ? 'border-red-400' : ''}>
                      <SelectValue placeholder="Select trigger type" />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-text-tertiary">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.trigger && (
                    <p className="mt-1 text-sm text-red-400">{errors.trigger}</p>
                  )}
                  {formData.trigger && (
                    <p className="mt-1 text-xs text-text-tertiary">
                      {triggerOptions.find((o) => o.value === formData.trigger)?.description}
                    </p>
                  )}
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
                    placeholder="Enter your SMS message here. Use variables like {{firstName}} for personalization."
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

                {/* Available Variables */}
                {formData.trigger && variables.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4 text-text-tertiary" />
                      <label className="text-sm font-medium text-text-secondary">
                      Available Variables
                      </label>
                    </div>
                    <div className="rounded-lg bg-surface-light border border-border p-4">
                      <div className="flex flex-wrap gap-2">
                        {variables.map((variable) => (
                          <button
                            key={variable.name}
                            type="button"
                            onClick={() => insertVariable(variable.name)}
                            className="text-xs px-3 py-1.5 rounded bg-background border border-border hover:border-accent hover:text-accent transition-colors"
                            title={variable.description}
                          >
                            {`{{${variable.name}}}`}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-text-tertiary">
                      Click a variable to insert it into your message
                      </p>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Initial Status
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="draft"
                        checked={formData.status === 'draft'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as AutomationStatus,
                          })
                        }
                        className="h-4 w-4 accent-accent"
                      />
                      <div>
                        <div className="text-sm font-medium text-text-primary">Save as Draft</div>
                        <div className="text-xs text-text-tertiary">
                        Create the automation but don&apos;t activate it yet.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="active"
                        checked={formData.status === 'active'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as AutomationStatus,
                          })
                        }
                        className="h-4 w-4 accent-accent"
                      />
                      <div>
                        <div className="text-sm font-medium text-text-primary">Activate Immediately</div>
                        <div className="text-xs text-text-tertiary">
                        Start sending messages automatically when the trigger occurs.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <Link href="/app/shopify/automations">
                    <Button type="button" variant="outline">
                    Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={createAutomation.isPending} className="flex-1">
                    <Save className="mr-2 h-4 w-4" />
                    {createAutomation.isPending ? 'Creating...' : 'Create Automation'}
                  </Button>
                </div>
              </form>
            </RetailCard>
          </div>

          {/* Preview/Info Sidebar */}
          <div className="lg:col-span-1">
            <RetailCard className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Automation Preview</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Name</div>
                  <div className="text-text-primary">
                    {formData.name || <span className="text-text-tertiary">Untitled Automation</span>}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Trigger</div>
                  <div className="text-text-primary capitalize">
                    {formData.trigger
                      ? triggerOptions.find((o) => o.value === formData.trigger)?.label || formData.trigger.replace(/_/g, ' ')
                      : <span className="text-text-tertiary">Not selected</span>}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Message</div>
                  <div className="rounded-lg bg-surface-light border border-border p-4">
                    <p className="text-sm text-text-primary whitespace-pre-wrap">
                      {formData.message || (
                        <span className="text-text-tertiary">Your message will appear here...</span>
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Status</div>
                  <div className="text-text-primary capitalize">{formData.status}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">SMS Parts</div>
                  <div className="text-text-primary">
                    {smsCount} part{smsCount !== 1 ? 's' : ''} ({formData.message.length} characters)
                  </div>
                </div>
              </div>
            </RetailCard>

            {/* Variables Info */}
            {formData.trigger && variables.length > 0 && (
              <RetailCard className="p-6 mt-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Variable Details</h3>
                <div className="space-y-3">
                  {variables.map((variable) => (
                    <div key={variable.name} className="border-b border-border pb-3 last:border-0">
                      <div className="text-sm font-medium text-text-primary mb-1">
                        {`{{${variable.name}}}`}
                      </div>
                      <div className="text-xs text-text-secondary mb-1">{variable.description}</div>
                      {variable.example && (
                        <div className="text-xs text-text-tertiary">
                        Example: {variable.example}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </RetailCard>
            )}
          </div>
        </div>
      </div>
    </RetailPageLayout>
  );
}

