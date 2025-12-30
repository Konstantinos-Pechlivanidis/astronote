import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema } from '../../../lib/validators';

export default function ContactForm({ contact, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: contact
      ? {
          phone: contact.phone || '',
          email: contact.email || '',
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          gender: contact.gender || null,
          birthday: contact.birthday
            ? new Date(contact.birthday).toISOString().split('T')[0]
            : '',
          isSubscribed: contact.isSubscribed !== undefined ? contact.isSubscribed : true,
        }
      : {
          phone: '',
          email: '',
          firstName: '',
          lastName: '',
          gender: null,
          birthday: '',
          isSubscribed: true,
        },
  });

  const handleFormSubmit = (data) => {
    // Convert birthday to ISO string if provided, otherwise null
    const submitData = {
      ...data,
      phone: data.phone.trim(),
      email: data.email || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      gender: data.gender || null,
      birthday: data.birthday ? new Date(data.birthday).toISOString() : null,
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone <span className="text-red-500">*</span>
        </label>
        <input
          {...register('phone')}
          type="tel"
          id="phone"
          placeholder="+306912345678"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter in E.164 format (e.g., +306912345678)
        </p>
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          {...register('email')}
          type="email"
          id="email"
          placeholder="contact@example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <input
            {...register('firstName')}
            type="text"
            id="firstName"
            maxLength={120}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            {...register('lastName')}
            type="text"
            id="lastName"
            maxLength={120}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
          Gender
        </label>
        <select
          {...register('gender')}
          id="gender"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        {errors.gender && (
          <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="birthday" className="block text-sm font-medium text-gray-700 mb-1">
          Birthday
        </label>
        <input
          {...register('birthday')}
          type="date"
          id="birthday"
          max={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Used for age-based filtering (18+ rule)
        </p>
        {errors.birthday && (
          <p className="mt-1 text-sm text-red-600">{errors.birthday.message}</p>
        )}
      </div>

      {contact && (
        <div>
          <label className="flex items-center gap-2">
            <input
              {...register('isSubscribed')}
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Subscribed to SMS</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Uncheck to unsubscribe this contact
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : contact ? 'Update Contact' : 'Create Contact'}
        </button>
      </div>
    </form>
  );
}

