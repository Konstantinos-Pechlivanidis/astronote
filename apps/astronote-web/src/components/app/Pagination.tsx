'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type PaginationDto = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export function Pagination({
  pagination,
  onPageChange,
  pageSizeOptions = [10, 25, 50],
  onPageSizeChange,
  label,
  disabled,
}: {
  pagination: PaginationDto;
  onPageChange: (_page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (_pageSize: number) => void;
  label?: string;
  disabled?: boolean;
}) {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-text-secondary">
        {label ? (
          label
        ) : (
          <>
            Showing {start}–{end} of {pagination.total}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Rows</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            disabled={disabled || !pagination.hasPrevPage}
          >
            Previous
          </Button>
          <div className="text-sm text-text-secondary">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={disabled || !pagination.hasNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}


