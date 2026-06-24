"use client";

/**
 * AudienceChip — composer audience pill with per-thread pin (D-04).
 *
 * Single collapsed pill: "for {platform} · {name}"
 * Mirrors PlatformChip's "on" prefix grammar + coral-active treatment.
 *
 * Tapping opens:
 *   Desktop: compact inline dropdown (bg-surface-elevated, 12px radius, shadow-float)
 *   Mobile (pointer-coarse): native-feeling bottom sheet with full-width 44px rows
 *
 * Active state:
 *   General → neutral (default styling)
 *   Calibrated audience → coral border/tint (signals moat is engaged)
 *
 * Per-thread pin (D-04):
 *   On selection → PATCH /api/threads/[threadId] { active_audience_id }
 *   NULL = General (sentinel). New threads default to General.
 *
 * Populated from GET /api/audiences.
 * "Manage audiences →" footer link → /audience.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Audience } from "@/lib/audience/audience-types";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { CaretDown } from "@phosphor-icons/react";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "IG",
  youtube: "YT",
  custom: "Custom",
};

interface AudienceChipProps {
  /** The current open thread id (null before thread is created) */
  threadId: string | null;
  /** Called after successful pin so parent can reflect the new audience id */
  onAudienceChange?: (audienceId: string | null) => void;
  className?: string;
}

export function AudienceChip({ threadId, onAudienceChange, className }: AudienceChipProps) {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null); // null = General
  const [open, setOpen] = useState(false);
  const [patching, setPatching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch audiences once on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchAudiences() {
      setLoadingAudiences(true);
      try {
        const res = await fetch("/api/audiences");
        if (!res.ok || cancelled) return;
        const data = await res.json() as { audiences: Audience[] };
        if (!cancelled) setAudiences(data.audiences ?? []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingAudiences(false);
      }
    }
    void fetchAudiences();
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedAudience = audiences.find((a) => a.id === selectedId) ?? null;
  const isGeneral = !selectedId || !selectedAudience || selectedAudience.is_general;

  // Pill label: "for {platform} · {name}"
  const platformLabel = selectedAudience
    ? (PLATFORM_LABELS[selectedAudience.platform] ?? selectedAudience.platform)
    : "TikTok";
  const audienceName = isGeneral ? "General" : (selectedAudience?.name ?? "General");

  const handleSelect = useCallback(async (audience: Audience) => {
    const newId = audience.is_general ? null : audience.id;
    setSelectedId(newId);
    setOpen(false);

    // Persist per-thread pin
    if (threadId) {
      setPatching(true);
      try {
        await fetch(`/api/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_audience_id: newId }),
        });
        onAudienceChange?.(newId);
      } catch {
        // non-fatal — chip reflects optimistic state
      } finally {
        setPatching(false);
      }
    } else {
      onAudienceChange?.(newId);
    }
  }, [threadId, onAudienceChange]);

  const chipActive = !isGeneral;

  return (
    <div ref={containerRef} className={cn("relative flex items-center gap-1", className)}>
      {/* "for" prefix — matches PlatformChip's "on" prefix */}
      <span className="mr-0.5 text-[10px] text-foreground-muted/50 uppercase tracking-wide select-none">
        for
      </span>

      {/* Collapsed pill trigger */}
      <button
        type="button"
        aria-pressed={chipActive}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "pointer-coarse:min-h-[44px] pointer-coarse:px-3",
          chipActive
            ? "border-border-hover bg-hover text-foreground"
            : "border-white/[0.06] text-foreground-muted/60 hover:border-white/[0.1] hover:bg-white/[0.03] hover:text-foreground-muted",
        )}
      >
        <span className="max-w-[80px] truncate">
          {platformLabel} · {audienceName}
        </span>
        {patching ? (
          <Spinner size="sm" className="ml-0.5" />
        ) : (
          <CaretDown weight="bold" className="w-2.5 h-2.5 shrink-0 opacity-60" />
        )}
      </button>

      {/* Picker — desktop dropdown */}
      {open && (
        <>
          {/* Desktop dropdown */}
          <div
            role="listbox"
            aria-label="Select audience"
            className={cn(
              "absolute bottom-full mb-1 left-0 z-20",
              "w-56 rounded-xl border border-white/[0.06] bg-surface-elevated shadow-float overflow-hidden",
              // Hide on touch — bottom sheet shows instead
              "hidden pointer-fine:block",
            )}
          >
            {loadingAudiences ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : (
              <>
                {audiences.map((audience) => {
                  const isActive = audience.is_general
                    ? isGeneral
                    : audience.id === selectedId;
                  return (
                    <button
                      key={audience.id}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => void handleSelect(audience)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 min-h-[38px] text-sm transition-colors text-left",
                        isActive
                          ? "text-foreground bg-hover"
                          : "text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground",
                      )}
                    >
                      <span className="flex-1 truncate">{audience.name}</span>
                      {isActive && (
                        <span className="text-foreground-secondary text-xs">✓</span>
                      )}
                    </button>
                  );
                })}
                <div className="border-t border-white/[0.06]">
                  <Link
                    href="/audience"
                    onClick={() => setOpen(false)}
                    className="flex items-center px-3 min-h-[36px] text-xs text-foreground-muted hover:text-foreground hover:bg-white/[0.04] transition-colors"
                  >
                    Manage audiences →
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Mobile bottom sheet (pointer-coarse) */}
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-white/[0.06] bg-surface-elevated pb-safe",
              "pointer-fine:hidden",
            )}
            role="listbox"
            aria-label="Select audience"
          >
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-sm font-semibold text-foreground">Select audience</p>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {loadingAudiences ? (
                <div className="flex justify-center py-6">
                  <Spinner size="md" />
                </div>
              ) : (
                audiences.map((audience) => {
                  const isActive = audience.is_general
                    ? isGeneral
                    : audience.id === selectedId;
                  return (
                    <button
                      key={audience.id}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => void handleSelect(audience)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 min-h-[52px] text-base transition-colors text-left",
                        isActive
                          ? "text-foreground bg-hover"
                          : "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
                      )}
                    >
                      <span className="flex-1 truncate">{audience.name}</span>
                      {isActive && <span className="text-foreground-secondary">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-white/[0.06] px-4 py-3">
              <Link
                href="/audience"
                onClick={() => setOpen(false)}
                className="text-sm text-foreground-secondary hover:text-foreground"
              >
                Manage audiences →
              </Link>
            </div>
          </div>

          {/* Backdrop for mobile sheet */}
          <div
            className="fixed inset-0 z-40 bg-black/50 pointer-fine:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
