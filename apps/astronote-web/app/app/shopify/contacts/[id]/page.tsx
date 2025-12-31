'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useContact } from '@/src/features/shopify/contacts/hooks/useContact';
import { useUpdateContact, useDeleteContact } from '@/src/features/shopify/contacts/hooks/useContactMutations';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { ArrowLeft, Save, Trash2, AlertCircle, Edit } from 'lucide-react';
import { format } from 'date-fns';

/**
 * Contact Detail Page
 */
export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);

  const { data: contact, isLoading, error } = useContact(id);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    phoneE164: '',
    firstName: '',
    lastName: '',
    email: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    birthDate: '',
    smsConsent: 'unknown' as 'opted_in' | 'opted_out' | 'unknown',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load contact data when available
  useEffect(() => {
    if (contact) {
      setFormData({
        phoneE164: contact.phoneE164 || '',
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        gender: (contact.gender as 'male' | 'female' | 'other') || '',
        birthDate: contact.birthDate
          ? new Date(contact.birthDate).toISOString().split('T')[0]
          : '',
        smsConsent: contact.smsConsent || 'unknown',
      });
    }
  }, [contact]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phoneE164.trim()) {
      newErrors.phoneE164 = 'Phone number is required';
    } else if (!/^\+[1-9]\d{1,14}$/.test(formData.phoneE164.trim())) {
      newErrors.phoneE164 = 'Phone number must be in E.164 format';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.birthDate) {
      const birthDate = new Date(formData.birthDate);
      if (isNaN(birthDate.getTime()) || birthDate > new Date()) {
        newErrors.birthDate = 'Invalid birth date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      const contactData: any = {
        phoneE164: formData.phoneE164.trim(),
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
        email: formData.email.trim() || null,
        gender: formData.gender || null,
        birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
        smsConsent: formData.smsConsent,
      };

      await updateContact.mutateAsync({ id, data: contactData });
      setIsEditing(false);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleDelete = async () => {
    try {
      await deleteContact.mutateAsync(id);
      router.push('/app/shopify/contacts');
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div>
        <RetailPageHeader title="Contact Details" />
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
  if (error || !contact) {
    return (
      <div>
        <RetailPageHeader title="Contact Details" />
        <RetailCard variant="danger" className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Contact Not Found</h3>
            <p className="text-sm text-text-secondary mb-4">
              {error instanceof Error ? error.message : 'The contact you are looking for does not exist.'}
            </p>
            <Link href="/app/shopify/contacts">
              <Button variant="outline">Back to Contacts</Button>
            </Link>
          </div>
        </RetailCard>
      </div>
    );
  }

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'N/A';
  const consent = contact.smsConsent || 'unknown';
  const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
    opted_in: { label: 'Opted In', variant: 'success' },
    opted_out: { label: 'Opted Out', variant: 'danger' },
    unknown: { label: 'Pending', variant: 'warning' },
  };
  const status = statusMap[consent] || statusMap.unknown;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/app/shopify/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <RetailPageHeader
            title={isEditing ? 'Edit Contact' : name}
            description={isEditing ? `Editing: ${name}` : 'Contact details'}
          />
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteContact.isPending}
                className="text-red-400 hover:text-red-500"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-2xl">
        <RetailCard className="p-6">
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-6"
            >
              {/* Phone */}
              <div>
                <label htmlFor="phoneE164" className="mb-2 block text-sm font-medium text-text-secondary">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <Input
                  id="phoneE164"
                  type="tel"
                  value={formData.phoneE164}
                  onChange={(e) => setFormData({ ...formData, phoneE164: e.target.value })}
                  className={errors.phoneE164 ? 'border-red-400' : ''}
                />
                {errors.phoneE164 && (
                  <p className="mt-1 text-sm text-red-400">{errors.phoneE164}</p>
                )}
              </div>

              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-text-secondary">
                  First Name
                </label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  maxLength={100}
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-text-secondary">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  maxLength={100}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-text-secondary">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={errors.email ? 'border-red-400' : ''}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                )}
              </div>

              {/* Gender */}
              <div>
                <label htmlFor="gender" className="mb-2 block text-sm font-medium text-text-secondary">
                  Gender
                </label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) =>
                    setFormData({ ...formData, gender: value as 'male' | 'female' | 'other' | '' })
                  }
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not specified</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Birth Date */}
              <div>
                <label htmlFor="birthDate" className="mb-2 block text-sm font-medium text-text-secondary">
                  Birth Date
                </label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className={errors.birthDate ? 'border-red-400' : ''}
                />
                {errors.birthDate && (
                  <p className="mt-1 text-sm text-red-400">{errors.birthDate}</p>
                )}
              </div>

              {/* SMS Consent */}
              <div>
                <label htmlFor="smsConsent" className="mb-2 block text-sm font-medium text-text-secondary">
                  SMS Consent
                </label>
                <Select
                  value={formData.smsConsent}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      smsConsent: value as 'opted_in' | 'opted_out' | 'unknown',
                    })
                  }
                >
                  <SelectTrigger id="smsConsent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opted_in">Opted In</SelectItem>
                    <SelectItem value="opted_out">Opted Out</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form data
                    if (contact) {
                      setFormData({
                        phoneE164: contact.phoneE164 || '',
                        firstName: contact.firstName || '',
                        lastName: contact.lastName || '',
                        email: contact.email || '',
                        gender: (contact.gender as 'male' | 'female' | 'other') || '',
                        birthDate: contact.birthDate
                          ? new Date(contact.birthDate).toISOString().split('T')[0]
                          : '',
                        smsConsent: contact.smsConsent || 'unknown',
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateContact.isPending} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {updateContact.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Phone</div>
                  <div className="text-text-primary">{contact.phoneE164}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Email</div>
                  <div className="text-text-primary">{contact.email || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">First Name</div>
                  <div className="text-text-primary">{contact.firstName || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Last Name</div>
                  <div className="text-text-primary">{contact.lastName || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Gender</div>
                  <div className="text-text-primary capitalize">{contact.gender || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Birth Date</div>
                  <div className="text-text-primary">
                    {contact.birthDate
                      ? format(new Date(contact.birthDate), 'MMM d, yyyy')
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">SMS Consent</div>
                  <StatusBadge status={status.variant} label={status.label} />
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Created</div>
                  <div className="text-text-primary">
                    {contact.createdAt
                      ? format(new Date(contact.createdAt), 'MMM d, yyyy')
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </RetailCard>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

