import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * DataTable — calm row list for drill-down detail. First column grows (label),
 * right-aligned columns shrink and use tabular-nums. No outer border; hairline
 * dividers only.
 */
export interface DataColumn<R> {
  key: string;
  label?: string;
  align?: 'left' | 'right';
  render?: (row: R) => ReactNode;
  className?: string;
}

export interface DataTableProps<R> {
  columns: DataColumn<R>[];
  rows: R[];
  rowKey: (row: R, i: number) => string;
  dense?: boolean;
  className?: string;
}

function colClass<R>(c: DataColumn<R>, idx: number) {
  return cn(
    'min-w-0 text-[13px]',
    c.align === 'right'
      ? 'shrink-0 text-right tabular-nums text-white/90'
      : idx === 0
        ? 'flex-1 truncate text-white/80'
        : 'shrink-0 text-white/70',
    c.className,
  );
}

export function DataTable<R>({
  columns,
  rows,
  rowKey,
  dense,
  className,
}: DataTableProps<R>) {
  const hasHeader = columns.some((c) => c.label);
  return (
    <div className={cn('w-full', className)} data-testid="data-table">
      {hasHeader && (
        <div
          className={cn(
            'flex items-center gap-3 border-b border-white/[0.06]',
            dense ? 'pb-1.5' : 'pb-2',
          )}
        >
          {columns.map((c, idx) => (
            <div
              key={c.key}
              className={cn(
                colClass(c, idx),
                '!text-[10px] uppercase tracking-[0.06em] text-white/35',
              )}
            >
              {c.label}
            </div>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <div
          key={rowKey(row, i)}
          className={cn(
            'flex items-center gap-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]',
            dense ? 'py-1.5' : 'py-2.5',
          )}
          data-testid="data-row"
        >
          {columns.map((c, idx) => (
            <div key={c.key} className={colClass(c, idx)}>
              {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
