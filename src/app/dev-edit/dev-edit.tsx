"use client";

import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditPlayer } from "@/edit/player/EditPlayer";
import { CUT_KINDS, LOOK_IDS, applyOps, filmFrames, type Edit } from "@/lib/edit";

declare global {
  interface Window {
    /** The dev page's player, for a test or a person at the console to seek and play. */
    __editPlayer?: PlayerRef | null;
    /** Sends operations through the one door, as the agent will. True when they were taken. */
    __editApply?: (ops: unknown) => boolean;
  }
}

const CAPTION_LOOKS = ["pill", "pop", "highlight", "plain"] as const;
/** A button's look: outlined when it is the one chosen. */
const choice = (on: boolean): React.CSSProperties => ({ background: "#2a2a2a", color: "#eeeeee", border: 0, borderRadius: 6, padding: "6px 10px", fontSize: 13, outline: on ? "1px solid #eeeeee" : "none" });

/** The dev page's stage: the edit in a phone-size player, a few changes to send through the door, and what the edit is. Plain styles on purpose: this is a tool, not a screen of the product. */
export function DevEdit({ edit: first, urls, bare }: { edit: Edit; urls: Record<string, string>; bare: boolean }) {
  const player = useRef<PlayerRef>(null);
  const [edit, setEdit] = useState(first);
  const [refused, setRefused] = useState<string[]>([]);
  const [approximate, setApproximate] = useState(false);
  const onApproximateColour = useCallback(() => setApproximate(true), []);
  /** The shot whose cut the buttons change: the first with a transition, else the first. */
  const [cutId] = useState(() => (first.shots.find((shot, i) => i < first.shots.length - 1 && shot.out.kind !== "cut") ?? first.shots[0])?.id);

  const latest = useRef(edit);
  const apply = useCallback((ops: unknown) => {
    const result = applyOps(latest.current, ops, latest.current.assets);
    if (result.ok) {
      latest.current = result.edit;
      setEdit(result.edit);
    }
    setRefused(result.ok ? [] : result.problems.map((problem) => `${problem.path}: ${problem.message}`));
    return result.ok;
  }, []);

  useEffect(() => {
    window.__editPlayer = player.current;
    window.__editApply = apply;
    return () => {
      window.__editPlayer = null;
      delete window.__editApply;
    };
  }, [apply]);

  if (bare) {
    return (
      <div id="edit-stage" data-colour={approximate ? "approximate" : "exact"} data-frames={filmFrames(edit)} style={{ position: "fixed", left: 0, top: 0, width: edit.stage.w, height: edit.stage.h, zIndex: 2147483647, background: "#000000" }}>
        <EditPlayer ref={player} edit={edit} kit="/edit" urls={urls} controls={false} onApproximateColour={onApproximateColour} />
      </div>
    );
  }

  const cutAfter = edit.shots.find((shot) => shot.id === cutId);
  return (
    <main style={{ minHeight: "100vh", background: "#111111", color: "#eeeeee", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ width: "min(100%, 390px)", margin: "0 auto", display: "grid", gap: 12 }}>
        <div id="edit-stage" style={{ borderRadius: 12, overflow: "hidden" }}>
          <EditPlayer ref={player} edit={edit} kit="/edit" urls={urls} onApproximateColour={onApproximateColour} />
        </div>
        <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
          {edit.shots.length} shots, {filmFrames(edit)} frames, {(filmFrames(edit) / edit.stage.fps).toFixed(1)} s
        </p>
        {approximate ? <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>This browser cannot run the colour pass: the looks here are close, not exact.</p> : null}
        <Row label="Look">
          {LOOK_IDS.map((preset) => (
            <button key={preset} type="button" style={choice(edit.look.preset === preset)} onClick={() => apply([{ op: "look.set", preset }])}>
              {preset}
            </button>
          ))}
        </Row>
        <Row label="Captions">
          {CAPTION_LOOKS.map((look) => (
            <button key={look} type="button" style={choice(edit.captions.look === look)} onClick={() => apply([{ op: "captions.set", look }])}>
              {look}
            </button>
          ))}
        </Row>
        {cutAfter ? (
          <Row label={`Cut after ${cutAfter.id}`}>
            {CUT_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                style={choice(cutAfter.out.kind === kind)}
                onClick={() => apply([{ op: "shot.set", id: cutAfter.id, out: kind === "cut" ? { kind } : kind === "push" || kind === "wipe" ? { kind, frames: 10, from: "right" } : { kind, frames: 10 } }])}
              >
                {kind}
              </button>
            ))}
          </Row>
        ) : null}
        {refused.length > 0 ? <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", color: "#ffb4a8", margin: 0 }}>{refused.join("\n")}</pre> : null}
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 13, opacity: 0.7, width: "100%" }}>{label}</span>
      {children}
    </div>
  );
}
