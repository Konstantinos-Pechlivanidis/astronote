'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSettings } from '@/src/features/shopify/settings/hooks/useSettings';
import { useAccountInfo } from '@/src/features/shopify/settings/hooks/useAccountInfo';
import { useUpdateSettings } from '@/src/features/shopify/settings/hooks/useUpdateSettings';
import { PageLayout } from '@/src/components/app-shell/PageLayout';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings as SettingsIcon,
  MessageSquare,
  Link as LinkIcon,
  User,
  Save,
  AlertCircle,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Settings Page
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'sms' | 'integrations' | 'account'>('general');
  const [formData, setFormData] = useState({
    senderId: '',
    timezone: 'UTC',
    currency: 'EUR',
    baseUrl: '', // Public base URL override
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Fetch data
  const { data: settingsData, isLoading: settingsLoading, error: settingsError } = useSettings();
  const { data: accountData, isLoading: accountLoading, error: accountError } = useAccountInfo();
  const updateSettings = useUpdateSettings();

  // Normalize data
  const settings = useMemo(() => settingsData || {}, [settingsData]);
  const account = accountData || {};

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setFormData({
        senderId: (settings as any).senderId || '',
        timezone: (settings as any).timezone || 'UTC',
        currency: (settings as any).currency || 'EUR',
        baseUrl: (settings as any).baseUrl || '', // Load baseUrl from settings
      });
    }
  }, [settings]);

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Validate senderId if provided
    if (formData.senderId && formData.senderId.trim()) {
      const senderId = formData.senderId.trim();
      const isE164 = /^\+[1-9]\d{1,14}$/.test(senderId);
      const isAlphanumeric = /^[a-zA-Z0-9]{3,11}$/.test(senderId);

      if (!isE164 && !isAlphanumeric) {
        newErrors.senderId =
          'Sender ID must be either a valid E.164 phone number (e.g., +1234567890) or 3-11 alphanumeric characters';
      }
    }

    // Validate baseUrl if provided
    if (formData.baseUrl && formData.baseUrl.trim()) {
      try {
        const url = new URL(formData.baseUrl.trim());
        // Validate protocol (http/https only)
        if (!['http:', 'https:'].includes(url.protocol)) {
          newErrors.baseUrl = 'Base URL must use http or https protocol';
        }
        // Validate hostname (prevent injection)
        const hostnameRegex = /^[a-zA-Z0-9.-]+(:\d+)?$/;
        if (!hostnameRegex.test(url.hostname) || url.hostname.length > 255) {
          newErrors.baseUrl = 'Invalid base URL hostname format';
        }
      } catch (error) {
        newErrors.baseUrl = 'Invalid base URL format. Must be a valid URL (e.g., https://example.com)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    // Check if anything has changed
    const hasChanges =
      formData.senderId !== ((settings as any)?.senderId || '') ||
      formData.timezone !== ((settings as any)?.timezone || 'UTC') ||
      formData.currency !== ((settings as any)?.currency || 'EUR') ||
      formData.baseUrl !== ((settings as any)?.baseUrl || '');

    if (!hasChanges) {
      return;
    }

    try {
      const updateData: Record<string, string> = {};
      if (formData.senderId !== ((settings as any)?.senderId || '')) {
        updateData.senderId = formData.senderId;
      }
      if (formData.timezone !== ((settings as any)?.timezone || 'UTC')) {
        updateData.timezone = formData.timezone;
      }
      if (formData.currency !== ((settings as any)?.currency || 'EUR')) {
        updateData.currency = formData.currency;
      }
      if (formData.baseUrl !== ((settings as any)?.baseUrl || '')) {
        (updateData as any).baseUrl = formData.baseUrl || null; // Allow clearing baseUrl
      }

      await updateSettings.mutateAsync(updateData);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleCopyWebhook = async () => {
    if (typeof window === 'undefined') return;
    const webhookUrl = `${window.location.origin}/webhooks/shopify`;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to copy:', error);
      }
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: SettingsIcon, description: 'Store preferences' },
    { id: 'sms' as const, label: 'SMS Settings', icon: MessageSquare, description: 'Messaging configuration' },
    { id: 'integrations' as const, label: 'Integrations', icon: LinkIcon, description: 'Third-party connections' },
    { id: 'account' as const, label: 'Account', icon: User, description: 'Account & usage' },
  ];

  // Loading state
  const isLoading = settingsLoading || accountLoading;
  const hasError = settingsError || accountError;

  return (
    <PageLayout title="Settings" description="Manage your account and SMS settings">

      {hasError && (
        <RetailCard variant="danger" className="p-6 mb-6">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Error Loading Settings</h3>
            <p className="text-sm text-text-secondary mb-4">
              {settingsError instanceof Error
                ? settingsError.message
                : accountError instanceof Error
                  ? accountError.message
                  : 'Failed to load settings. Please try refreshing the page.'}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </RetailCard>
      )}

      {!hasError && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar Navigation - Desktop */}
          <aside className="lg:col-span-3">
            <div className="hidden lg:block sticky top-6">
              <RetailCard className="p-0 overflow-hidden">
                <div className="p-4 border-b border-border bg-surface-light">
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Settings</h3>
                </div>
                <nav className="p-2 space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 text-left ${
                          activeTab === tab.id
                            ? 'bg-accent/10 text-accent border border-accent/20'
                            : 'text-text-primary hover:bg-surface-light hover:text-accent'
                        }`}
                        aria-label={tab.label}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                      >
                        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${activeTab === tab.id ? 'text-accent' : 'text-text-tertiary'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{tab.label}</div>
                          <div className={`text-xs mt-0.5 ${activeTab === tab.id ? 'text-accent/80' : 'text-text-tertiary'}`}>
                            {tab.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </RetailCard>
            </div>

            {/* Mobile Tabs */}
            <div className="lg:hidden mb-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px] ${
                        activeTab === tab.id
                          ? 'bg-accent text-white'
                          : 'bg-surface-light text-text-primary hover:bg-surface-light/80'
                      }`}
                      aria-label={`View ${tab.label} settings`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9">
            {/* General Settings */}
            {activeTab === 'general' && (
              <RetailCard className="p-6">
                <h2 className="text-2xl font-bold text-text-primary mb-6">General Settings</h2>
                <p className="text-sm text-text-secondary mb-6">Configure your store preferences and defaults</p>

                <div className="space-y-6">
                  {/* Sender ID Section */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary mb-1">Sender Configuration</h3>
                      <p className="text-sm text-text-secondary">Set your SMS sender ID or phone number</p>
                    </div>
                    <div>
                      <label htmlFor="senderId" className="mb-2 block text-sm font-medium text-text-secondary">
                        Sender ID / Name
                      </label>
                      <Input
                        id="senderId"
                        type="text"
                        value={formData.senderId}
                        onChange={(e) => handleChange('senderId', e.target.value)}
                        onBlur={() => {
                          if (formData.senderId && formData.senderId.trim()) {
                            const senderId = formData.senderId.trim();
                            const isE164 = /^\+[1-9]\d{1,14}$/.test(senderId);
                            const isAlphanumeric = /^[a-zA-Z0-9]{3,11}$/.test(senderId);
                            if (!isE164 && !isAlphanumeric) {
                              setErrors({
                                ...errors,
                                senderId:
                                  'Sender ID must be either a valid E.164 phone number (e.g., +1234567890) or 3-11 alphanumeric characters',
                              });
                            }
                          }
                        }}
                        placeholder="Your Store Name or +1234567890"
                        className={errors.senderId ? 'border-red-400' : ''}
                      />
                      {errors.senderId && (
                        <p className="mt-1 text-sm text-red-400">{errors.senderId}</p>
                      )}
                      <p className="mt-1 text-xs text-text-tertiary">
                        Use a phone number (E.164 format) or 3-11 character alphanumeric name
                      </p>
                    </div>
                  </div>

                  {/* Timezone & Currency Section */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary mb-1">Regional Settings</h3>
                      <p className="text-sm text-text-secondary">Configure timezone and currency preferences</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-text-secondary">
                          Default Timezone
                        </label>
                        <Select value={formData.timezone} onValueChange={(value) => handleChange('timezone', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="America/New_York">Eastern Time</SelectItem>
                            <SelectItem value="America/Chicago">Central Time</SelectItem>
                            <SelectItem value="America/Denver">Mountain Time</SelectItem>
                            <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                            <SelectItem value="Europe/London">London</SelectItem>
                            <SelectItem value="Europe/Paris">Paris</SelectItem>
                            <SelectItem value="Europe/Athens">Athens</SelectItem>
                            <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-text-secondary">Currency</label>
                        <Select value={formData.currency} onValueChange={(value) => handleChange('currency', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Public Links Configuration Section */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary mb-1">Public Links Configuration</h3>
                      <p className="text-sm text-text-secondary">
                        Base URL used for generating unsubscribe links and short links. Leave empty to use default.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="baseUrl" className="mb-2 block text-sm font-medium text-text-secondary">
                        Base URL
                      </label>
                      <Input
                        id="baseUrl"
                        type="url"
                        value={formData.baseUrl}
                        onChange={(e) => handleChange('baseUrl', e.target.value)}
                        placeholder="https://example.com (optional)"
                        className={errors.baseUrl ? 'border-red-400' : ''}
                      />
                      {errors.baseUrl && (
                        <p className="mt-1 text-sm text-red-400">{errors.baseUrl}</p>
                      )}
                      <p className="mt-1 text-xs text-text-tertiary">
                        Used for unsubscribe links and short links. Must be a valid URL (http:// or https://).
                      </p>
                    </div>
                  </div>

                  {/* Store Information Section */}
                  {(settings as any).shopDomain && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-1">Store Information</h3>
                        <p className="text-sm text-text-secondary">Your connected Shopify store details</p>
                      </div>
                      <RetailCard className="p-5 bg-surface-light">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Store Name</p>
                            <p className="text-base font-semibold text-text-primary break-words">
                              {(settings as any).shopName || (settings as any).shopDomain || 'N/A'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Domain</p>
                            <p className="text-base font-semibold text-text-primary break-all">
                              {(settings as any).shopDomain || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </RetailCard>
                    </div>
                  )}

                  {/* Save Button */}
                  <div className="flex justify-end pt-6 border-t border-border">
                    <Button onClick={handleSave} disabled={updateSettings.isPending || isLoading} className="min-w-[180px]">
                      {updateSettings.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </RetailCard>
            )}

            {/* SMS Settings */}
            {activeTab === 'sms' && (
              <RetailCard className="p-6">
                <h2 className="text-2xl font-bold text-text-primary mb-6">SMS Settings</h2>
                <p className="text-sm text-text-secondary mb-6">Configure your SMS messaging preferences</p>

                <div className="space-y-6">
                  <RetailCard className="p-5 bg-surface-light">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-text-primary mb-2">Sender Configuration</h3>
                        <p className="text-sm text-text-secondary leading-relaxed">
                          SMS settings are managed through the General tab. Use the Sender ID field to set your SMS sender
                          number or name. This will be used for all campaigns and automations.
                        </p>
                      </div>
                    </div>
                  </RetailCard>

                  {(settings as any).senderId && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-1">Current Sender ID</h3>
                        <p className="text-sm text-text-secondary">Active sender identifier for your SMS messages</p>
                      </div>
                      <RetailCard className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-secondary mb-1">Sender ID</p>
                            <p className="text-lg font-bold text-text-primary break-all">{(settings as any).senderId}</p>
                          </div>
                          <StatusBadge status="success" label="Active" />
                        </div>
                      </RetailCard>
                    </div>
                  )}
                </div>
              </RetailCard>
            )}

            {/* Integrations */}
            {activeTab === 'integrations' && (
              <RetailCard className="p-6">
                <h2 className="text-2xl font-bold text-text-primary mb-6">Integrations</h2>
                <p className="text-sm text-text-secondary mb-6">Manage your third-party integrations</p>

                <div className="space-y-6">
                  {/* Shopify Connection */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary mb-1">Shopify Connection</h3>
                      <p className="text-sm text-text-secondary">Your connected Shopify store</p>
                    </div>
                    <RetailCard className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-surface-light">
                            <LinkIcon className="h-6 w-6 text-accent" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-text-primary">
                              {(settings as any).shopName || (settings as any).shopDomain || 'Not connected'}
                            </p>
                            <p className="text-sm text-text-secondary mt-0.5">
                              {(settings as any).shopDomain ? 'Connected' : 'Not connected'}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={(settings as any).shopDomain ? 'success' : 'warning'} label={(settings as any).shopDomain ? 'Active' : 'Pending'} />
                      </div>
                      {(settings as any).shopDomain && (
                        <div className="pt-5 border-t border-border">
                          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
                            Shop Domain
                          </p>
                          <code className="block text-sm text-text-primary font-mono break-all bg-surface-light px-4 py-3 rounded-lg border border-border">
                            {(settings as any).shopDomain}
                          </code>
                        </div>
                      )}
                    </RetailCard>
                  </div>

                  {/* Webhook URL */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary mb-1">Webhook Configuration</h3>
                      <p className="text-sm text-text-secondary">Configure webhooks for real-time updates</p>
                    </div>
                    <RetailCard className="p-5">
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <LinkIcon className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-secondary mb-3">
                              Use this URL in your Shopify webhook settings
                            </p>
                            {typeof window !== 'undefined' && (
                              <code className="block text-sm text-text-primary break-all font-mono bg-surface-light px-4 py-3 rounded-lg border border-border">
                                {window.location.origin}/webhooks/shopify
                              </code>
                            )}
                          </div>
                        </div>
                        {typeof window !== 'undefined' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyWebhook}
                            className="w-full sm:w-auto"
                          >
                            {copied ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy URL
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </RetailCard>
                  </div>
                </div>
              </RetailCard>
            )}

            {/* Account */}
            {activeTab === 'account' && (
              <RetailCard className="p-6">
                <h2 className="text-2xl font-bold text-text-primary mb-6">Account Information</h2>
                <p className="text-sm text-text-secondary mb-6">View your account details and usage statistics</p>

                <div className="space-y-8">
                  {/* Account Details */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary mb-1">Store Details</h3>
                      <p className="text-sm text-text-secondary">Your account and store information</p>
                    </div>
                    <RetailCard className="p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Store Name</p>
                          <p className="text-base font-semibold text-text-primary">
                            {(account as any).shopName || (settings as any).shopName || 'N/A'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Domain</p>
                          <p className="text-base font-semibold text-text-primary break-all">
                            {(account as any).shopDomain || (settings as any).shopDomain || 'N/A'}
                          </p>
                        </div>
                        {(account as any).createdAt && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Created</p>
                            <p className="text-base font-semibold text-text-primary">
                              {format(new Date((account as any).createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        )}
                        {(settings as any).credits !== undefined && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Credits</p>
                            <p className="text-base font-semibold text-accent">
                              {((settings as any).credits as number)?.toLocaleString() || 0}
                            </p>
                          </div>
                        )}
                      </div>
                    </RetailCard>
                  </div>

                  {/* Usage Statistics */}
                  {(account as any).usage && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-1">Usage Statistics</h3>
                        <p className="text-sm text-text-secondary">Overview of your account activity</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <RetailCard className="p-5">
                          <div className="flex items-center gap-2.5 mb-3">
                            <User className="h-5 w-5 text-accent" />
                            <p className="text-xs font-medium text-text-secondary">Contacts</p>
                          </div>
                          <p className="text-2xl font-bold text-text-primary">
                            {(((account as any).usage as any).totalContacts || 0).toLocaleString()}
                          </p>
                        </RetailCard>
                        <RetailCard className="p-5">
                          <div className="flex items-center gap-2.5 mb-3">
                            <MessageSquare className="h-5 w-5 text-accent" />
                            <p className="text-xs font-medium text-text-secondary">Campaigns</p>
                          </div>
                          <p className="text-2xl font-bold text-text-primary">
                            {(((account as any).usage as any).totalCampaigns || 0).toLocaleString()}
                          </p>
                        </RetailCard>
                        <RetailCard className="p-5">
                          <div className="flex items-center gap-2.5 mb-3">
                            <SettingsIcon className="h-5 w-5 text-accent" />
                            <p className="text-xs font-medium text-text-secondary">Automations</p>
                          </div>
                          <p className="text-2xl font-bold text-text-primary">
                            {(((account as any).usage as any).totalAutomations || 0).toLocaleString()}
                          </p>
                        </RetailCard>
                        <RetailCard className="p-5">
                          <div className="flex items-center gap-2.5 mb-3">
                            <MessageSquare className="h-5 w-5 text-accent" />
                            <p className="text-xs font-medium text-text-secondary">Messages</p>
                          </div>
                          <p className="text-2xl font-bold text-text-primary">
                            {(((account as any).usage as any).totalMessages || 0).toLocaleString()}
                          </p>
                        </RetailCard>
                      </div>
                    </div>
                  )}
                </div>
              </RetailCard>
            )}
          </main>
        </div>
      )}
    </PageLayout>
  );
}
