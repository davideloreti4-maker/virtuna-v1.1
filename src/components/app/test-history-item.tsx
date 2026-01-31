'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TestResult } from '@/types/test';

interface TestHistoryItemProps {
  test: TestResult;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

/**
 * Truncate content to first line or ~40 chars for display
 */
function getDisplayTitle(content: string): string {
  // Get first line (with fallback for empty content)
  const firstLine = content.split('\n')[0] ?? '';
  // Truncate to reasonable length
  if (firstLine.length > 50) {
    return firstLine.slice(0, 47) + '...';
  }
  return firstLine;
}

export function TestHistoryItem({
  test,
  isActive,
  onClick,
  onDelete,
}: TestHistoryItemProps) {
  const displayTitle = getDisplayTitle(test.content);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        isActive
          ? 'bg-[rgba(40,40,40,0.5)] text-white'
          : 'text-[rgb(184,184,184)] hover:bg-[rgba(40,40,40,0.3)] hover:text-white'
      )}
    >
      {/* Left border indicator - yellow like Societies.io (only on active) */}
      {isActive && (
        <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-yellow-500" />
      )}

      {/* Content title - truncated */}
      <span className="flex-1 truncate">{displayTitle}</span>

      {/* Three-dot menu */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'rounded p-1 text-zinc-500 opacity-0 transition-all hover:bg-zinc-700 hover:text-zinc-300 group-hover:opacity-100',
              isActive && 'opacity-100'
            )}
            aria-label="More options"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-lg"
            sideOffset={4}
            align="end"
          >
            <DropdownMenu.Item
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-400 outline-none transition-colors hover:bg-zinc-700 hover:text-red-300 focus:bg-zinc-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </button>
  );
}
