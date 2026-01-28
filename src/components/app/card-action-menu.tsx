"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardActionMenuProps {
  societyId: string;
  onEdit: (id: string) => void;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

/**
 * CardActionMenu component.
 * Dropdown menu for card actions (Edit, Refresh, Delete) using Radix DropdownMenu.
 */
export function CardActionMenu({
  societyId,
  onEdit,
  onRefresh,
  onDelete,
  className,
}: CardActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "text-zinc-500 transition-colors hover:text-zinc-400",
            className
          )}
          aria-label="More options"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[140px] rounded-lg border border-zinc-700 bg-zinc-800 p-1 shadow-lg"
          sideOffset={4}
          align="end"
        >
          <DropdownMenu.Item
            onSelect={() => onEdit(societyId)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none transition-colors hover:bg-zinc-700 focus:bg-zinc-700"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => onRefresh(societyId)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-200 outline-none transition-colors hover:bg-zinc-700 focus:bg-zinc-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-zinc-700" />

          <DropdownMenu.Item
            onSelect={() => onDelete(societyId)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-400 outline-none transition-colors hover:bg-zinc-700 hover:text-red-300 focus:bg-zinc-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
