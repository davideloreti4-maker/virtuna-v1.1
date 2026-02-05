"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SidebarNavItem } from "./sidebar-nav-item";
import { SocietySelector } from "./society-selector";
import { ViewSelector } from "./view-selector";
import { LeaveFeedbackModal } from "./leave-feedback-modal";
import {
  Plus,
  SlidersHorizontal,
  MessageSquareMore,
  BookOpen,
  LogOut,
  Columns2,
  X,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSocietyStore } from "@/stores/society-store";
import { useTestStore } from "@/stores/test-store";
import { TestHistoryList } from "./test-history-list";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Main sidebar component for the app dashboard.
 */
export function Sidebar({ mobileOpen, onMobileOpenChange, className }: SidebarProps) {
  const router = useRouter();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Get store state
  const store = useSocietyStore();
  // Note: store provides society state if needed (store.societies, store.selectedSocietyId)
  void store; // Suppress unused warning - store will be used for future features

  const handleLogout = () => {
    router.push("/");
  };

  const handleManagePlan = () => {
    router.push("/settings?tab=billing");
    onMobileOpenChange?.(false); // Close mobile drawer
  };

  const handleFeedback = () => {
    setFeedbackOpen(true);
  };

  const handleProductGuide = () => {
    window.open("https://docs.societies.io", "_blank");
  };

  const reset = useTestStore((s) => s.reset);
  const setStatus = useTestStore((s) => s.setStatus);

  const handleCreateTest = () => {
    reset(); // Clear any viewing state
    setStatus("selecting-type"); // Open type selector
  };

  const viewResult = useTestStore((s) => s.viewResult);

  const handleViewTest = (testId: string) => {
    viewResult(testId);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => onMobileOpenChange?.(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[240px] flex-col border-r border-[rgb(40,40,40)] bg-[rgba(21,21,21,0.31)] p-4 backdrop-blur-[14px] transition-transform duration-200",
          "md:static md:translate-x-0 md:flex md:shrink-0",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full",
          className
        )}
      >
        {/* Mobile close button */}
        <button
          className="absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 hover:text-white md:hidden"
          onClick={() => onMobileOpenChange?.(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

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
          <label className="mb-2 block text-xs font-normal text-[rgb(153,163,169)]">
            Current Society
          </label>
          <SocietySelector />
        </div>

        {/* View selector section */}
        <div className="mt-4">
          <label className="mb-2 block text-xs font-normal text-[rgb(153,163,169)]">
            Current View
          </label>
          <ViewSelector />
        </div>

        {/* Separator before create button */}
        <div className="mt-4 border-t border-[rgb(40,40,40)]" />

        {/* Create new test button */}
        <button
          type="button"
          onClick={handleCreateTest}
          className="flex w-full items-center justify-between py-3 text-sm text-[rgb(184,184,184)] transition-colors hover:text-white"
        >
          <span>Create a new test</span>
          <Plus className="h-4 w-4" />
        </button>

        {/* Test History Section */}
        <div className="mt-4 flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <TestHistoryList onSelectTest={handleViewTest} />
          </div>
        </div>

        {/* Separator line */}
        <div className="border-t border-[rgb(40,40,40)]" />

        {/* Bottom nav items */}
        <nav className="mt-2 space-y-0.5">
          <SidebarNavItem
            label="Trending"
            icon={TrendingUp}
            onClick={() => {
              router.push("/trending");
              onMobileOpenChange?.(false);
            }}
          />
          <SidebarNavItem
            label="Manage plan"
            icon={SlidersHorizontal}
            onClick={handleManagePlan}
          />
          <SidebarNavItem
            label="Leave Feedback"
            icon={MessageSquareMore}
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
        <p className="mt-2 text-center text-xs text-[rgb(101,101,101)]">Version 2.1</p>
      </aside>

      {/* Leave Feedback Modal - sibling pattern */}
      <LeaveFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
