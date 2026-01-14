'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useBillingProfile } from '@/src/features/shopify/billing/hooks/useBillingProfile';
import { billingApi, UpdateBillingProfileRequest } from '@/src/lib/shopifyBillingApi';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailFormLayout } from '@/src/components/retail/RetailFormLayout';
import { RetailSectionCard } from '@/src/components/retail/RetailSectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RetailErrorBanner } from '@/src/components/retail/RetailErrorBanner';
import { RetailLoadingSkeleton } from '@/src/components/retail/RetailLoadingSkeleton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// Country list (focus on EU for VAT)
const COUNTRIES = [
  { code: 'GR', name: 'Greece' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IE', name: 'Ireland' },
  { code: 'FI', name: 'Finland' },
  { code: 'DK', name: 'Denmark' },
  { code: 'SE', name: 'Sweden' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'EE', name: 'Estonia' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NO', name: 'Norway' },
];

export default function BillingSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useBillingProfile();

  const [formData, setFormData] = useState<UpdateBillingProfileRequest>({
    billingEmail: '',
    legalName: '',
    billingAddress: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
    vatNumber: '',
    vatCountry: '',
    isBusiness: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form from profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        billingEmail: profile.billingEmail || '',
        legalName: profile.legalName || '',
        billingAddress: {
          line1: profile.billingAddress?.line1 || '',
          line2: profile.billingAddress?.line2 || '',
          city: profile.billingAddress?.city || '',
          state: profile.billingAddress?.state || '',
          postalCode: profile.billingAddress?.postalCode || '',
          country: profile.billingAddress?.country || '',
        },
        vatNumber: profile.vatNumber || '',
        vatCountry: profile.vatCountry || profile.billingAddress?.country || '',
        isBusiness: profile.isBusiness || false,
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateBillingProfileRequest) => billingApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'profile'] });
      toast.success('Billing profile updated successfully');
      router.push('/app/shopify/billing');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update billing profile';
      toast.error(message);
      setErrors({ submit: message });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.billingEmail?.trim()) {
      newErrors.billingEmail = 'Billing email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.billingEmail)) {
      newErrors.billingEmail = 'Invalid email format';
    }

    if (!formData.legalName?.trim()) {
      newErrors.legalName = 'Legal name is required';
    }

    if (!formData.billingAddress?.country) {
      newErrors.country = 'Country is required';
    }

    if (!formData.billingAddress?.line1?.trim()) {
      newErrors.addressLine1 = 'Address line 1 is required';
    }

    // VAT validation: If country is GR and isBusiness is true, VAT is required
    const country = formData.billingAddress?.country || formData.vatCountry;
    if (country === 'GR' && formData.isBusiness && !formData.vatNumber?.trim()) {
      newErrors.vatNumber = 'VAT number (AFM) is required for Greek businesses';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    // Normalize VAT country if not set
    const updateData: UpdateBillingProfileRequest = {
      ...formData,
      vatCountry: formData.vatCountry || formData.billingAddress?.country || undefined,
    };

    updateMutation.mutate(updateData);
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      billingAddress: {
        ...prev.billingAddress,
        [field]: value,
      } as any,
    }));
    // Clear errors for this field
    if (errors[`address${field.charAt(0).toUpperCase() + field.slice(1)}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`address${field.charAt(0).toUpperCase() + field.slice(1)}`];
        return newErrors;
      });
    }
  };

  const handleFieldChange = (field: keyof UpdateBillingProfileRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear errors for this field
    if (errors[field as string]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  };

  const country = formData.billingAddress?.country || formData.vatCountry;
  const isGreekBusiness = country === 'GR' && formData.isBusiness;

  if (isLoading) {
    return (
      <RetailPageLayout>
        <RetailPageHeader title="Billing Settings" />
        <RetailLoadingSkeleton />
      </RetailPageLayout>
    );
  }

  return (
    <RetailPageLayout>
      <RetailPageHeader
        title="Billing Settings"
        description="Manage your billing information and VAT details"
      />
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/app/shopify/billing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
          </Link>
        </div>

        {errors.submit && <RetailErrorBanner title={errors.submit} inline />}

        <form onSubmit={handleSubmit}>
          <RetailFormLayout>
            <RetailSectionCard title="Contact Information">
              <div className="space-y-4">
                <div>
                  <label htmlFor="billingEmail" className="block text-sm font-medium text-text-secondary mb-1">
                    Billing Email <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="billingEmail"
                    type="email"
                    value={formData.billingEmail || ''}
                    onChange={(e) => handleFieldChange('billingEmail', e.target.value)}
                    placeholder="billing@example.com"
                    required
                  />
                  {errors.billingEmail && (
                    <p className="mt-1 text-sm text-red-400">{errors.billingEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="legalName" className="block text-sm font-medium text-text-secondary mb-1">
                    Legal Name / Company Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="legalName"
                    type="text"
                    value={formData.legalName || ''}
                    onChange={(e) => handleFieldChange('legalName', e.target.value)}
                    placeholder="Your legal name or company name"
                    required
                  />
                  {errors.legalName && (
                    <p className="mt-1 text-sm text-red-400">{errors.legalName}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id="isBusiness"
                    type="checkbox"
                    checked={formData.isBusiness || false}
                    onChange={(e) => handleFieldChange('isBusiness', e.target.checked)}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <label htmlFor="isBusiness" className="text-sm font-medium text-text-secondary cursor-pointer">
                    This is a business account
                  </label>
                </div>
              </div>
            </RetailSectionCard>

            <RetailSectionCard title="Billing Address">
              <div className="space-y-4">
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-text-secondary mb-1">
                    Country <span className="text-red-400">*</span>
                  </label>
                  <Select
                    value={formData.billingAddress?.country || ''}
                    onValueChange={(value) => handleAddressChange('country', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.country && (
                    <p className="mt-1 text-sm text-red-400">{errors.country}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="addressLine1" className="block text-sm font-medium text-text-secondary mb-1">
                    Address Line 1 <span className="text-red-400">*</span>
                  </label>
                  <Input
                    id="addressLine1"
                    type="text"
                    value={formData.billingAddress?.line1 || ''}
                    onChange={(e) => handleAddressChange('line1', e.target.value)}
                    placeholder="Street address"
                    required
                  />
                  {errors.addressLine1 && (
                    <p className="mt-1 text-sm text-red-400">{errors.addressLine1}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="addressLine2" className="block text-sm font-medium text-text-secondary mb-1">
                    Address Line 2 (Optional)
                  </label>
                  <Input
                    id="addressLine2"
                    type="text"
                    value={formData.billingAddress?.line2 || ''}
                    onChange={(e) => handleAddressChange('line2', e.target.value)}
                    placeholder="Apartment, suite, etc."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-text-secondary mb-1">
                      City
                    </label>
                    <Input
                      id="city"
                      type="text"
                      value={formData.billingAddress?.city || ''}
                      onChange={(e) => handleAddressChange('city', e.target.value)}
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label htmlFor="postalCode" className="block text-sm font-medium text-text-secondary mb-1">
                      Postal Code
                    </label>
                    <Input
                      id="postalCode"
                      type="text"
                      value={formData.billingAddress?.postalCode || ''}
                      onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                      placeholder="Postal code"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-text-secondary mb-1">
                    State / Province
                  </label>
                  <Input
                    id="state"
                    type="text"
                    value={formData.billingAddress?.state || ''}
                    onChange={(e) => handleAddressChange('state', e.target.value)}
                    placeholder="State or province"
                  />
                </div>
              </div>
            </RetailSectionCard>

            <RetailSectionCard title="VAT / Tax Information">
              <div className="space-y-4">
                {isGreekBusiness && (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-600 dark:text-yellow-400">
                      VAT number (AFM) is required for Greek businesses. Please provide your VAT number.
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="vatNumber" className="block text-sm font-medium text-text-secondary mb-1">
                    VAT Number / AFM {isGreekBusiness && <span className="text-red-400">*</span>}
                  </label>
                  <Input
                    id="vatNumber"
                    type="text"
                    value={formData.vatNumber || ''}
                    onChange={(e) => handleFieldChange('vatNumber', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    placeholder={country === 'GR' ? 'e.g., 123456789' : 'VAT number'}
                    {...(isGreekBusiness && { required: true })}
                  />
                  <p className="mt-1 text-xs text-text-tertiary">
                    {country === 'GR'
                      ? 'Enter your Greek VAT number (AFM - Greek Tax ID)'
                      : 'Enter your VAT number if applicable'}
                  </p>
                  {errors.vatNumber && (
                    <p className="mt-1 text-sm text-red-400">{errors.vatNumber}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="vatCountry" className="block text-sm font-medium text-text-secondary mb-1">
                    VAT Country
                  </label>
                  <Select
                    value={formData.vatCountry || formData.billingAddress?.country || ''}
                    onValueChange={(value) => handleFieldChange('vatCountry', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select VAT country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Country where your VAT number is registered (defaults to billing country)
                  </p>
                </div>

                {profile?.vatValidated !== null && profile?.vatValidated !== undefined && (
                  <div className="rounded-lg border border-border bg-surface-light p-3">
                    <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
                      VAT Validation Status
                    </div>
                    <div className="text-sm text-text-primary">
                      {profile.vatValidated === true ? (
                        <span className="text-green-500">✓ Verified</span>
                      ) : profile.vatValidated === false ? (
                        <span className="text-red-400">✗ Invalid</span>
                      ) : (
                        <span className="text-text-tertiary">Not validated</span>
                      )}
                      {profile.validatedAt && (
                        <span className="text-text-tertiary ml-2">
                          ({new Date(profile.validatedAt).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </RetailSectionCard>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/app/shopify/billing')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </RetailFormLayout>
        </form>
      </div>
    </RetailPageLayout>
  );
}

