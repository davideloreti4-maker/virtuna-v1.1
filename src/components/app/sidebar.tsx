"use client";

import { cn } from "@/lib/utils";
import { SidebarNavItem } from "./sidebar-nav-item";
import {
  ChevronDown,
  Plus,
  CreditCard,
  MessageSquare,
  BookOpen,
  LogOut,
  Columns2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SidebarProps {
  className?: string;
}

/**
 * Main sidebar component for the app dashboard.
 *
 * Structure from top to bottom:
 * 1. Header row: Logo + collapse button
 * 2. Society selector section with dropdown trigger
 * 3. View selector section with dropdown trigger
 * 4. Create new test button
 * 5. Spacer
 * 6. Bottom nav items
 * 7. Version text
 *
 * Dimensions:
 * - Width: 248px fixed
 * - Height: 100vh
 * - Background: #0A0A0A
 * - Border right: 1px solid #27272A
 * - Padding: 16px
 */
export function Sidebar({ className }: SidebarProps) {
  const router = useRouter();

  const handleLogout = () => {
    // Simulate logout by navigating to landing page
    router.push("/");
  };

  const handleManagePlan = () => {
    // Placeholder - will open Stripe portal in future
    console.log("Manage plan clicked");
  };

  const handleFeedback = () => {
    // Placeholder - will open feedback modal in future
    console.log("Leave feedback clicked");
  };

  const handleProductGuide = () => {
    // Placeholder - will open docs in future
    console.log("Product guide clicked");
  };

  const handleCreateTest = () => {
    // Placeholder - will open create test flow in Phase 6
    console.log("Create new test clicked");
  };

  return (
    <aside
      className={cn(
        "flex h-screen w-[248px] shrink-0 flex-col border-r border-zinc-800 bg-[#0A0A0A] p-4",
        className
      )}
    >
      {/* Header row: Logo + Collapse button */}
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 32 32"
            fill="none"
            className="text-white"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z"
              fill="currentColor"
            />
          </svg>
        </Link>
        <button
          type="button"
          className="text-zinc-500 transition-colors hover:text-zinc-400"
          aria-label="Collapse sidebar"
        >
          <Columns2 className="h-5 w-5" />
        </button>
      </div>

      {/* Society selector section */}
      <div className="mt-6">
        <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
          Current Society
        </label>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:border-zinc-700"
        >
          <span>Zurich Founders</span>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {/* View selector section */}
      <div className="mt-4">
        <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-500">
          Current View
        </label>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white transition-colors hover:border-zinc-700"
        >
          <span>Country</span>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {/* Create new test button */}
      <button
        type="button"
        onClick={handleCreateTest}
        className="mt-4 flex w-full items-center justify-between border-b border-zinc-800 py-3 text-sm text-white transition-colors hover:text-zinc-300"
      >
        <span>Create a new test</span>
        <Plus className="h-4 w-4" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Separator line */}
      <div className="border-t border-zinc-800" />

      {/* Bottom nav items */}
      <nav className="mt-2">
        <SidebarNavItem
          label="Manage plan"
          icon={CreditCard}
          onClick={handleManagePlan}
        />
        <SidebarNavItem
          label="Leave Feedback"
          icon={MessageSquare}
          onClick={handleFeedback}
        />
        <SidebarNavItem
          label="Product Guide"
          icon={BookOpen}
          onClick={handleProductGuide}
        />
        <SidebarNavItem
          label="Log Out"
          icon={LogOut}
          onClick={handleLogout}
        />
      </nav>

      {/* Version text */}
      <p className="mt-2 text-center text-xs text-zinc-600">Version 2.1</p>
    </aside>
  );
}
