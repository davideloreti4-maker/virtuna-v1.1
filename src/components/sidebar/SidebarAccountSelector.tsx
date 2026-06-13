"use client";

/**
 * SidebarAccountSelector — the @handle (TikTok/IG) account switcher kept in the
 * lean Numen sidebar (D-12: the engine uses creator context, so the active
 * account stays one click away). Flat-warm matte: solid charcoal popover, no
 * glass. Extracted from Sidebar.tsx to keep that file under the 500-line budget.
 */

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  UserPlus,
  CaretDown,
  Check,
  TiktokLogo,
  InstagramLogo,
  X,
} from "@phosphor-icons/react";

import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSocialAccounts } from "@/hooks/use-social-accounts";
import type { Platform } from "@/hooks/use-social-accounts";

// Branded keyboard-focus ring — replaces the browser-default blue outline on
// raw <button>s. Inset so it never spills past the panel's rounded clip.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50";

export function SidebarAccountSelector({ isCollapsed }: { isCollapsed: boolean }) {
  const { accounts, activeAccount, isLoading, switchAccount, addAccount, removeAccount } = useSocialAccounts();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState<Platform>("tiktok");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus();
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

  const PlatformIconComp = (platform: Platform) =>
    platform === "instagram" ? (
      <InstagramLogo weight="bold" className="h-5 w-5 shrink-0" />
    ) : (
      <TiktokLogo weight="bold" className="h-5 w-5 shrink-0" />
    );

  const trigger = (
    <button
      type="button"
      onClick={() => setIsOpen((p) => !p)}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 min-h-[34px] rounded-lg text-sm font-medium",
        "transition-colors duration-100",
        focusRing,
        isCollapsed ? "justify-center px-0" : "",
        "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
      )}
      aria-label={activeAccount ? `Account: @${activeAccount.handle}` : "Connect account"}
    >
      {activeAccount ? (
        <>
          {PlatformIconComp(activeAccount.platform as Platform)}
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-left">@{activeAccount.handle}</span>
              <CaretDown weight="bold" className="h-3 w-3 shrink-0 text-foreground-muted" />
            </>
          )}
        </>
      ) : (
        <>
          <Icon icon={UserPlus} size={20} className="shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left">Connect account</span>}
        </>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right">
          {activeAccount ? `@${activeAccount.handle}` : "Connect account"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      {trigger}
      {isOpen && (
        <div className="mt-0.5 rounded-lg border border-white/[0.06] overflow-hidden bg-surface-elevated">
          {accounts.length > 0 && (
            <div className="py-1">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="group flex items-center gap-2 px-3 min-h-[40px] text-sm transition-colors hover:bg-white/[0.05] cursor-pointer"
                  onClick={() => { switchAccount(account.id); setIsOpen(false); }}
                >
                  {account.is_active ? (
                    <Check weight="bold" className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  {PlatformIconComp(account.platform as Platform)}
                  <span className={cn("flex-1 truncate text-xs", account.is_active ? "text-foreground" : "text-foreground-secondary")}>
                    @{account.handle}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAccount(account.id); }}
                    className="opacity-0 group-hover:opacity-100 text-foreground-muted hover:text-foreground transition-opacity"
                    aria-label={`Remove @${account.handle}`}
                  >
                    <X weight="bold" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {accounts.length > 0 && <div className="mx-3 border-t border-white/[0.06]" />}
          {isAdding ? (
            <div className="p-3 space-y-2">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setNewPlatform("tiktok")}
                  className={cn("flex items-center justify-center h-7 w-7 rounded-md transition-colors", newPlatform === "tiktok" ? "bg-white/[0.1] text-foreground" : "text-foreground-muted hover:text-foreground")}
                >
                  <TiktokLogo weight="bold" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNewPlatform("instagram")}
                  className={cn("flex items-center justify-center h-7 w-7 rounded-md transition-colors", newPlatform === "instagram" ? "bg-white/[0.1] text-foreground" : "text-foreground-muted hover:text-foreground")}
                >
                  <InstagramLogo weight="bold" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") { setIsAdding(false); setNewHandle(""); setNewPlatform("tiktok"); }
                  }}
                  placeholder="@handle"
                  className="flex-1 h-8 rounded-md bg-white/[0.05] border border-white/[0.06] px-2 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newHandle.trim()}
                  className="shrink-0 h-8 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex w-full items-center gap-2 px-3 min-h-[40px] text-xs text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground"
            >
              <Plus weight="bold" className="h-3.5 w-3.5" />
              <span>Add account</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
