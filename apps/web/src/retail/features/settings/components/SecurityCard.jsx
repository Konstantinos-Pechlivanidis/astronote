import { Lock } from 'lucide-react';
import ChangePasswordForm from './ChangePasswordForm';

export default function SecurityCard() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <Lock className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Security</h2>
      </div>

      <ChangePasswordForm />
    </div>
  );
}

