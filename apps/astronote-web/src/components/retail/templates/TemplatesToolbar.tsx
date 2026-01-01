'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'generic', label: 'Generic' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gym', label: 'Gym' },
  { value: 'sports_club', label: 'Sports Club' },
  { value: 'hotels', label: 'Hotels' },
];

interface TemplatesToolbarProps {
  search: string;
  onSearchChange: (_value: string) => void;
  language: 'en' | 'gr';
  onLanguageChange: (_language: 'en' | 'gr') => void;
  category: string;
  onCategoryChange: (_category: string) => void;
  tab: 'system' | 'my';
  onTabChange: (_tab: 'system' | 'my') => void;
  onAddClick: () => void;
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

  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  return (
    <div className="space-y-4">
      {/* Top row: iOS segmented tabs + CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full sm:w-auto rounded-2xl">
          <button
            type="button"
            onClick={() => onTabChange('system')}
            className={[
              'flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-xl transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
              tab === 'system'
                ? 'bg-white shadow-sm text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            System Templates
          </button>

          <button
            type="button"
            onClick={() => onTabChange('my')}
            className={[
              'flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-xl transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
              tab === 'my'
                ? 'bg-white shadow-sm text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            My Templates
          </button>
        </div>

        {tab === 'my' && (
          <Button onClick={onAddClick} size="sm" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {/* Filters: search dominant */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search (dominant, no icon) */}
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search templates…"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-12 rounded-2xl px-4 text-[15px]"
          />
        </div>

        {/* Smaller controls */}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-3">
          <div className="w-full sm:w-28">
            <Select
              value={language}
              onValueChange={(value) => onLanguageChange(value as 'en' | 'gr')}
            >
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="EN" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">EN</SelectItem>
                <SelectItem value="gr">GR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-44">
            <Select
              value={category}
              onValueChange={onCategoryChange}
            >
              <SelectTrigger className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* subtle divider */}
      <div className="h-px w-full bg-border" />
    </div>
  );
}
