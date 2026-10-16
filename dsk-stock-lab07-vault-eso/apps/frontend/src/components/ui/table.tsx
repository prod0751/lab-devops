import React from 'react';
import { clsx } from 'clsx';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className,
  ...props
}) => <table className={clsx('w-full text-sm text-slate-200', className)} {...props} />;

export const THead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => <thead className={clsx('text-left text-xs uppercase text-slate-400', className)} {...props} />;

export const TBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  ...props
}) => <tbody className={clsx('divide-y divide-slate-800', className)} {...props} />;

export const TR: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className,
  ...props
}) => <tr className={clsx('hover:bg-slate-900/60 transition-colors', className)} {...props} />;

export const TH: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <th className={clsx('px-3 py-2 font-semibold', className)} {...props} />;

export const TD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <td className={clsx('px-3 py-3 align-middle', className)} {...props} />;
