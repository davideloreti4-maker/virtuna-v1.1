"use client";

/**
 * AmbientStart — Ambient Audience v2, surface ④ "the instrument at rest" (L6).
 *
 * The screen you land on with nothing running: a cockpit, not a dashboard. Configuration is loud
 * exactly once, here at the thread's birth — time-of-day serif hero · the three thread-default
 * chips (room · scene · fidelity, L4) · composer · ACTIONS grid (the skill menu, each preset a
 * lens). Once you run something these chips collapse quiet and you're in Overview/Detail.
 *
 * No r4 sketch existed — designed from the L6 spec + doctrine (one hero, biggest type = the moment,
 * space is the luxury, serif = the greeting voice, coral withheld: nothing is lost yet).
 */

import { useEffect, useState } from "react";
import { TONE } from "./AmbientDetail";

// ── view-model ───────────────────────────────────────────────────────────────

export interface StartChip {
  connective: string; // "in" | "as" | ""
  label: string;
}

export type ActionIcon = "sparkle" | "play" | "ask" | "repeat";

export interface StartAction {
  icon: ActionIcon;
  label: string;
  desc: string;
  lens: string; // the preset question this action arms ("would stop" …)
}

export interface StartData {
  name: string;
  chips: StartChip[];
  composerPlaceholder: string;
  actions: StartAction[];
}

function timeGreeting(): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}`;
}

// minimal line glyphs (matte, no emoji)
function Icon({ kind }: { kind: ActionIcon }) {
  const s = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "sparkle")
    return (
      <svg {...s} aria-hidden>
        <path d="M8 1.6 L9.3 6.7 L14.4 8 L9.3 9.3 L8 14.4 L6.7 9.3 L1.6 8 L6.7 6.7 Z" />
      </svg>
    );
  if (kind === "play")
    return (
      <svg {...s} aria-hidden>
        <path d="M5 3.5 L12.5 8 L5 12.5 Z" />
      </svg>
    );
  if (kind === "ask")
    return (
      <svg {...s} aria-hidden>
        <path d="M2.5 3.5 h11 v7 h-6 l-3 2.5 v-2.5 h-2 Z" />
      </svg>
    );
  return (
    <svg {...s} aria-hidden>
      <path d="M3 6 a5 5 0 0 1 9-2 M13 3.5 V6 h-2.5 M13 10 a5 5 0 0 1-9 2 M3 12.5 V10 h2.5" />
    </svg>
  );
}

// ── the surface ──────────────────────────────────────────────────────────────

export function AmbientStart({
  data,
  onChip,
  onAction,
  onSubmit,
}: {
  data: StartData;
  onChip?: (i: number) => void;
  onAction?: (i: number) => void;
  onSubmit?: (text: string) => void;
}) {
  const { name, chips, composerPlaceholder, actions } = data;
  // client-only greeting: the wall clock differs server↔client, so resolve it after mount (lazy
  // init would run on the server and hydration-mismatch across an hour/timezone boundary).
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to the browser clock
    setGreeting(timeGreeting());
  }, []);

  return (
    <div
      data-testid="ambient-start"
      className="flex w-full max-w-[560px] flex-col"
      style={{ color: TONE.cream, fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }}
    >
      {/* brand glyph */}
      <svg viewBox="0 0 22 16" className="h-4 w-[22px]" aria-hidden>
        <circle cx="3" cy="12" r="1.6" fill="#ece7de" opacity=".9" />
        <circle cx="9" cy="5" r="1.3" fill="#ece7de" opacity=".55" />
        <circle cx="15" cy="10" r="1.6" fill="#ece7de" opacity=".8" />
        <circle cx="19" cy="3" r="1.2" fill="#FF6363" opacity=".9" />
        <line x1="3" y1="12" x2="9" y2="5" stroke="#ece7de" strokeOpacity=".25" />
        <line x1="9" y1="5" x2="15" y2="10" stroke="#ece7de" strokeOpacity=".25" />
        <line x1="15" y1="10" x2="19" y2="3" stroke="#ece7de" strokeOpacity=".25" />
      </svg>

      {/* time-of-day hero (serif = the greeting voice) */}
      <h1 className="mt-6 font-serif text-[34px] font-normal leading-[1.15] tracking-[-0.01em]">
        {greeting}, {name}
      </h1>

      {/* thread-default chips — loud once, at birth */}
      <div className="mt-6 flex flex-wrap items-center gap-2 text-[14px]">
        {chips.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {c.connective ? <span style={{ color: TONE.faint }}>{c.connective}</span> : null}
            <button
              type="button"
              onClick={() => onChip?.(i)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
              style={{ border: `1px solid ${TONE.hair}`, background: TONE.well, color: TONE.cream }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = TONE.hair)}
            >
              {c.label}
              <span style={{ color: TONE.faint }}>▾</span>
            </button>
          </span>
        ))}
      </div>

      {/* composer */}
      <ComposerRow placeholder={composerPlaceholder} onSubmit={onSubmit} />

      {/* ACTIONS grid — what would you like to simulate? */}
      <div className="mt-9 font-mono text-[12px] uppercase tracking-[0.08em]" style={{ color: TONE.faint }}>
        What would you like to simulate?
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onAction?.(i)}
            className="flex items-start gap-3 rounded-[12px] p-4 text-left transition-colors"
            style={{ border: `1px solid ${TONE.border}`, background: "#1f1f1e" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = TONE.border)}
          >
            <span className="mt-0.5 flex-none" style={{ color: TONE.dim }}>
              <Icon kind={a.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium" style={{ color: TONE.cream }}>
                {a.label}
              </span>
              <span className="mt-0.5 block text-[13px]" style={{ color: TONE.faint }}>
                {a.desc}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ComposerRow({ placeholder, onSubmit }: { placeholder: string; onSubmit?: (t: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (text.trim()) onSubmit?.(text.trim());
  };
  return (
    <div
      className="mt-5 flex items-center gap-2 rounded-[12px] py-2 pl-4 pr-2"
      style={{ border: `1px solid ${TONE.border}`, background: "#1a1a19" }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        style={{ color: TONE.cream }}
      />
      <button
        type="button"
        onClick={submit}
        aria-label="Simulate"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] transition-opacity"
        style={{ background: TONE.cream, color: "#1c1b19", opacity: text.trim() ? 1 : 0.4 }}
      >
        ↑
      </button>
    </div>
  );
}
