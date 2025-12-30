'use client';

import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'generic', label: 'Generic' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gym', label: 'Gym' },
  { value: 'sports_club', label: 'Sports Club' },
  { value: 'hotels', label: 'Hotels' },
];

interface TemplatesToolbarProps {
  search: string
  onSearchChange: (_value: string) => void
  language: 'en' | 'gr'
  onLanguageChange: (_language: 'en' | 'gr') => void
  category: string
  onCategoryChange: (_category: string) => void
  tab: 'system' | 'my'
  onTabChange: (_tab: 'system' | 'my') => void
  onAddClick: () => void
}

export function TemplatesToolbar({
  search,
  onSearchChange,
  language,
  onLanguageChange,
  category,
  onCategoryChange,
  tab,
  onTabChange,
  onAddClick,
}: TemplatesToolbarProps) {
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
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => onTabChange('system')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'system'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
            }`}
          >
            System Templates
          </button>
          <button
            onClick={() => onTabChange('my')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'my'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Language Selector (Required) */}
        <div className="sm:w-32">
          <Select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as 'en' | 'gr')}
          >
            <option value="en">English</option>
            <option value="gr">Greek</option>
          </Select>
        </div>

        {/* Category Filter */}
        <div className="sm:w-48">
          <Select value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Add Button (only for My Templates) */}
        {tab === 'my' && (
          <Button onClick={onAddClick} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        )}
      </div>
    </div>
  );
}

