import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'generic', label: 'Generic' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gym', label: 'Gym' },
  { value: 'sports_club', label: 'Sports Club' },
  { value: 'hotels', label: 'Hotels' },
];

export default function TemplatesToolbar({
  search,
  onSearchChange,
  language,
  onLanguageChange,
  category,
  onCategoryChange,
  tab,
  onTabChange,
  onAddClick,
  systemUserId = 1,
}) {
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
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => onTabChange('system')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              tab === 'system'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            System Templates
          </button>
          <button
            onClick={() => onTabChange('my')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              tab === 'my'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Templates
          </button>
        </nav>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Language Selector (Required) */}
        <div className="sm:w-32">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="en">English</option>
            <option value="gr">Greek</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="sm:w-48">
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Add Button (only for My Templates) */}
        {tab === 'my' && (
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        )}
      </div>
    </div>
  );
}

