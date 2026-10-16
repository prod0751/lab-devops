import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'warning';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className, ...props }) => {
  const variants = {
    default: 'bg-sky-500/20 text-sky-200 border border-sky-500/30',
    warning: 'bg-amber-500/20 text-amber-200 border border-amber-500/30',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
};
