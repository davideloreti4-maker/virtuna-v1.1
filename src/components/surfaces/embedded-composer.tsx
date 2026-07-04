"use client";

/**
 * EmbeddedComposer — STUB of the embeddable composer + handoff (Seam 4, THE-CONTRACT.md §3).
 *
 * `✦ {Verb} ▾ · input · ↑` on the start page (no thread yet). On submit — or when a card /
 * calendar day / quick action seeds it — it creates a thread with the audience context + seed
 * and routes to /thread/:id. That handoff is the ONE contract point between the two halves;
 * here `onLaunch` is called and the shell shows what WOULD happen (real routing = the graft).
 *
 * ⚠️ STUB: The Room owns the real composer (composer.tsx / composer-controls.tsx, SKILLS SSOT).
 * This mirrors the clean embedded entry; do NOT rebuild the atom — swap stub → real at the graft.
 */

import { useEffect, useRef, useState } from "react";
import type { Verb } from "@/lib/room-contract/types";
import { SurfaceIcon } from "./icons";
import { cn } from "@/lib/utils";

const VERB_MENU: { verb: Verb; title: string; sub: string }[] = [
  { verb: "Make", title: "Hooks · scripts · ideas", sub: "ranked, pre-tested on your people" },
  { verb: "Test", title: "A real video", sub: "the full Read before you post" },
  { verb: "Ask", title: "The room", sub: "a raw thought, react instantly" },
];

// Placeholder per verb — mirrors the real composer's verb-appropriate copy
// (composer.tsx PLACEHOLDER_BY_TOOL) so /start reads the same as the thread.
const VERB_PLACEHOLDER: Record<Verb, string> = {
  Make: "What do you want to make? Hooks, a script, ideas…",
  Test: "Paste a TikTok link or drop a video…",
  Ask: "Ask anything, or tap an idea…",
};

export function EmbeddedComposer({
  verb,
  onVerbChange,
  seed,
  onLaunch,
  onAttach,
  disabled,
}: {
  verb: Verb;
  onVerbChange: (verb: Verb) => void;
  /** Prefill text pushed from a tapped card/day (a fresh object each time re-seeds). */
  seed?: { text: string; nonce: number } | null;
  onLaunch: (input: string, verb: Verb) => void;
  onAttach?: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [appliedNonce, setAppliedNonce] = useState<number | null>(null);
  const seeded = Boolean(seed?.text);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync the input when a NEW seed arrives — React's "adjust state during render"
  // pattern (preferred over an effect; nonce guards against re-applying the same seed).
  if (seed && seed.nonce !== appliedNonce) {
    setAppliedNonce(seed.nonce);
    setValue(seed.text);
  }

  // Focus on a fresh seed — a real DOM side-effect (no state writes → no effect churn).
  useEffect(() => {
    if (seed) inputRef.current?.focus();
  }, [seed]);

  const launch = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onLaunch(text, verb);
    setValue("");
  };

  return (
    <div className="relative">
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close verb menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-[224px] rounded-2xl border border-border-hover bg-surface-elevated p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {VERB_MENU.map((m) => (
              <button
                key={m.verb}
                type="button"
                onClick={() => {
                  onVerbChange(m.verb);
                  setMenuOpen(false);
                  inputRef.current?.focus();
                }}
                className="flex w-full flex-col gap-px rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[color:var(--color-surface-thread)]"
              >
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-foreground-muted">{m.verb}</span>
                <b className="text-[12.5px] font-semibold text-foreground">{m.title}</b>
                <span className="text-[10.5px] text-foreground-muted">{m.sub}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div
        className={cn(
          "flex items-center gap-[7px] rounded-2xl border bg-surface-elevated px-[9px] py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-colors",
          seeded ? "border-accent" : "border-border-hover",
        )}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-border-hover bg-[color:var(--color-surface-thread)] px-2.5 py-[7px] transition-colors hover:border-accent"
        >
          <span className="text-[12px] text-accent">✦</span>
          <span className="text-[12.5px] font-semibold text-foreground">{verb}</span>
          <span className="text-[9px] text-foreground-muted">▾</span>
        </button>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              launch();
            }
          }}
          placeholder={VERB_PLACEHOLDER[verb]}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-foreground-muted focus:outline-none"
        />
        <button type="button" onClick={onAttach} aria-label="Attach" className="grid size-6 shrink-0 place-items-center text-foreground-muted transition-colors hover:text-foreground-secondary">
          <SurfaceIcon name="paperclip" size={16} />
        </button>
        <button
          type="button"
          onClick={launch}
          aria-label="Launch"
          className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)] transition-transform hover:scale-105"
        >
          <SurfaceIcon name="up" size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
