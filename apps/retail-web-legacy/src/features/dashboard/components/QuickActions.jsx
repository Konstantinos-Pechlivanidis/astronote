import { Link } from 'react-router-dom';
import { Plus, Upload, CreditCard } from 'lucide-react';

export default function QuickActions() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          to="/app/campaigns/new"
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-500 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Plus className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">New Campaign</p>
            <p className="text-xs text-gray-500">Create SMS campaign</p>
          </div>
        </Link>
        <Link
          to="/app/contacts/import"
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-500 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Upload className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Import Contacts</p>
            <p className="text-xs text-gray-500">Upload contact list</p>
          </div>
        </Link>
        <Link
          to="/app/billing"
          className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-500 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Buy Credits</p>
            <p className="text-xs text-gray-500">Purchase SMS credits</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

