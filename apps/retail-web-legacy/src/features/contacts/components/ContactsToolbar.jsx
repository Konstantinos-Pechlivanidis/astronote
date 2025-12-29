import { useState, useEffect } from 'react';
import { Plus, Upload, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ContactsToolbar({ search, onSearchChange, onAddClick, listId, onListChange, systemLists, isLoadingLists }) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* List Filter */}
        <div className="sm:w-64">
          <select
            value={listId || ''}
            onChange={(e) => onListChange(e.target.value || null)}
            disabled={isLoadingLists}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
          >
            <option value="">All Contacts</option>
            {systemLists?.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} {list.memberCount !== undefined ? `(${list.memberCount})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            to="/app/contacts/import"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>
      
      {/* Clear Filter Hint */}
      {listId && (
        <div className="text-sm text-gray-600">
          Filtered by list. <button onClick={() => onListChange(null)} className="text-blue-600 hover:text-blue-700 underline">Clear filter</button>
        </div>
      )}
    </div>
  );
}

