"use client";

/**
 * EmbeddedComposer — the Room-owned embeddable composer atom (Seam 4, THE-CONTRACT.md §3).
 *
 * The clean `✦ {Verb} ▾ · input · ↑` entry, mountable on a surface that has no thread
 * (the start page). DECOUPLED from /home's machinery on purpose: embedding is a *handoff*,
 * not an inline skill run — on submit it just emits `onLaunch(input, verb)` and the host
 * routes into the real thread (see `buildThreadLaunchHref`). So this atom holds NONE of the
 * monolith's guts (no stream hooks, no useRouter/useParams, no rehydration, no /analyze nav,
 * no presence rail) — those belong to the /home Composer, which runs the skill once the
 * launch lands.
 *
 * Replaces the surfaces-owned stub (`surfaces/embedded-composer.tsx`) so the composer is a
 * single Room-owned atom (no drift): same verb vocab (Make/Test/Ask), same ✦ spark glyph,
 * same Room icons/tokens as the /home composer row. The external API is a drop-in superset
 * of the old stub (`verb/onVerbChange/seed/onLaunch/onAttach/disabled`) so the host wiring
 * (start-page.tsx) is unchanged apart from the import.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Verb } from "@/lib/room-contract/types";

// The verb menu — the three-verb collapse (THE-CONTRACT.md §2). Copy mirrors the thread's
// verb-appropriate framing so /start reads the same as the room.
const VERB_MENU: { verb: Verb; title: string; sub: string }[] = [
  { verb: "Make", title: "Hooks · scripts · ideas", sub: "ranked, pre-tested on your people" },
  { verb: "Test", title: "A real video", sub: "the full Read before you post" },
  { verb: "Ask", title: "The room", sub: "a raw thought, react instantly" },
];

// Placeholder per verb — mirrors the /home composer's verb-appropriate copy
// (composer.tsx PLACEHOLDER_BY_TOOL) so the field reads identically across surfaces.
const VERB_PLACEHOLDER: Record<Verb, string> = {
  Make: "What do you want to make? Hooks, a script, ideas…",
  Test: "Paste a TikTok link or drop a video…",
  Ask: "Ask anything, or drop a raw thought…",
};

// The composer's ONE accent glyph (terracotta ✦) — a 4-point sparkle, inlined (stroked,
// no-emoji system) to mirror composer-controls' `ICONS.spark` WITHOUT pulling the whole
// controls module into every surface's bundle. Keep the path in sync with that SSOT.
function Spark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={15}
      height={15}
      className={cn("shrink-0", className)}
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5z" />
    </svg>
  );
}

export interface EmbeddedComposerProps {
  /** Active verb (controlled by the host so quick-actions / pillars can steer it). */
  verb: Verb;
  onVerbChange: (verb: Verb) => void;
  /** Prefill text pushed from a tapped card / calendar day / quick action (a fresh
   *  object each time — the nonce re-seeds even when the text repeats). */
  seed?: { text: string; nonce: number } | null;
  /** The ONE contract point: emit the composed intent; the host routes it into the thread. */
  onLaunch: (input: string, verb: Verb) => void;
  onAttach?: () => void;
  disabled?: boolean;
  className?: string;
}

export function EmbeddedComposer({
  verb,
  onVerbChange,
  seed,
  onLaunch,
  onAttach,
  disabled,
  className,
}: EmbeddedComposerProps) {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [appliedNonce, setAppliedNonce] = useState<number | null>(null);
  const seeded = Boolean(seed?.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync the field when a NEW seed arrives — React's "adjust state during render" pattern
  // (preferred over an effect; the nonce guards against re-applying the same seed).
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
    <div className={cn("relative", className)}>
      {menuOpen && (
        <>
          {/* Click-away scrim — closes the verb menu without stealing the next click's target. */}
          <button
            type="button"
            aria-label="Close verb menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            aria-label="Verbs"
            className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-[248px] rounded-2xl border border-white/[0.06] bg-[#211f1d] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          >
            {VERB_MENU.map((m) => (
              <button
                key={m.verb}
                type="button"
                role="menuitemradio"
                aria-checked={m.verb === verb}
                onClick={() => {
                  onVerbChange(m.verb);
                  setMenuOpen(false);
                  inputRef.current?.focus();
                }}
                className="flex w-full flex-col gap-px rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#2b2926]"
              >
                <span className="flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-[0.1em] text-foreground-muted">
                  {m.verb === verb && <Spark className="text-foreground-muted" />}
                  {m.verb}
                </span>
                <b className="text-[12.5px] font-semibold text-foreground">{m.title}</b>
                <span className="text-[10.5px] text-foreground-muted">{m.sub}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Two-row composer (Claude / Perplexity pattern) — byte-for-byte the /home composer's
          layout: the field owns the FULL-WIDTH top row for real height + breathing room; the
          controls sit on a bottom row — [✦ Verb ▾] on the left, attach + cream send on the
          right. Matches composer.tsx's composerDock/composerForm so the two entries read
          identically across surfaces. */}
      <div
        className={cn(
          "flex flex-col gap-3.5 rounded-[24px] border bg-surface-elevated p-4 shadow-float transition-colors",
          seeded ? "border-white/[0.14]" : "border-white/[0.06]",
        )}
      >
        {/* Row 1 — the field. textarea (auto-multiline). Enter launches, Shift+Enter newlines
            (mirrors the /home composer's onFieldKeyDown), so the two entries behave identically. */}
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              launch();
            }
          }}
          placeholder={VERB_PLACEHOLDER[verb]}
          disabled={disabled}
          aria-label={`Compose to ${verb}`}
          className={cn(
            "w-full min-w-0 resize-none bg-transparent px-1 pt-0.5 text-[15px] text-foreground",
            "placeholder:text-foreground-muted focus:outline-none",
            "min-h-[72px] max-h-[200px] leading-[1.55]",
          )}
        />

        {/* Row 2 — controls, split like /home: LEFT = attach · verb pill; RIGHT = the cream send. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Attach — a chat / screenshot / reference to steer (the host owns the picker).
                Borderless quiet glyph, circular — byte-for-byte the /home composer's attach. */}
            <button
              type="button"
              onClick={onAttach}
              aria-label="Attach"
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 pointer-coarse:h-11 pointer-coarse:w-11"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>

            {/* Verb pill — mirrors /home's borderless FILLED skill pill (rounded-full bg-white/[0.05],
                muted spark, no accent) so /start reads identically to the room. */}
            <button
              type="button"
              aria-label={`Verb: ${verb}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3",
                "text-[13.5px] font-medium text-foreground transition-colors hover:bg-white/[0.08]",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 pointer-coarse:h-11",
              )}
            >
              <Spark className="text-foreground-muted" />
              <span>{verb}</span>
              <svg viewBox="0 0 16 16" width={13} height={13} className="shrink-0 text-foreground-muted" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6.2l4 4 4-4" />
              </svg>
            </button>
          </div>

          {/* Launch — the clean cream disc (same Button + sizing as the /home send). */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            aria-label="Launch"
            disabled={disabled || value.trim().length === 0}
            onClick={launch}
            style={{ boxShadow: "none" }}
            className="shrink-0 h-[36px] w-[36px] min-w-0 p-0 rounded-full"
          >
            <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Button>
        </div>
      </div>
    </div>
  );
}
