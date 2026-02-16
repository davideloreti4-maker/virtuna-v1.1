"use client";

import { useState, useRef, useEffect } from "react";
import {
  House,
  TrendUp,
  Lightbulb,
  Briefcase,
  CreditCard,
  User,
  SignOut as SignOutIcon,
  SidebarSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { ContextualTooltip } from "@/components/tooltips/contextual-tooltip";
import { TrialCountdown } from "@/components/trial-countdown";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useTooltipStore } from "@/stores/tooltip-store";
import { useSubscription } from "@/hooks/use-subscription";

import { SidebarNavItem } from "./sidebar-nav-item";

const navItems = [
  { label: "Dashboard", icon: House, id: "dashboard", href: "/dashboard" },
  { label: "Trending", icon: TrendUp, id: "trending", href: "/trending" },
] as const;

const navItemsAfterSelector = [
  { label: "Content Intelligence", icon: Lightbulb, id: "content-intelligence", href: "/dashboard" },
  { label: "Referrals", icon: Briefcase, id: "referrals", href: "/referrals" },
] as const;

const bottomNavItems = [
  { label: "Pricing", icon: CreditCard, id: "pricing", href: "/pricing" },
] as const;

/**
 * Main sidebar component for the app dashboard.
 *
 * MVP Navigation (top): Dashboard, Trending, [TikTok Account Selector], Content Intelligence, Referrals
 * MVP Navigation (bottom): Pricing
 * Avatar dropdown with Sign out at the very bottom.
 *
 * Renders as a floating glassmorphic panel using inline styles,
 * inset 12px from viewport edges. Reads open/close state from useSidebarStore.
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useSidebarStore();
  const { tier, isTrial } = useSubscription();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [tiktokHandle, setTiktokHandle] = useState<string | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const tooltipStore = useTooltipStore();

  // Hydrate tooltip store
  useEffect(() => {
    if (!tooltipStore._isHydrated) {
      tooltipStore._hydrate();
    }
  }, [tooltipStore]);

  // Fetch connected TikTok handle
  useEffect(() => {
    async function fetchHandle() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("creator_profiles")
        .select("tiktok_handle")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.tiktok_handle) {
        setTiktokHandle(profile.tiktok_handle);
      }
    }
    fetchHandle();
  }, []);

  // Close avatar menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    if (avatarMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [avatarMenuOpen]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
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
        <div className="mx-4 my-2 border-t border-border-glass" />

        {/* Top navigation items (Dashboard, Trending) */}
        <nav className="flex flex-col gap-0.5 px-2">
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={
                item.id === "dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href
              }
              onClick={() => router.push(item.href)}
            />
          ))}
        </nav>

        {/* TikTok Account Selector */}
        {tiktokHandle ? (
          <div className="mx-2 my-2">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
              <div className={cn(
                "h-6 w-6 shrink-0 rounded-full flex items-center justify-center",
                "bg-accent/20"
              )}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-accent" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <Text as="span" size="sm" className="text-foreground truncate">
                @{tiktokHandle}
              </Text>
            </div>
          </div>
        ) : (
          <ContextualTooltip
            id="tiktok-connect"
            title="Your TikTok Account"
            description="Connect your TikTok handle to unlock personalized content intelligence"
            position="right"
          >
            <div className="mx-2 my-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
                <div className="h-6 w-6 shrink-0 rounded-full bg-white/[0.1]" />
                <Text as="span" size="sm" className="text-foreground-muted truncate">
                  Connect TikTok
                </Text>
              </div>
            </div>
          </ContextualTooltip>
        )}

        {/* Navigation items after selector (Content Intelligence, Referrals) */}
        <nav className="flex flex-col gap-0.5 px-2">
          {navItemsAfterSelector.map((item) => (
            <SidebarNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={
                item.id === "content-intelligence"
                  ? pathname === "/dashboard"
                  : pathname.startsWith("/referrals")
              }
              onClick={() => router.push(item.href)}
            />
          ))}
        </nav>

        {/* Spacer to push bottom content down */}
        <div className="flex-1" />

        {/* Trial countdown (above bottom nav) */}
        <TrialCountdown />

        {/* Separator */}
        <div className="mx-4 border-t border-border-glass" />

        {/* Bottom navigation */}
        <nav className="flex flex-col gap-0.5 p-2">
          {bottomNavItems.map((item) => (
            <SidebarNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={pathname === "/pricing"}
              onClick={() => router.push(item.href)}
            />
          ))}
        </nav>

        {/* Separator */}
        <div className="mx-4 border-t border-border-glass" />

        {/* User avatar with sign-out dropdown */}
        <div className="relative p-2" ref={avatarMenuRef}>
          <button
            type="button"
            onClick={() => setAvatarMenuOpen((prev) => !prev)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-foreground-secondary transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
              <Icon icon={User} size={16} className="text-foreground-muted" />
            </div>
            <Text as="span" size="sm" className="text-inherit truncate">
              Account
            </Text>
          </button>

          {/* Dropdown menu */}
          {avatarMenuOpen && (
            <div
              className="absolute bottom-full left-2 right-2 mb-1 rounded-lg border border-white/[0.06] bg-[#18191a] p-1 shadow-lg"
              style={{
                boxShadow: "rgba(255,255,255,0.05) 0px 1px 0px 0px inset, rgba(0,0,0,0.5) 0px 4px 12px",
              }}
            >
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.06] hover:text-foreground"
              >
                <Icon icon={SignOutIcon} size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
