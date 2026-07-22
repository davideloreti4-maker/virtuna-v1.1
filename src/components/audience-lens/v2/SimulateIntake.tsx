"use client";

/**
 * SimulateIntake — the cold-start phase of surface ⑤ + the shared sheet chrome.
 *
 * When ⑤ is entered COLD (the ④ "Test something against your audience →" door) there's no stimulus
 * to develop yet, so this step collects one before the run is armed: "What are you testing?" over the
 * intake doors. Each door names the SCREEN vs QUERY fork (domain-scaffold) — video / draft = *screen*,
 * ask / survey = *query*, A/B = *compare*. Scope 2026-07-21: screen doors are active; compare + query
 * are shown but deferred ("soon") until their arms/outputs get their own read-templates.
 *
 * This is a LEAF module: it owns the shared sheet primitives (`SHEET_STYLE`, `Kick`, `CloseButton`)
 * so the gateway can import them here without a runtime import cycle (AmbientSimulate → SimulateIntake,
 * never the reverse; the type imports below are erased at compile).
 */

import { TONE } from "./AmbientDetail";
import type { IntakeOption, SimulateData } from "./AmbientSimulate";

// ── shared sheet chrome ────────────────────────────────────────────────────────

export const SHEET_STYLE: React.CSSProperties = {
  background: "#1f1f1e",
  border: `1px solid ${TONE.border}`,
  color: TONE.cream,
  fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
  boxShadow: "0 24px 64px rgba(0,0,0,.45)",
};

export function Kick({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[12px] uppercase tracking-[0.08em]" style={{ color: TONE.faint }}>
      {children}
    </div>
  );
}

export function CloseButton({ onClose }: { onClose?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[15px] transition-colors"
      style={{ color: TONE.faint }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
      onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
    >
      ✕
    </button>
  );
}

// ── the intake step ────────────────────────────────────────────────────────────

/** Per-family glyph — screen = aperture/target ring (echoes the ④ door) · compare = two bars ·
 *  query = a speech bubble. */
function IntakeGlyph({ family }: { family: IntakeOption["family"] }) {
  if (family === "compare")
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
        <rect x="2.5" y="4" width="6" height="12" rx="1.2" />
        <rect x="11.5" y="4" width="6" height="12" rx="1.2" />
      </svg>
    );
  if (family === "query")
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
        <path d="M3 4.5 h14 v9 h-8 l-4 3 v-3 h-2 Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="10" r=".6" fill="currentColor" />
    </svg>
  );
}

export function IntakeStep({
  data,
  onClose,
  onPick,
}: {
  data: SimulateData;
  onClose?: () => void;
  onPick: (opt: IntakeOption) => void;
}) {
  return (
    <div data-testid="ambient-simulate" data-phase="intake" className="flex w-full max-w-[460px] flex-col rounded-[16px]" style={SHEET_STYLE}>
      <div className="px-[26px] pt-[24px]">
        <div className="flex items-start justify-between">
          <Kick>Test against your audience</Kick>
          <CloseButton onClose={onClose} />
        </div>
        <div className="mt-2.5 text-[17px] font-medium" style={{ color: TONE.cream }}>
          What are you testing?
        </div>
        <div className="mt-1 text-[13px]" style={{ color: TONE.faint }}>
          Pick what to put in front of {data.room.toLowerCase()} — then arm the run.
        </div>
      </div>

      <div className="mt-4 px-[16px] pb-[18px]">
        {data.intake.map((opt) => {
          const active = opt.status === "active";
          return (
            <button
              key={opt.kind}
              type="button"
              disabled={!active}
              onClick={() => active && onPick(opt)}
              className="flex w-full items-center gap-3 rounded-[12px] px-[10px] py-3 text-left transition-colors"
              style={{ cursor: active ? "pointer" : "default", opacity: active ? 1 : 0.5 }}
              onMouseEnter={(e) => active && (e.currentTarget.style.background = TONE.well)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="flex-none" style={{ color: active ? TONE.dim : TONE.faint }}>
                <IntakeGlyph family={opt.family} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium" style={{ color: active ? TONE.cream : TONE.dim }}>
                  {opt.label}
                </span>
                <span className="mt-0.5 block text-[12px]" style={{ color: TONE.faint }}>
                  {opt.sub}
                </span>
              </span>
              {active ? (
                <span className="flex-none text-[15px]" style={{ color: TONE.faint }} aria-hidden>
                  →
                </span>
              ) : (
                <span className="flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]" style={{ background: "rgba(255,255,255,.05)", color: TONE.faint }}>
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
