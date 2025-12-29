import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import LoadingBlock from './LoadingBlock';
import EmptyState from './EmptyState';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({
  columns,
  data = [],
  isLoading = false,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction,
  emptyActionLabel,
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
  renderRow,
}) {
  const hasPagination = total > pageSize;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <LoadingBlock />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          actionLabel={emptyActionLabel}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderRow
              ? data.map((row, index) => renderRow(row, index))
              : data.map((row, index) => (
                <TableRow key={row.id || index}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render ? col.render(row) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {hasPagination && onPageChange && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= total}
              onClick={() => onPageChange(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

