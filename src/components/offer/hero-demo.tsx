"use client";

/**
 * HeroDemo — the product running itself, on loop, under the live composer
 * (owner call 2026-07-27: "when you go on the page freshly, you don't know
 * exactly what to do — we need some kind of animation").
 *
 * A fresh visitor learns the action by WATCHING it: three beats, ~9s, looping —
 *
 *   TYPE    a TikTok link types itself into a miniature of the composer above
 *           (same radius/border language, smaller — the mapping is the lesson),
 *           and the send arrow fills as it completes;
 *   READ    the row becomes the run: a sweeping progress hairline with the real
 *           product's stage language ("Reading it frame by frame…" → "The room
 *           reacts…");
 *   VERDICT the three deliverables land, staggered — would-stop %, the scroll
 *           second, the fix — figures VERBATIM from `CREATOR_TEMPLATE`
 *           (detail-fixture.ts), the same fixture the full room renders.
 *
 * Honesty: the card is chip-labeled DEMO — nothing here poses as a live run or
 * the visitor's own numbers. Restraint: `prefers-reduced-motion` renders the
 * verdict statically (no choreography), and the `paused` prop (the composer
 * above was touched) freezes the loop on the verdict — the demo never competes
 * with a visitor who has already started.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const DEMO_LINK = "tiktok.com/@maya.creates/video/730112…";

const READ_LABELS = ["Reading it frame by frame…", "The room reacts…"] as const;

/** Verbatim from CREATOR_TEMPLATE — change them THERE, not here. */
const VERDICT = [
  { value: "38.2%", label: "would stop scrolling" },
  { value: "0:04", label: "the second they leave" },
  { value: "“Cut to the payoff before 0:03”", label: "the fix" },
] as const;

const TYPE_TICK_MS = 42;
const TYPE_HOLD_MS = 700;
const READ_LABEL_MS = 1400;
const VERDICT_HOLD_MS = 4200;

type Beat = "type" | "read" | "verdict";

export function HeroDemo({ paused = false }: { paused?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [beat, setBeat] = useState<Beat>("type");
  const [typed, setTyped] = useState(0);
  const [readLabel, setReadLabel] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const still = reducedMotion || paused;

  useEffect(() => {
    if (still) return; // the static branch renders the verdict; nothing to schedule
    const t = timers.current;
    const clear = () => {
      t.forEach(clearTimeout);
      t.length = 0;
    };

    if (beat === "type") {
      if (typed < DEMO_LINK.length) {
        t.push(setTimeout(() => setTyped((n) => n + 1), TYPE_TICK_MS));
      } else {
        t.push(setTimeout(() => setBeat("read"), TYPE_HOLD_MS));
      }
    } else if (beat === "read") {
      if (readLabel < READ_LABELS.length - 1) {
        t.push(setTimeout(() => setReadLabel((n) => n + 1), READ_LABEL_MS));
      } else {
        t.push(setTimeout(() => setBeat("verdict"), READ_LABEL_MS));
      }
    } else {
      t.push(
        setTimeout(() => {
          setTyped(0);
          setReadLabel(0);
          setBeat("type");
        }, VERDICT_HOLD_MS),
      );
    }
    return clear;
  }, [beat, typed, readLabel, still]);

  const showVerdict = still || beat === "verdict";

  return (
    <div className="relative rounded-[12px] border border-white/[0.06] bg-[#181817] px-5 py-4">
      {/* the honesty chip — this is a demonstration, not a live run */}
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-foreground-muted">
          Watch how it works
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground-muted/70">
          Demo
        </span>
      </div>

      <div className="mt-3 min-h-[86px]">
        <AnimatePresence mode="wait" initial={false}>
          {showVerdict ? (
            <motion.div
              key="verdict"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.35 } }}
              className="grid gap-4 sm:grid-cols-3"
            >
              {VERDICT.map((cell, i) => (
                <motion.div
                  key={cell.label}
                  initial={still ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: still ? 0 : 0.12 + i * 0.16, duration: 0.4 }}
                >
                  <div className="text-[17px] font-medium leading-snug tracking-[-0.01em] text-foreground tabular-nums">
                    {cell.value}
                  </div>
                  <div className="mt-1 text-[12px] text-foreground-muted">{cell.label}</div>
                </motion.div>
              ))}
            </motion.div>
          ) : beat === "type" ? (
            <motion.div
              key="type"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className="flex items-center gap-3"
            >
              {/* the miniature of the composer above — same surface language, smaller */}
              <div className="flex h-[52px] min-w-0 flex-1 items-center rounded-[10px] border border-white/[0.06] bg-surface-elevated px-4">
                <span className="truncate font-mono text-[13px] text-foreground-secondary">
                  {DEMO_LINK.slice(0, typed)}
                  <span className="ml-px inline-block h-[14px] w-px translate-y-[2px] animate-pulse bg-foreground/60" />
                </span>
              </div>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300"
                style={{
                  background:
                    typed >= DEMO_LINK.length
                      ? "var(--color-accent)"
                      : "rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-[15px]"
                  style={{
                    color:
                      typed >= DEMO_LINK.length ? "#1f1f1e" : "rgba(236,231,222,0.5)",
                  }}
                  aria-hidden
                >
                  ↑
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="read"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className="flex h-[52px] flex-col justify-center gap-2.5"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={readLabel}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="text-[13px] text-foreground-secondary"
                >
                  {READ_LABELS[readLabel]}
                </motion.span>
              </AnimatePresence>
              {/* the sweep — a hairline, not a spinner; matte system, no glow */}
              <div className="h-px w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full w-1/3 rounded-full"
                  style={{ background: "var(--color-accent)" }}
                  initial={{ x: "-110%" }}
                  animate={{ x: "320%" }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
