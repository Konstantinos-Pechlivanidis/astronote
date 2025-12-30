'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Upload, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { List } from '@/src/lib/retail/api/lists';

interface ContactsToolbarProps {
  search: string
  onSearchChange: (_value: string) => void
  onAddClick: () => void
  listId: number | null
  onListChange: (_listId: number | null) => void
  systemLists: List[]
  isLoadingLists: boolean
}

export function ContactsToolbar({
  search,
  onSearchChange,
  onAddClick,
  listId,
  onListChange,
  systemLists,
  isLoadingLists,
}: ContactsToolbarProps) {
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <Input
            type="text"
            placeholder="Search contacts..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List Filter */}
        <div className="sm:w-64">
          <Select
            value={listId || ''}
            onChange={(e) => onListChange(e.target.value ? Number(e.target.value) : null)}
            disabled={isLoadingLists}
          >
            <option value="">All Contacts</option>
            {systemLists?.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} {list.memberCount !== undefined ? `(${list.memberCount})` : ''}
              </option>
            ))}
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href="/app/retail/contacts/import">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </Link>
          <Button onClick={onAddClick} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Clear Filter Hint */}
      {listId && (
        <div className="text-sm text-text-secondary">
          Filtered by list.{' '}
          <button
            onClick={() => onListChange(null)}
            className="text-accent hover:text-accent-hover underline"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}

