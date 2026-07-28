"use client";

/**
 * SimulateIntake — the cold-start phase of surface ⑤ + the shared sheet chrome.
 *
 * When ⑤ is entered COLD (the ④ "Test something against your audience →" door) there's no stimulus
 * to develop yet, so this module collects one before the run is armed — in TWO steps:
 *
 *   `IntakeStep`  — "What are you testing?", the doors. Each names the SCREEN vs QUERY fork
 *                   (domain-scaffold): video / draft = *screen*, ask / survey = *query*,
 *                   A/B = *compare*. Scope 2026-07-21: screen doors are active; compare + query
 *                   are shown but deferred ("soon") until their arms/outputs get read-templates.
 *   `CollectStep` — the actual bring-your-own input for the picked door (2026-07-28).
 *
 * ⚠️ That second step did not exist until 2026-07-28, and this docstring claimed the first one
 * collected a stimulus. It did not: there was not one `<input>` in the file, and cold entry armed
 * whatever text the CALLER was holding. The ＋ door could not be built on top of that.
 *
 * This is a LEAF module: it owns the shared sheet primitives (`SHEET_STYLE`, `Kick`, `CloseButton`)
 * so the gateway can import them here without a runtime import cycle (AmbientSimulate → SimulateIntake,
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

/** The three intake families, in order — each a small verb the user is choosing between. */
const FAMILY_ORDER: { key: IntakeOption["family"]; label: string; hint: string }[] = [
  { key: "screen", label: "Screen", hint: "put a real thing in front of the room" },
  { key: "compare", label: "Compare", hint: "run variants side by side" },
  { key: "query", label: "Query", hint: "ask the room directly" },
];

function IntakeTile({ opt, index, onPick }: { opt: IntakeOption; index: number; onPick: (o: IntakeOption) => void }) {
  const active = opt.status === "active";
  return (
    <button
      type="button"
      disabled={!active}
      onClick={() => active && onPick(opt)}
      style={{ animationDelay: `${0.05 + index * 0.04}s`, cursor: active ? "pointer" : "default" }}
      className={`group ambient-row-in flex w-full items-center gap-3 rounded-[12px] border p-3 text-left transition-colors ${
        active
          ? "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.13)] hover:bg-[rgba(255,255,255,0.045)]"
          : "border-[rgba(255,255,255,0.05)] bg-transparent opacity-55"
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#2a2a28] transition-colors ${
          active ? "text-[rgba(236,231,222,0.5)] group-hover:text-[#ece7de]" : "text-[rgba(236,231,222,0.3)]"
        }`}
      >
        <IntakeGlyph family={opt.family} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[14px] font-medium leading-tight transition-colors ${
            active ? "text-[rgba(236,231,222,0.82)] group-hover:text-[#ece7de]" : "text-[rgba(236,231,222,0.55)]"
          }`}
        >
          {opt.label}
        </span>
        <span className="mt-0.5 block text-[12px] leading-tight" style={{ color: TONE.faint }}>
          {opt.sub}
        </span>
      </span>
      {active ? (
        <span
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] transition-all group-hover:translate-x-0.5"
          style={{ color: TONE.faint }}
          aria-hidden
        >
          →
        </span>
      ) : (
        <span
          className="flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]"
          style={{ background: "rgba(255,255,255,.05)", color: TONE.faint }}
        >
          soon
        </span>
      )}
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
      <div className="px-[26px] pt-[24px]">
        <div className="flex items-start justify-between">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.08em] transition-colors"
            style={{ color: TONE.faint }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TONE.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TONE.faint)}
          >
            ‹ What are you testing?
          </button>
          <CloseButton onClose={onClose} />
        </div>
        <div className="mt-2.5 text-[17px] font-medium" style={{ color: TONE.cream }}>
          {isVideo ? "Bring the video" : "Paste the draft"}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: TONE.faint }}>
          {isVideo
            ? `Upload the file or paste the link — ${data.room.toLowerCase()} watches it end to end.`
            : `The hook, script, or caption you're weighing. ${data.room} reads it cold.`}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 px-[26px] pb-[22px]">
        {isVideo ? (
          <>
            <VideoUpload file={file} onFileSelect={pickFile} bare />
            {!file && (
              <>
                <div
                  className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em]"
                  style={{ color: TONE.faint }}
                >
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
                  className="w-full rounded-[10px] px-3 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[rgba(236,231,222,0.35)]"
                  style={{ background: TONE.well, border: `1px solid ${TONE.border}`, color: TONE.cream }}
                />
              </>
            )}
          </>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, DRAFT_MAX))}
              rows={5}
              autoFocus
              placeholder="Three years of footage and nobody watched past the first second…"
              aria-label="Paste the draft to screen"
              className="w-full resize-none rounded-[10px] px-3 py-2.5 text-[14px] leading-[1.5] outline-none transition-colors placeholder:text-[rgba(236,231,222,0.35)]"
              style={{ background: TONE.well, border: `1px solid ${TONE.border}`, color: TONE.cream }}
            />
            <div className="flex justify-end text-[11px] font-mono" style={{ color: TONE.faint }}>
              {trimmedDraft.length}/{DRAFT_MAX}
            </div>
          </>
        )}

        {urlError && !file ? (
          <div className="text-[12px]" style={{ color: TONE.faint }}>
            That doesn&apos;t look like a TikTok video URL.
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="mt-1 self-end rounded-[10px] px-4 py-2 text-[13px] font-medium transition-colors"
          style={{
            background: ready ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.03)",
            border: `1px solid ${ready ? "rgba(255,255,255,.14)" : TONE.hair}`,
            color: ready ? TONE.cream : TONE.faint,
            cursor: ready ? "pointer" : "default",
          }}
        >
          Arm the run →
        </button>
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
  let flat = 0; // running index → the entrance stagger reads across the whole set
  return (
    <div data-testid="ambient-simulate" data-phase="intake" className="ambient-row-in flex w-full max-w-[460px] flex-col rounded-[16px]" style={SHEET_STYLE}>
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

      <div className="mt-5 flex flex-col gap-5 px-[22px] pb-[20px]">
        {FAMILY_ORDER.map(({ key, label, hint }) => {
          const opts = data.intake.filter((o) => o.family === key);
          if (opts.length === 0) return null;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between px-1">
                <span className="font-mono text-[11px] uppercase tracking-[0.09em]" style={{ color: TONE.faint }}>
                  {label}
                </span>
                <span className="text-[11px]" style={{ color: TONE.faint }}>
                  {hint}
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {opts.map((opt) => (
                  <IntakeTile key={opt.kind} opt={opt} index={flat++} onPick={onPick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
