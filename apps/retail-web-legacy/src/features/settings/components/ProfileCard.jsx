import { User } from 'lucide-react';
import ProfileForm from './ProfileForm';

export default function ProfileCard({ user, isLoading }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <User className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Account / Profile</h2>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
        </div>
      ) : (
        <ProfileForm user={user} />
      )}
    </div>
  );
}

