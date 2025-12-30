import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PublicLayout from '../layouts/PublicLayout';
import PublicCard from '../components/PublicCard';
import PublicLoading from '../components/PublicLoading';
import PublicError from '../components/PublicError';
import PublicSuccess from '../components/PublicSuccess';
import ConsentText from '../components/ConsentText';
import { useNfcConfig } from '../hooks/useNfcConfig';
import { useNfcSubmit } from '../hooks/useNfcSubmit';
import { isValidE164 } from '../../../lib/phone';
import { Smartphone } from 'lucide-react';

const nfcFormSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((val) => isValidE164(val.trim()), {
      message: 'Invalid phone format. Please enter in E.164 format (e.g., +306912345678)',
    }),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  firstName: z.string().max(120, 'First name must be 120 characters or less').optional().or(z.literal('')),
  lastName: z.string().max(120, 'Last name must be 120 characters or less').optional().or(z.literal('')),
  birthday: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        const date = new Date(val);
        const now = new Date();
        return date < now && !isNaN(date.getTime());
      },
      {
        message: 'Birthday must be a valid date in the past',
      },
    )
    .or(z.literal('')),
  consent: z.boolean().refine((val) => val === true, {
    message: 'Consent is required',
  }),
});

export default function NfcOptInPage() {
  const { publicId } = useParams();
  const [submitted, setSubmitted] = useState(false);

  const { data: config, isLoading, error } = useNfcConfig(publicId);
  const submitMutation = useNfcSubmit();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(nfcFormSchema),
    defaultValues: {
      phone: '',
      email: '',
      firstName: '',
      lastName: '',
      birthday: '',
      consent: false,
    },
  });

  const onSubmit = (data) => {
    const submitData = {
      phone: data.phone.trim(),
      email: data.email || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      birthday: data.birthday ? new Date(data.birthday).toISOString() : null,
      consent: data.consent,
    };
    submitMutation.mutate(
      { publicId, data: submitData },
      {
        onSuccess: () => {
          setSubmitted(true);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading form..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (error) {
    const isNotFound = error.response?.status === 404 || error.response?.data?.code === 'TAG_NOT_FOUND';
    const isInactive = error.response?.status === 403 || error.response?.data?.code === 'TAG_INACTIVE';
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title={isNotFound ? 'NFC Tag Not Found' : isInactive ? 'NFC Tag Inactive' : 'Error'}
            message={
              isNotFound
                ? 'This NFC tag is not found or is no longer active.'
                : isInactive
                  ? 'This NFC tag is currently inactive. Please contact the store.'
                  : 'This link is invalid or expired. Please contact the store for help.'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (!config) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError message="NFC tag configuration not found. Please contact the store for help." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (submitted || submitMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Thank You!"
            message={
              submitMutation.data?.action === 'created'
                ? 'You have been added to our list. A welcome SMS may arrive shortly.'
                : 'Your information has been updated. Thank you!'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  const storeName = config.store?.company || config.store?.senderName || 'Store';
  const fields = config.fields || {};
  const consentText = config.consentText || '';

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center mb-6">
          <Smartphone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Join {storeName}</h1>
          <p className="text-sm text-gray-600">Scan to receive special offers and updates</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              {...register('phone')}
              type="tel"
              id="phone"
              placeholder="+306912345678"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Enter in E.164 format (e.g., +306912345678)</p>
            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
          </div>

          {fields.email !== false && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email {fields.email === 'required' && <span className="text-red-500">*</span>}
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
          )}

          {fields.firstName !== false && (
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name {fields.firstName === 'required' && <span className="text-red-500">*</span>}
              </label>
              <input
                {...register('firstName')}
                type="text"
                id="firstName"
                maxLength={120}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>}
            </div>
          )}

          {fields.lastName !== false && (
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name {fields.lastName === 'required' && <span className="text-red-500">*</span>}
              </label>
              <input
                {...register('lastName')}
                type="text"
                id="lastName"
                maxLength={120}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>}
            </div>
          )}

          {fields.birthday !== false && (
            <div>
              <label htmlFor="birthday" className="block text-sm font-medium text-gray-700 mb-1">
                Birthday {fields.birthday === 'required' && <span className="text-red-500">*</span>}
              </label>
              <input
                {...register('birthday')}
                type="date"
                id="birthday"
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.birthday && <p className="mt-1 text-sm text-red-600">{errors.birthday.message}</p>}
            </div>
          )}

          {consentText && (
            <div>
              <label className="flex items-start gap-2">
                <input
                  {...register('consent')}
                  type="checkbox"
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  I consent to receive SMS messages from {storeName}
                </span>
              </label>
              {errors.consent && <p className="mt-1 text-sm text-red-600">{errors.consent.message}</p>}
              <ConsentText text={consentText} required={true} />
            </div>
          )}

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </PublicCard>
    </PublicLayout>
  );
}

