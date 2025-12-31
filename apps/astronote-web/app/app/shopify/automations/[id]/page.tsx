'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAutomations } from '@/src/features/shopify/automations/hooks/useAutomations';
import { useUpdateAutomation } from '@/src/features/shopify/automations/hooks/useAutomationMutations';
import { useAutomationVariables } from '@/src/features/shopify/automations/hooks/useAutomationVariables';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Info, AlertCircle } from 'lucide-react';
import type { AutomationStatus } from '@/src/lib/shopify/api/automations';

/**
 * Edit Automation Page
 */
export default function EditAutomationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: automations, isLoading } = useAutomations();
  const updateAutomation = useUpdateAutomation();

  // Find the automation
  const automation = automations?.find((a) => a.id === id);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    status: 'draft' as AutomationStatus,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load automation data when available
  useEffect(() => {
    if (automation) {
      setFormData({
        name: automation.name || '',
        message: automation.message || '',
        status: automation.status || 'draft',
      });
    }
  }, [automation]);

  // Fetch variables for the automation's trigger
  const { data: variablesData } = useAutomationVariables(automation?.trigger);

  const variables = variablesData?.variables || [];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Automation name is required';
    } else if (formData.name.length > 255) {
      newErrors.name = 'Automation name must be less than 255 characters';
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
      await updateAutomation.mutateAsync({
        id,
        data: {
          message: formData.message.trim(),
          status: formData.status,
        },
      });
      router.push('/app/shopify/automations');
    } catch (error) {
      // Error handled by mutation hook
    }
  };

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

  // Calculate SMS parts
  const smsParts = Math.ceil(formData.message.length / 160);
  const smsCount = formData.message.length > 0 ? smsParts : 0;

  // Loading state
  if (isLoading) {
    return (
      <div>
        <RetailPageHeader title="Edit Automation" />
        <RetailCard className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded bg-surface-light" />
            ))}
          </div>
        </RetailCard>
      </div>
    );
  }

  // Error state
  if (!automation) {
    return (
      <div>
        <RetailPageHeader title="Edit Automation" />
        <RetailCard variant="danger" className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Automation Not Found</h3>
            <p className="text-sm text-text-secondary mb-4">
              The automation you are looking for does not exist.
            </p>
            <Link href="/app/shopify/automations">
              <Button variant="outline">Back to Automations</Button>
            </Link>
          </div>
        </RetailCard>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/app/shopify/automations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <RetailPageHeader
            title="Edit Automation"
            description={`Editing: ${automation.name}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <RetailCard className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Automation Name (read-only) */}
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-text-secondary">
                  Automation Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  disabled
                  className="bg-surface-light"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  Automation name cannot be changed after creation
                </p>
              </div>

              {/* Trigger (read-only) */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Trigger Type
                </label>
                <Input
                  value={automation.trigger.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  disabled
                  className="bg-surface-light"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  Trigger type cannot be changed after creation
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
              {variables.length > 0 && (
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
                  Status
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
                      <div className="text-sm font-medium text-text-primary">Draft</div>
                      <div className="text-xs text-text-tertiary">
                        Automation is saved but not active.
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
                      <div className="text-sm font-medium text-text-primary">Active</div>
                      <div className="text-xs text-text-tertiary">
                        Automation is active and will send messages automatically.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="paused"
                      checked={formData.status === 'paused'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as AutomationStatus,
                        })
                      }
                      className="h-4 w-4 accent-accent"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary">Paused</div>
                      <div className="text-xs text-text-tertiary">
                        Automation is paused and will not send messages.
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
                <Button type="submit" disabled={updateAutomation.isPending} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {updateAutomation.isPending ? 'Saving...' : 'Save Changes'}
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
                <div className="text-text-primary">{formData.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Trigger</div>
                <div className="text-text-primary capitalize">
                  {automation.trigger.replace(/_/g, ' ')}
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
                <StatusBadge
                  status={
                    formData.status === 'active'
                      ? 'success'
                      : formData.status === 'paused'
                        ? 'warning'
                        : 'default'
                  }
                  label={formData.status}
                />
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
          {variables.length > 0 && (
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
  );
}

