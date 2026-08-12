"use client";

/**
 * SimulateIntake — the cold-start phase of surface ⑤ + the shared sheet chrome.
 *
 * When ⑤ is entered COLD (the ＋ "Test something of your own" door) there's no stimulus to develop
 * yet, so this module collects one before the run is armed — in TWO steps:
 *
 *   `IntakeStep`  — "What are you testing?", the doors.
 *   `CollectStep` — the actual bring-your-own input for the picked door (2026-07-28).
 *
 * ⚠️ That second step did not exist until 2026-07-28, and this docstring claimed the first one
 * collected a stimulus. It did not: there was not one `<input>` in the file, and cold entry armed
 * whatever text the CALLER was holding. The ＋ door could not be built on top of that.
 *
 * Rev B+ (2026-08-02): the doors are ONE flat list. They were grouped under SCREEN / COMPARE /
 * QUERY family kickers — our domain-scaffold vocabulary, printed as mono-uppercase headers, on the
 * first screen a creator meets after tapping ＋. The fork those kickers named is real and still
 * shapes the code (`IntakeOption.family`); it just isn't something the creator is choosing between.
 * Five doors on one list need no taxonomy above them.
 *
 * This is a LEAF module: it owns the shared sheet primitives (`SHEET_STYLE`, `CloseButton`) so the
 * gateway can import them here without a runtime import cycle (AmbientSimulate → SimulateIntake,
 * never the reverse; the type imports below are erased at compile).
 */

import { useCallback, useState } from "react";
import { VideoUpload } from "@/components/app/video-upload";
import { TIKTOK_URL_PATTERN } from "@/lib/tiktok-url";
import { TONE } from "./AmbientDetail";
import type { BroughtStimulus, IntakeOption, SimulateData } from "./AmbientSimulate";

// ── shared sheet chrome ────────────────────────────────────────────────────────

export const SHEET_STYLE: React.CSSProperties = {
  background: "#1f1f1e",
  border: `1px solid ${TONE.border}`,
  color: TONE.cream,
  fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
  boxShadow: "0 24px 64px rgba(0,0,0,.45)",
};

export function CloseButton({ onClose }: { onClose?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="-mr-1 flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] transition-colors"
      style={{ color: TONE.faint }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
      onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
    >
      ✕
    </button>
  );
}

/** The bare ‹ back arrow. Its label used to be the title of the step it returned to, printed
 *  beside the title of the step you were on — two headings, one screen. */
function BackButton({ onBack }: { onBack?: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back"
      className="-ml-1 flex-none pr-1 text-[14px] leading-none transition-colors"
      style={{ color: TONE.faint }}
      onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
      onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
    >
      ‹
    </button>
  );
}

/** The step's own header row: ‹ (optional) · title · ✕. */
function StepHead({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-[26px] pt-[22px]">
      {onBack ? <BackButton onBack={onBack} /> : null}
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</span>
      <CloseButton onClose={onClose} />
    </div>
  );
}

function SubLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[7px] px-[26px] text-[12px] leading-[1.5]" style={{ color: TONE.faint }}>
      {children}
    </div>
  );
}

/** The one action on a collect step — full width, cream, and inert until there is something to
 *  carry forward. Labelled "Continue →": "Arm the run →" was our word for the next screen. */
function ContinueButton({ ready, onClick }: { ready: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready}
      className="mt-3 w-full rounded-[10px] py-3 text-[14px] font-semibold transition-opacity"
      style={{
        background: ready ? TONE.cream : "rgba(255,255,255,.05)",
        color: ready ? "#1c1b19" : TONE.faint,
        cursor: ready ? "pointer" : "default",
      }}
    >
      Continue →
    </button>
  );
}

// ── the intake step ────────────────────────────────────────────────────────────

const GLYPH = {
  width: 15,
  height: 15,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * One glyph per DOOR, not per family.
 *
 * It was per-family, which meant the two live doors — "Test a real video" and "Screen a draft" —
 * carried the identical aperture mark, because both are `screen`. The only two things a creator
 * can actually pick looked like the same thing.
 */
function IntakeGlyph({ kind }: { kind: IntakeOption["kind"] }) {
  switch (kind) {
    case "video": // a filmstrip — the frames themselves
      return (
        <svg {...GLYPH} aria-hidden>
          <path d="M2.3 3.6 H13.7 V12.4 H2.3 Z M5.6 3.6 V12.4 M10.4 3.6 V12.4 M2.3 6.1 H4 M2.3 9.9 H4 M12 6.1 H13.7 M12 9.9 H13.7" />
        </svg>
      );
    case "draft": // written lines, put to the room
      return (
        <svg {...GLYPH} aria-hidden>
          <path d="M2.6 3.3 H13.4 V10.3 H7.3 L4.6 12.8 V10.3 H2.6 Z M5.1 5.9 H10.9 M5.1 8.1 H8.9" />
        </svg>
      );
    case "ab": // two panels, one winner
      return (
        <svg {...GLYPH} aria-hidden>
          <path d="M2.2 3.7 H6.8 V12.3 H2.2 Z M9.2 3.7 H13.8 V12.3 H9.2 Z M4.5 6.4 V9.6 M11.5 6.4 V9.6" />
        </svg>
      );
    case "ask": // a question put to the room
      return (
        <svg {...GLYPH} aria-hidden>
          <path d="M2.5 3.5 h11 v7 h-6 l-3 2.5 v-2.5 h-2 Z" />
        </svg>
      );
    case "survey": // structured answers, in rows
      return (
        <svg {...GLYPH} aria-hidden>
          <path d="M6 4 H13.4 M6 8 H13.4 M6 12 H13.4" />
          <circle cx="3" cy="4" r=".7" fill="currentColor" stroke="none" />
          <circle cx="3" cy="8" r=".7" fill="currentColor" stroke="none" />
          <circle cx="3" cy="12" r=".7" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function IntakeDoor({ opt, index, onPick }: { opt: IntakeOption; index: number; onPick: (o: IntakeOption) => void }) {
  const active = opt.status === "active";
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => active && onPick(opt)}
      style={{
        animationDelay: `${0.05 + index * 0.04}s`,
        cursor: active ? "pointer" : "default",
        background: active ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.02)",
        border: `1px solid ${TONE.border}`,
        opacity: active ? 1 : 0.45,
      }}
      className="group ambient-row-in flex w-full items-center gap-3 rounded-[12px] px-[13px] py-[11px] text-left transition-colors"
      onMouseEnter={(e) => {
        if (!active) return;
        e.currentTarget.style.background = "rgba(255,255,255,.045)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,.13)";
      }}
      onMouseLeave={(e) => {
        if (!active) return;
        e.currentTarget.style.background = "rgba(255,255,255,.02)";
        e.currentTarget.style.borderColor = TONE.border;
      }}
    >
      <span
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]"
        style={{ background: "#242422", border: "1px solid rgba(255,255,255,.08)", color: "rgba(236,231,222,.75)" }}
      >
        <IntakeGlyph kind={opt.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-[7px] text-[14px] font-medium leading-tight">
          {opt.label}
          {active ? null : (
            // an object tag, not a control — the one chip fill a dimmed door is allowed
            <span
              className="flex-none rounded-md px-[7px] py-1 text-[10px] leading-none"
              style={{ background: "#2b2a28", color: TONE.dim }}
            >
              soon
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[12px] leading-tight" style={{ color: TONE.faint }}>
          {opt.sub}
        </span>
      </span>
      {active ? (
        <span
          className="flex-none text-[13px] transition-transform group-hover:translate-x-0.5"
          style={{ color: TONE.faint }}
          aria-hidden
        >
          →
        </span>
      ) : null}
    </button>
  );
}

// ── the collect step ───────────────────────────────────────────────────────────

/**
 * COLLECT — the step that was missing, and the reason the ＋ door could not exist.
 *
 * Before 2026-07-28 picking a door went straight to the arm card and the stimulus was read off
 * the CALLER (`data.stimulus.text`), with only its `kind` swapped. There was not one `<input>`
 * in this whole file: "Screen a draft" armed a run against whatever text the host was holding.
 * So this step is the actual bring-your-own intake — a textarea for a draft, and for a video the
 * two ways in behind one door (a file, or a link).
 *
 * The file/link halves are the SHIPPED path, reused not rebuilt: `VideoUpload` (bare) is the
 * same drop zone `input-request-block` and the composer mount, and the link is validated with
 * `TIKTOK_URL_PATTERN` — the one regex the /api/analyze trust boundary uses, so a URL this step
 * accepts is a URL the server accepts (they drifted once, case-sensitivity, and the client
 * enabled a submit the server then 400'd).
 *
 * FILE AND LINK ARE EXCLUSIVE — they are two different `input_mode`s and a stimulus carrying
 * both has no honest answer. Three things enforce it, and they MASK each other: selecting a file
 * clears the url, the link field unmounts while a file is held, and `submit` reads the file
 * first. Mutation-tested 2026-07-28: breaking any ONE of the three leaves the tests green,
 * because either of the others still lands the file. That is redundancy, not three guards — the
 * test only catches the compound break. Worth knowing before trusting a green run here.
 *
 * Rev B+ restyled the chrome around it (title · sub · counter · Continue). The collect LOGIC is
 * behavioural and is untouched.
 */
const DRAFT_MAX = 2000;

export function CollectStep({
  data,
  opt,
  onClose,
  onBack,
  onCollect,
}: {
  data: SimulateData;
  opt: IntakeOption;
  onClose?: () => void;
  onBack?: () => void;
  onCollect: (brought: BroughtStimulus) => void;
}) {
  const isVideo = opt.stimulusKind === "video";
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  const trimmedUrl = url.trim();
  const trimmedDraft = draft.trim();
  const validUrl = trimmedUrl.length > 0 && TIKTOK_URL_PATTERN.test(trimmedUrl);
  const urlError = trimmedUrl.length > 0 && !validUrl;
  const ready = isVideo ? !!file || validUrl : trimmedDraft.length > 0;

  // One of the two, never both. This is one of THREE overlapping enforcements (see the module
  // note) — it is the one that matters if the link field is ever shown alongside a held file.
  const pickFile = useCallback((f: File | null) => {
    setFile(f);
    if (f) setUrl("");
  }, []);

  const submit = useCallback(() => {
    if (!ready) return;
    if (!isVideo) {
      onCollect({ kind: opt.stimulusKind ?? "draft", text: trimmedDraft });
      return;
    }
    // A video's `text` is its NAME, never a stimulus to feed a text run — the arm card prints it,
    // and Phase 4 routes the file/url to /api/analyze on the matching input_mode.
    if (file) onCollect({ kind: "video", text: file.name, file });
    else onCollect({ kind: "video", text: trimmedUrl, url: trimmedUrl });
  }, [ready, isVideo, opt.stimulusKind, trimmedDraft, file, trimmedUrl, onCollect]);

  return (
    <div
      data-testid="ambient-simulate"
      data-phase="collect"
      data-door={opt.kind}
      className="ambient-row-in flex w-full max-w-[460px] flex-col rounded-[16px]"
      style={SHEET_STYLE}
    >
      <StepHead title={isVideo ? "Bring the video" : "Paste the draft"} onBack={onBack} onClose={onClose} />
      <SubLine>
        {isVideo
          ? `Upload the file or paste the link — ${data.room.toLowerCase()} watches it end to end.`
          : "A hook, script, or caption — your audience reads it cold."}
      </SubLine>

      <div className="px-[26px] pb-[22px] pt-4">
        {isVideo ? (
          <div className="flex flex-col gap-3">
            <VideoUpload file={file} onFileSelect={pickFile} bare />
            {!file && (
              <>
                <div className="flex items-center gap-2 text-[12px]" style={{ color: TONE.faint }}>
                  <span className="h-px flex-1" style={{ background: TONE.hair }} />
                  or paste a link
                  <span className="h-px flex-1" style={{ background: TONE.hair }} />
                </div>
                <input
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="https://tiktok.com/…"
                  aria-label="Paste a TikTok link"
                  className="w-full rounded-[10px] px-3.5 py-[11px] text-[14px] outline-none transition-colors placeholder:text-[rgba(236,231,222,0.38)]"
                  style={{ background: "#1a1a19", border: `1px solid ${TONE.border}`, color: TONE.cream }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = TONE.border)}
                />
              </>
            )}
          </div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, DRAFT_MAX))}
              autoFocus
              placeholder="Three years of footage and nobody watched past the first second…"
              aria-label="Paste the draft to screen"
              className="block min-h-[132px] w-full resize-none rounded-[12px] px-3.5 py-[13px] text-[14px] leading-[1.5] outline-none transition-colors placeholder:text-[rgba(236,231,222,0.38)]"
              style={{ background: "#1a1a19", border: `1px solid ${TONE.border}`, color: TONE.cream }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.14)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = TONE.border)}
            />
            <div className="mt-2 text-right text-[11px] tabular-nums" style={{ color: TONE.faint }}>
              {trimmedDraft.length} / {DRAFT_MAX.toLocaleString("en-US")}
            </div>
          </>
        )}

        {urlError && !file ? (
          <div className="mt-3 text-[12px]" style={{ color: TONE.faint }}>
            That doesn&apos;t look like a TikTok video URL.
          </div>
        ) : null}

        <ContinueButton ready={ready} onClick={submit} />
      </div>
    </div>
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
    <div
      data-testid="ambient-simulate"
      data-phase="intake"
      className="ambient-row-in flex w-full max-w-[460px] flex-col rounded-[16px]"
      style={SHEET_STYLE}
    >
      <StepHead title="What are you testing?" onClose={onClose} />
      <SubLine>Pick what to put in front of {data.room.toLowerCase()}.</SubLine>

      {/* ONE flat list. The SCREEN / COMPARE / QUERY kickers that used to group these are gone —
          see the module note: the fork is real in the code and meaningless to the person picking. */}
      <div className="flex flex-col gap-2 px-[26px] pb-6 pt-4">
        {data.intake.map((opt, i) => (
          <IntakeDoor key={opt.kind} opt={opt} index={i} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
