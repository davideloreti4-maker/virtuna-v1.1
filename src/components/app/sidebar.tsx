"use client";

import { useState } from "react";
import {
  House,
  TrendUp,
  Briefcase,
  Plus,
  Coins,
  Sparkle,
  ChatCircleDots,
  SignOut as SignOutIcon,
  SidebarSimple,
  Info,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { TrialCountdown } from "@/components/trial-countdown";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useSubscription } from "@/hooks/use-subscription";
import { useTestStore } from "@/stores/test-store";
import { LeaveFeedbackModal } from "./leave-feedback-modal";
import { TestHistoryList } from "./test-history-list";

import { SidebarNavItem } from "./sidebar-nav-item";

const navItems = [
  { label: "Dashboard", icon: House, id: "dashboard", href: "/dashboard" },
  { label: "Trending", icon: TrendUp, id: "trending", href: "/trending" },
  { label: "Referrals", icon: Briefcase, id: "referrals", href: "/referrals" },
] as const;

/**
 * Main sidebar component for the app dashboard.
 *
 * Navigation (top): Dashboard, Trending, Referrals
 * Middle: "Create a new test" section header + test history list
 * Navigation (bottom): Credits, Start Free Trial, Leave Feedback, Log Out
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useSidebarStore();
  const { tier, isTrial } = useSubscription();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const viewResult = useTestStore((s) => s.viewResult);
  const setStatus = useTestStore((s) => s.setStatus);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleCreateNewTest = () => {
    router.push("/dashboard");
    setStatus("selecting-type");
  };

  const handleSelectTest = (testId: string) => {
    viewResult(testId);
    router.push("/dashboard");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-sidebar)-1)] bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-3 left-3 bottom-3 z-[var(--z-sidebar)] w-[260px]",
          "flex flex-col overflow-hidden rounded-xl",
          "border border-white/[0.06]",
          "transition-transform duration-300 ease-[var(--ease-out-cubic)]",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)]",
        )}
        style={{
          backgroundImage: "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
        }}
      >
        {/* Header: Logo + Collapse */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <div className="flex items-center gap-2">
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
            <Badge
              variant={tier === "pro" ? "accent" : tier === "starter" ? "success" : "default"}
              size="sm"
            >
              {isTrial ? "Pro Trial" : tier === "free" ? "Free" : tier === "starter" ? "Starter" : "Pro"}
            </Badge>
          </div>
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
        <div className="mx-4 my-2 border-t border-white/[0.06]" />

        {/* Main navigation */}
        <nav className="flex flex-col gap-0.5 px-2">
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={
                item.id === "dashboard"
                  ? pathname === "/dashboard"
                  : item.id === "referrals"
                  ? pathname.startsWith("/referrals")
                  : pathname === item.href
              }
              onClick={() => router.push(item.href)}
            />
          ))}
        </nav>

        {/* Separator */}
        <div className="mx-4 my-2 border-t border-white/[0.06]" />

        {/* Create a new test — section header with + icon */}
        <div className="mx-4 mb-1">
          <button
            type="button"
            onClick={handleCreateNewTest}
            className="flex w-full items-center justify-between text-foreground-secondary transition-colors hover:text-foreground"
          >
            <Text as="span" size="sm">Create a new test</Text>
            <Icon icon={Plus} size={16} />
          </button>
        </div>

        {/* Test history list */}
        <div className="flex-1 overflow-y-auto px-2 pt-1">
          <TestHistoryList onSelectTest={handleSelectTest} />
        </div>

        {/* Trial countdown */}
        <TrialCountdown />

        {/* Separator */}
        <div className="mx-4 border-t border-white/[0.06]" />

        {/* Bottom actions */}
        <div className="flex flex-col gap-0.5 p-2">
          {/* Credits */}
          <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-foreground-secondary">
            <Icon icon={Coins} size={16} />
            <Text as="span" size="sm" className="flex-1">Credits: 0</Text>
            <Icon icon={Info} size={16} className="text-foreground-muted" />
          </div>

          {/* Start Free Trial */}
          <button
            type="button"
            onClick={() => router.push("/pricing")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <Icon icon={Sparkle} size={16} />
            <Text as="span" size="sm">Start Free Trial</Text>
          </button>

          {/* Leave Feedback */}
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <Icon icon={ChatCircleDots} size={16} />
            <Text as="span" size="sm">Leave Feedback</Text>
          </button>

          {/* Log Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <Icon icon={SignOutIcon} size={16} />
            <Text as="span" size="sm">Log Out</Text>
          </button>
        </div>
      </aside>

      {/* Feedback modal */}
      <LeaveFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
