"use client";

import { useEffect } from "react";
import {
  House,
  TrendUp,
  Briefcase,
  CreditCard,
  GearSix,
  SignOut as SignOutIcon,
  SidebarSimple,
  Plus,
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
import { useTooltipStore } from "@/stores/tooltip-store";
import { useSubscription } from "@/hooks/use-subscription";

import { SidebarNavItem } from "./sidebar-nav-item";
import { TiktokAccountSelector } from "./tiktok-account-selector";

/**
 * Main sidebar component for the app dashboard.
 *
 * Floating glassmorphic panel inset 12px from viewport edges.
 * Layout: Logo → TikTok Account → Nav → Divider → Create Test / History → Spacer → Bottom items
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useSidebarStore();
  const { tier, isTrial } = useSubscription();
  const tooltipStore = useTooltipStore();

  // Hydrate tooltip store
  useEffect(() => {
    if (!tooltipStore._isHydrated) {
      tooltipStore._hydrate();
    }
  }, [tooltipStore]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
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
          backgroundImage:
            "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
        }}
      >
        {/* 1. Header: Logo + Collapse */}
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

        {/* 2. TikTok Account Selector */}
        <div className="px-3 py-1">
          <span className="mb-1.5 block px-1 text-[11px] font-medium text-foreground-muted uppercase tracking-wider">
            TikTok Account
          </span>
          <TiktokAccountSelector />
        </div>

        {/* Separator */}
        <div className="mx-4 my-2 border-t border-border-glass" />

        {/* 3. Main navigation: Dashboard, Trending, Referrals */}
        <nav className="flex flex-col gap-0.5 px-2">
          <SidebarNavItem
            icon={House}
            label="Dashboard"
            isActive={pathname === "/dashboard"}
            onClick={() => router.push("/dashboard")}
          />
          <SidebarNavItem
            icon={TrendUp}
            label="Trending"
            isActive={pathname === "/trending"}
            onClick={() => router.push("/trending")}
          />
          <SidebarNavItem
            icon={Briefcase}
            label="Referrals"
            isActive={pathname.startsWith("/referrals")}
            onClick={() => router.push("/referrals")}
          />
        </nav>

        {/* 4. Divider */}
        <div className="mx-4 my-2 border-t border-border-glass" />

        {/* 5. Create a new test — text left, + icon right */}
        <button
          type="button"
          onClick={() => router.push("/test/new")}
          className="mx-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <span>Create a new test</span>
          <Icon icon={Plus} size={16} className="text-foreground-muted" />
        </button>

        {/* 6. Test History — scrollable list */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {/* TODO: map over past tests here */}
        </div>

        {/* 8. Trial countdown */}
        <TrialCountdown />

        {/* 9. Divider */}
        <div className="mx-4 border-t border-border-glass" />

        {/* 10. Bottom nav: Settings, Pricing, Log Out */}
        <nav className="flex flex-col gap-0.5 p-2">
          <SidebarNavItem
            icon={GearSix}
            label="Settings"
            isActive={pathname === "/settings"}
            onClick={() => router.push("/settings")}
          />
          <SidebarNavItem
            icon={CreditCard}
            label="Pricing"
            isActive={pathname === "/pricing"}
            onClick={() => router.push("/pricing")}
          />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <Icon icon={SignOutIcon} size={20} />
            <Text as="span" size="sm" className="text-inherit">
              Log Out
            </Text>
          </button>
        </nav>
      </aside>
    </>
  );
}
