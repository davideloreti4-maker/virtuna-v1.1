"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendUp,
  Briefcase,
  CreditCard,
  SignOut as SignOutIcon,
  SidebarSimple,
  Plus,
  ClockCounterClockwise,
  GearSix,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TrialCountdown } from "@/components/trial-countdown";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useSubscription } from "@/hooks/use-subscription";

/**
 * Main sidebar component — Raycast-style layout.
 *
 * Top: Logo + toggle, TikTok handle input, "Create a new test" button
 * Middle: Test History, Trending, Referrals navigation
 * Bottom: Credits/trial, Settings, Pricing, Log Out (icons on right)
 *
 * Flush to left edge, solid dark, no floating/glass.
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close } = useSidebarStore();
  useSubscription();

  // TikTok handle state
  const [tiktokHandle, setTiktokHandle] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Fetch saved TikTok handle from creator_profiles
  const fetchHandle = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("tiktok_handle")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.tiktok_handle) {
      setTiktokHandle(profile.tiktok_handle);
    }
  }, []);

  useEffect(() => {
    fetchHandle();
  }, [fetchHandle]);

  // Save handler — upsert to creator_profiles
  const handleSaveHandle = async () => {
    const trimmed = inputValue.trim().replace(/^@/, "");
    if (!trimmed) return;

    setSaveError(false);
    setIsSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("creator_profiles")
        .upsert(
          { user_id: user.id, tiktok_handle: trimmed },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Failed to save TikTok handle:", error);
        setSaveError(true);
        return;
      }

      setTiktokHandle(trimmed);
      setIsEditing(false);
      setInputValue("");
    } catch (err) {
      console.error("Failed to save TikTok handle:", err);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  // Determine if we show the input or the saved handle
  const showInput = !tiktokHandle || isEditing;
  const isSaveDisabled =
    !inputValue.trim() ||
    isSaving ||
    inputValue.trim().replace(/^@/, "") === tiktokHandle;

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
          "fixed top-0 left-0 bottom-0 z-[var(--z-sidebar)] w-[220px]",
          "flex flex-col overflow-hidden",
          "bg-background border-r border-white/[0.06]",
          "transition-transform duration-300 ease-[var(--ease-out-cubic)]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header: Logo + Collapse */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
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

        {/* TikTok Handle Section */}
        <div className="px-4 pt-2 pb-1">
          <span className="text-xs text-foreground-muted">TikTok Account</span>
        </div>
        <div className="px-3 py-2">
          {showInput ? (
            <>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setSaveError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSaveDisabled) handleSaveHandle();
                  if (e.key === "Escape" && tiktokHandle) {
                    setIsEditing(false);
                    setInputValue("");
                  }
                }}
                placeholder="@handle"
                disabled={isSaving}
                className={cn(
                  "w-full bg-white/[0.05] border rounded-lg h-[42px] px-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none transition-colors",
                  saveError
                    ? "border-error"
                    : "border-white/[0.05]"
                )}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveHandle}
                disabled={isSaveDisabled}
                className="w-full mt-2"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setInputValue(tiktokHandle || "");
              }}
              className="w-full text-left text-sm text-foreground px-3 py-2 rounded-lg transition-colors hover:text-foreground-secondary cursor-pointer"
            >
              @{tiktokHandle}
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="mx-4 my-1 border-t border-white/[0.06]" />

        {/* Create a new test — societies.io style: text left, + icon right */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mx-4 my-1 flex items-center justify-between py-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
        >
          <span>Create a new test</span>
          <Plus size={16} className="shrink-0" />
        </button>

        {/* Separator */}
        <div className="mx-4 my-1 border-t border-white/[0.06]" />

        {/* Main navigation — simple text rows, icon left */}
        <nav className="flex flex-col px-4 py-1">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors hover:text-foreground",
              pathname === "/dashboard"
                ? "text-foreground"
                : "text-foreground-secondary"
            )}
          >
            <ClockCounterClockwise size={16} className="shrink-0" />
            <span>Test History</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/trending")}
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors hover:text-foreground",
              pathname === "/trending"
                ? "text-foreground"
                : "text-foreground-secondary"
            )}
          >
            <TrendUp size={16} className="shrink-0" />
            <span>Trending</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/referrals")}
            className={cn(
              "flex items-center gap-3 py-2 text-sm transition-colors hover:text-foreground",
              pathname.startsWith("/referrals")
                ? "text-foreground"
                : "text-foreground-secondary"
            )}
          >
            <Briefcase size={16} className="shrink-0" />
            <span>Referrals</span>
          </button>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Trial countdown */}
        <TrialCountdown />

        {/* Separator */}
        <div className="mx-4 my-1 border-t border-white/[0.06]" />

        {/* Bottom items — societies.io style: text left, icon right */}
        <div className="flex flex-col px-4 pb-4">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className={cn(
              "flex items-center justify-between py-2 text-sm transition-colors hover:text-foreground",
              pathname.startsWith("/settings")
                ? "text-foreground"
                : "text-foreground-secondary"
            )}
          >
            <span>Settings</span>
            <GearSix size={16} className="shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/pricing")}
            className={cn(
              "flex items-center justify-between py-2 text-sm transition-colors hover:text-foreground",
              pathname === "/pricing"
                ? "text-foreground"
                : "text-foreground-secondary"
            )}
          >
            <span>Pricing</span>
            <CreditCard size={16} className="shrink-0" />
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center justify-between py-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
          >
            <span>Log Out</span>
            <SignOutIcon size={16} className="shrink-0" />
          </button>
        </div>
      </aside>
    </>
  );
}
