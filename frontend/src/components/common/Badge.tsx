import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps {
  variant?: 'posted' | 'draft' | 'cancelled' | 'active' | 'archived' | 'neutral' | 'teal';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className }) => {
  const styles = {
    posted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
    active: 'bg-teal-50 text-teal-700 border-teal-200',
    archived: 'bg-slate-100 text-slate-600 border-slate-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    teal: 'bg-teal-50 text-teal-800 border-teal-300 font-semibold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

