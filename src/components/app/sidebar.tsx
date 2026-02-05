"use client";

import { useState } from "react";
import {
  Lightbulb,
  TrendUp,
  Briefcase,
  Plus,
  SlidersHorizontal,
  ChatCircleDots,
  BookOpen,
  SignOut,
  SidebarSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { GlassPanel } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text, Caption } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useTestStore } from "@/stores/test-store";

import { LeaveFeedbackModal } from "./leave-feedback-modal";
import { SidebarNavItem } from "./sidebar-nav-item";
import { TestHistoryList } from "./test-history-list";

const navItems = [
  { label: "Content Intelligence", icon: Lightbulb, id: "content-intelligence" },
  { label: "Trending Feed", icon: TrendUp, id: "trending-feed" },
  { label: "Brand Deals", icon: Briefcase, id: "brand-deals" },
] as const;

const bottomNavItems = [
  { label: "Manage Plan", icon: SlidersHorizontal, id: "manage-plan" },
  { label: "Leave Feedback", icon: ChatCircleDots, id: "leave-feedback" },
  { label: "Product Guide", icon: BookOpen, id: "product-guide" },
  { label: "Log Out", icon: SignOut, id: "log-out" },
] as const;

/**
 * Main sidebar component for the app dashboard.
 *
 * Renders as a floating glassmorphic panel using GlassPanel primitive,
 * inset 12px from viewport edges. Reads open/close state from useSidebarStore.
 *
 * Navigation uses SidebarNavItem (Button ghost + Icon + Text).
 * SocietySelector and ViewSelector have been removed.
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useSidebarStore();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("content-intelligence");

  const reset = useTestStore((s) => s.reset);
  const setStatus = useTestStore((s) => s.setStatus);
  const viewResult = useTestStore((s) => s.viewResult);

  const handleCreateTest = () => {
    reset();
    setStatus("selecting-type");
  };

  const handleViewTest = (testId: string) => {
    viewResult(testId);
  };

  const handleBottomNav = (id: string) => {
    switch (id) {
      case "manage-plan":
        router.push("/settings?tab=billing");
        break;
      case "leave-feedback":
        setFeedbackOpen(true);
        break;
      case "product-guide":
        window.open("https://docs.societies.io", "_blank");
        break;
      case "log-out":
        router.push("/");
        break;
    }
  };

  return (
    <>
      {/* Mobile overlay - no backdrop-filter (MOBL-03 budget) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-sidebar)-1)] bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <GlassPanel
        as="aside"
        blur="lg"
        opacity={0.7}
        borderGlow
        tint="neutral"
        className={cn(
          "fixed top-3 left-3 bottom-3 z-[var(--z-sidebar)] w-[300px]",
          "flex flex-col overflow-hidden",
          "transition-transform duration-300 ease-[var(--ease-out-cubic)]",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)]",
        )}
      >
        {/* Header: Logo + Collapse */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            aria-label="Collapse sidebar"
            className="text-foreground-muted hover:text-foreground"
          >
            <Icon icon={SidebarSimple} size={20} />
          </Button>
        </div>

        {/* Separator */}
        <div className="mx-4 my-2 border-t border-border-glass" />

        {/* Navigation items */}
        <nav className="flex flex-col gap-0.5 px-2">
          {navItems.map((item) => {
            // Brand Deals has a real route
            if (item.id === "brand-deals") {
              return (
                <SidebarNavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={pathname.startsWith("/brand-deals")}
                  onClick={() => router.push("/brand-deals")}
                  badge={3}
                />
              );
            }
            // Other items keep existing useState behavior
            return (
              <SidebarNavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={activeNav === item.id && !pathname.startsWith("/brand-deals")}
                onClick={() => setActiveNav(item.id)}
              />
            );
          })}
        </nav>

        {/* Separator */}
        <div className="mx-4 my-2 border-t border-border-glass" />

        {/* Create new test button */}
        <button
          type="button"
          onClick={handleCreateTest}
          className="mx-3 flex w-auto items-center justify-between text-sm text-foreground-secondary transition-colors hover:text-foreground"
        >
          <Text as="span" size="sm" className="text-inherit">
            Create a new test
          </Text>
          <Icon icon={Plus} size={16} className="text-inherit" />
        </button>

        {/* Test history */}
        <div className="mt-2 flex flex-1 flex-col overflow-hidden px-2">
          <div className="flex-1 overflow-y-auto">
            <TestHistoryList onSelectTest={handleViewTest} />
          </div>
        </div>

        {/* Separator */}
        <div className="mx-4 border-t border-border-glass" />

        {/* Bottom navigation */}
        <nav className="flex flex-col gap-0.5 p-2">
          {bottomNavItems.map((item) => (
            <SidebarNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              onClick={() => handleBottomNav(item.id)}
            />
          ))}
        </nav>

        {/* Version text */}
        <Caption className="mb-3 text-center">Version 2.1</Caption>
      </GlassPanel>

      {/* Leave Feedback Modal - sibling pattern */}
      <LeaveFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
