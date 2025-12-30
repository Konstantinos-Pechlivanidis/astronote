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
import { useConversionConfig } from '../hooks/useConversionConfig';
import { useConversionSubmit } from '../hooks/useConversionSubmit';
import { isValidE164 } from '../../../lib/phone';
import { Target } from 'lucide-react';

const conversionFormSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((val) => isValidE164(val.trim()), {
      message: 'Invalid phone format. Please enter in E.164 format (e.g., +306912345678)',
    }),
});

export default function ConversionTagPage() {
  const { tagPublicId } = useParams();
  const [submitted, setSubmitted] = useState(false);

  const { data: config, isLoading, error } = useConversionConfig(tagPublicId);
  const submitMutation = useConversionSubmit();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(conversionFormSchema),
    defaultValues: {
      phone: '',
    },
  });

  const onSubmit = (data) => {
    submitMutation.mutate(
      { tagPublicId, phone: data.phone.trim() },
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
          <PublicLoading message="Loading..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (error) {
    const isNotFound = error.response?.status === 404 || error.response?.data?.code === 'TAG_NOT_FOUND';
    const isInactive = error.response?.status === 403 || error.response?.data?.code === 'TAG_INACTIVE';
    const isInvalidType = error.response?.data?.code === 'INVALID_TAG_TYPE';
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title={isNotFound ? 'Tag Not Found' : isInactive ? 'Tag Inactive' : isInvalidType ? 'Invalid Tag Type' : 'Error'}
            message={
              isNotFound
                ? 'This conversion tag is not found or is no longer active.'
                : isInactive
                  ? 'This conversion tag is currently inactive. Please contact the store.'
                  : isInvalidType
                    ? 'This tag is not configured for visit confirmation.'
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
          <PublicError message="Conversion tag configuration not found. Please contact the store for help." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (submitted || submitMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Visit Confirmed"
            message={
              submitMutation.data?.message ||
              'Your visit has been confirmed. Thank you!'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  const storeName = config.tag?.store?.company || config.tag?.store?.senderName || 'Store';
  const tagLabel = config.tag?.label || 'Visit Confirmation';

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center mb-6">
          <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{tagLabel}</h1>
          <p className="text-sm text-gray-600">Confirm your visit to {storeName}</p>
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

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? 'Confirming...' : 'Confirm Visit'}
          </button>
        </form>
      </PublicCard>
    </PublicLayout>
  );
}

