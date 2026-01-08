'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Upload, Search, RadioTower } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { List } from '@/src/lib/retail/api/lists';

interface ContactsToolbarProps {
  search: string
  onSearchChange: (_value: string) => void
  onAddClick: () => void
  joinHref?: string
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
  joinHref,
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
            value={listId ? String(listId) : undefined}
            onValueChange={(value) => onListChange(value ? Number(value) : null)}
            disabled={isLoadingLists}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Contacts" />
            </SelectTrigger>
            <SelectContent>
              {systemLists?.map((list) => (
                <SelectItem key={list.id} value={String(list.id)}>
                  {list.name} {list.memberCount !== undefined ? `(${list.memberCount})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
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
          {joinHref ? (
            <Link
              href={joinHref}
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
            >
              <RadioTower className="w-4 h-4 mr-2" />
              NFC / Signup
            </Link>
          ) : null}
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
