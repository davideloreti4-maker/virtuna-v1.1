"use client";

import { useState, useRef, useEffect } from "react";
import { CaretUpDown, Check, Plus, X } from "@phosphor-icons/react";

import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useTiktokAccounts } from "@/hooks/use-tiktok-accounts";

export function TiktokAccountSelector() {
  const { accounts, activeAccount, isLoading, switchAccount, addAccount, removeAccount } =
    useTiktokAccounts();

  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setNewHandle("");
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
    await addAccount(trimmed);
    setNewHandle("");
    setIsAdding(false);
  };

  if (isLoading) {
    return (
      <div className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2",
          "bg-white/[0.04] transition-colors hover:bg-white/[0.06]",
          "text-left",
        )}
      >
        <Text as="span" size="sm" className={activeAccount ? "text-foreground" : "text-foreground-muted"}>
          {activeAccount ? `@${activeAccount.handle}` : "Add TikTok Account"}
        </Text>
        <CaretUpDown weight="bold" className="h-3.5 w-3.5 shrink-0 text-foreground-secondary" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-1 overflow-hidden rounded-lg border border-white/[0.06]"
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
                    "group flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    "hover:bg-white/[0.05] cursor-pointer",
                  )}
                  onClick={() => {
                    switchAccount(account.id);
                    setIsOpen(false);
                  }}
                >
                  {account.is_active ? (
                    <Check weight="bold" className="h-3.5 w-3.5 shrink-0 text-accent" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className={cn("flex-1 truncate", account.is_active ? "text-foreground" : "text-foreground-secondary")}>
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
                    <X weight="bold" className="h-3.5 w-3.5" />
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
            <div className="flex items-center gap-2 p-2">
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
                  }
                }}
                placeholder="@handle"
                className="flex-1 rounded-md bg-white/[0.05] border border-white/[0.06] px-2.5 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newHandle.trim()}
                className="shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground transition-opacity disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground"
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
