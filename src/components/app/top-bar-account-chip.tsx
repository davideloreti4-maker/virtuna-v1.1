"use client";

import { useState, useRef, useEffect } from "react";
import {
  CaretDown,
  Check,
  Plus,
  X,
  TiktokLogo,
  InstagramLogo,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useSocialAccounts } from "@/hooks/use-social-accounts";
import type { Platform } from "@/hooks/use-social-accounts";
import { useIsMobile } from "@/hooks/useIsMobile";

function PlatformIcon({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  return platform === "instagram" ? (
    <InstagramLogo weight="bold" className={className} />
  ) : (
    <TiktokLogo weight="bold" className={className} />
  );
}

export function TopBarAccountChip() {
  const {
    accounts,
    activeAccount,
    isLoading,
    switchAccount,
    addAccount,
    removeAccount,
  } = useSocialAccounts();

  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState<Platform>("tiktok");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsAdding(false);
        setNewHandle("");
        setNewPlatform("tiktok");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsAdding(false);
        setNewHandle("");
        setNewPlatform("tiktok");
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleAdd = async () => {
    const trimmed = newHandle.trim();
    if (!trimmed) return;
    await addAccount(trimmed, newPlatform);
    setNewHandle("");
    setNewPlatform("tiktok");
    setIsAdding(false);
  };

  if (isLoading) return null;

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-[var(--z-sticky)]">
      {/* Trigger chip */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 h-9 rounded-full px-3",
          "border border-white/[0.06] transition-colors",
          "hover:bg-white/[0.05]",
          activeAccount ? "text-foreground" : "text-foreground-secondary",
        )}
        style={{
          backgroundColor: "rgba(17, 18, 20, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {activeAccount ? (
          <>
            <PlatformIcon
              platform={activeAccount.platform as Platform}
              className="h-4 w-4 text-foreground-secondary"
            />
            <span className="text-sm">@{activeAccount.handle}</span>
          </>
        ) : (
          <span className="text-sm">Connect Account</span>
        )}
        <CaretDown
          weight="bold"
          className="h-3 w-3 text-foreground-muted"
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-white/[0.06]",
            isMobile
              ? "fixed left-4 right-4 top-14"
              : "absolute right-0 top-full mt-2 w-[260px]",
          )}
          style={{
            backgroundColor: "rgba(17, 18, 20, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow:
              "0 10px 15px rgba(0,0,0,0.3), rgba(255,255,255,0.1) 0px 1px 0px 0px inset",
          }}
        >
          {/* Account list */}
          {accounts.length > 0 && (
            <div className="py-1">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 min-h-[44px] text-sm transition-colors",
                    "hover:bg-white/[0.05] cursor-pointer",
                  )}
                  onClick={() => {
                    switchAccount(account.id);
                    setIsOpen(false);
                  }}
                >
                  {account.is_active ? (
                    <Check
                      weight="bold"
                      className="h-4 w-4 shrink-0 text-accent"
                    />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  <PlatformIcon
                    platform={account.platform as Platform}
                    className="h-4 w-4 shrink-0 text-foreground-muted"
                  />
                  <span
                    className={cn(
                      "flex-1 truncate",
                      account.is_active
                        ? "text-foreground"
                        : "text-foreground-secondary",
                    )}
                  >
                    @{account.handle}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAccount(account.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-foreground-muted hover:text-foreground transition-opacity"
                    aria-label={`Remove @${account.handle}`}
                  >
                    <X weight="bold" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          {accounts.length > 0 && (
            <div className="mx-3 border-t border-white/[0.06]" />
          )}

          {/* Add account */}
          {isAdding ? (
            <div className="p-3 space-y-2">
              {/* Platform toggle */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setNewPlatform("tiktok")}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-md transition-colors",
                    newPlatform === "tiktok"
                      ? "bg-white/[0.1] text-foreground"
                      : "text-foreground-muted hover:text-foreground",
                  )}
                  aria-label="TikTok"
                >
                  <TiktokLogo weight="bold" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setNewPlatform("instagram")}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-md transition-colors",
                    newPlatform === "instagram"
                      ? "bg-white/[0.1] text-foreground"
                      : "text-foreground-muted hover:text-foreground",
                  )}
                  aria-label="Instagram"
                >
                  <InstagramLogo weight="bold" className="h-4 w-4" />
                </button>
              </div>
              {/* Input */}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") {
                      setIsAdding(false);
                      setNewHandle("");
                      setNewPlatform("tiktok");
                    }
                  }}
                  placeholder="@handle"
                  className="flex-1 min-h-[44px] rounded-md bg-white/[0.05] border border-white/[0.06] px-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newHandle.trim()}
                  className="shrink-0 min-h-[44px] rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground transition-opacity disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex w-full items-center gap-2 px-3 min-h-[44px] text-sm text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground"
            >
              <Plus weight="bold" className="h-4 w-4" />
              <span>Add account</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
