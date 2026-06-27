"use client";

/**
 * DiscoverEntry — the one-entry-two-modes Discover input (Phase 08, Plan 03, Task 3 — D-14).
 *
 * A SINGLE input box: classifyDiscoverInput (08-02) drives a LIVE mode hint as the user types.
 *   - "@handle" / a tiktok.com URL → profile mode (ranked vs their own baseline)
 *   - free text                    → niche mode   (ranked vs niche median)
 *
 * The baseline label updates live (UI-SPEC) so the user knows what "{n}×" will mean before
 * they pull. Submit hands the raw input up — the client owns the POST to /api/discover.
 *
 * Input height 44px (iOS touch floor / BRAND-BIBLE composer). No save/watchlist affordance (P10).
 */

import { useState } from "react";
import { classifyDiscoverInput } from "@/lib/discover/classify-input";

const MODE_HINT: Record<"profile" | "niche", string> = {
  profile: "Profile mode · ranked vs their own baseline",
  niche: "Niche mode · ranked vs niche median",
};

interface DiscoverEntryProps {
  /** Fired on submit with the trimmed raw input. The client classifies + POSTs. */
  onSubmit: (rawInput: string) => void;
  /** Disables the input + submit while a pull is in flight. */
  disabled?: boolean;
}

export function DiscoverEntry({ onSubmit, disabled = false }: DiscoverEntryProps) {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  // Live classification — drives the mode hint as the user types (D-14).
  const hint = trimmed.length > 0 ? MODE_HINT[classifyDiscoverInput(trimmed).mode] : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Paste a @handle or URL, or type a niche…"
          aria-label="Discover input — paste a handle or URL, or type a niche"
          className="flex-1 rounded-lg bg-white/[0.05] border border-white/[0.05] px-3 text-sm text-foreground placeholder:text-foreground-muted outline-none focus-visible:border-[var(--color-foreground-secondary)]/50 focus-visible:ring-1 focus-visible:ring-[var(--color-foreground-secondary)]/50 disabled:opacity-50 transition-colors"
          style={{ height: "44px" }}
        />
        <button
          type="submit"
          disabled={!trimmed || disabled}
          className="inline-flex items-center justify-center rounded-lg text-sm font-semibold px-4 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            height: "44px",
            color: "var(--color-action-foreground)",
            backgroundColor: "var(--color-action)",
            border: "none",
            cursor: trimmed && !disabled ? "pointer" : "default",
          }}
        >
          {disabled ? "Pulling…" : "Pull"}
        </button>
      </div>

      {/* Live mode hint — updates as the input is classified (profile vs niche). */}
      {hint && <p className="text-xs text-foreground-muted">{hint}</p>}
    </form>
  );
}
