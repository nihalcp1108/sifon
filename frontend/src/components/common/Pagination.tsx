import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  onPageChange,
  isLoading,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 sm:px-6 rounded-b-xl">
      <div className="text-xs text-slate-500">
        Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
        <span className="font-semibold text-slate-800">{totalPages}</span> ({totalItems} total records)
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(page - 1)}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(page + 1)}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

