"use client";

import { useState, useRef, useEffect } from "react";
import {
  House,
  TrendUp,
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
import { TrialCountdown } from "@/components/trial-countdown";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useSubscription } from "@/hooks/use-subscription";

import { SidebarNavItem } from "./sidebar-nav-item";

const navItems = [
  { label: "Dashboard", icon: House, id: "dashboard", href: "/dashboard" },
  { label: "Trending", icon: TrendUp, id: "trending", href: "/trending" },
  { label: "Referrals", icon: Briefcase, id: "referrals", href: "/referrals" },
] as const;

const bottomNavItems = [
  { label: "Pricing", icon: CreditCard, id: "pricing", href: "/pricing" },
] as const;

/**
 * Main sidebar component for the app dashboard.
 *
 * Navigation (top): Dashboard, Trending, Referrals
 * Navigation (bottom): Pricing
 * TikTok account section above nav items.
 * Avatar dropdown with Sign out at the very bottom.
 *
 * Renders as a solid dark panel (#07080a) docked flush to left edge,
 * full viewport height. Reads open/close state from useSidebarStore.
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useSidebarStore();
  const { tier, isTrial } = useSubscription();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [tiktokHandle, setTiktokHandle] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

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

  const handleSaveHandle = async () => {
    const trimmed = inputValue.trim().replace(/^@/, "");
    if (!trimmed) return;

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("creator_profiles")
        .upsert(
          { user_id: user.id, tiktok_handle: trimmed },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Failed to save TikTok handle:", error);
        return;
      }

      setTiktokHandle(trimmed);
      setIsEditing(false);
      setInputValue("");
    } catch (err) {
      console.error("Failed to save TikTok handle:", err);
    } finally {
      setIsSaving(false);
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

      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-[var(--z-sidebar)] w-[260px]",
          "flex flex-col overflow-hidden",
          "bg-background border-r border-white/[0.06]",
          "transition-transform duration-300 ease-[var(--ease-out-cubic)]",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
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

        {/* TikTok Handle Section */}
        {tiktokHandle && !isEditing ? (
          <div className="mx-2 my-1">
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setInputValue(tiktokHandle);
              }}
              className="w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-colors hover:text-foreground-secondary"
            >
              <Text as="span" size="sm" className="text-foreground">
                @{tiktokHandle}
              </Text>
            </button>
          </div>
        ) : (
          <div className="mx-2 my-1 px-3 py-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveHandle();
              }}
              placeholder="@handle"
              className={cn(
                "w-full bg-white/[0.05] border border-white/[0.05] rounded-lg",
                "h-[42px] px-3 text-sm text-foreground placeholder:text-foreground-muted",
                "focus:border-accent focus:outline-none",
                "transition-colors"
              )}
            />
            <Button
              variant="primary"
              size="sm"
              className="mt-2 w-full"
              onClick={handleSaveHandle}
              disabled={!inputValue.trim() || isSaving || inputValue.trim().replace(/^@/, "") === tiktokHandle}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}

        {/* Separator */}
        <div className="mx-4 my-2 border-t border-border-glass" />

        {/* Top navigation items (Dashboard, Trending, Referrals) */}
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
