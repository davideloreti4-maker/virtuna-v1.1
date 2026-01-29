'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Trash2 } from 'lucide-react';
import {
  ClipboardList,
  FileText,
  Globe,
  Megaphone,
  Linkedin,
  Instagram,
  Twitter,
  Video,
  Mail,
  Send,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEST_TYPES } from '@/lib/test-types';
import type { TestResult, TestTypeIcon } from '@/types/test';

// Icon map following established pattern from test-types.ts
const ICON_MAP: Record<TestTypeIcon, React.ComponentType<{ className?: string }>> = {
  ClipboardList,
  FileText,
  Globe,
  Megaphone,
  Linkedin,
  Instagram,
  Twitter,
  Video,
  Mail,
  Send,
  Package,
};

interface TestHistoryItemProps {
  test: TestResult;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export function TestHistoryItem({
  test,
  isActive,
  onClick,
  onDelete,
}: TestHistoryItemProps) {
  const config = TEST_TYPES[test.testType];
  const IconComponent = ICON_MAP[config.icon];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        isActive
          ? 'bg-zinc-800 text-white'
          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
      )}
    >
      {/* Left border indicator for active */}
      {isActive && (
        <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-indigo-500" />
      )}

      {/* Icon */}
      <IconComponent className="h-4 w-4 shrink-0" />

      {/* Test type name - truncate if needed */}
      <span className="flex-1 truncate">{config.name}</span>

      {/* Impact score */}
      <span className="text-xs text-zinc-500">{test.impactScore}%</span>

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
