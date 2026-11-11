import React from 'react';
import { cn } from '../../lib/utils';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse bg-slate-200 rounded', className)} />
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => (
  <div className="w-full space-y-3 p-4">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-6 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

