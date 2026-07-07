"use client";

/**
 * CalibrationFlow — SSE calibration UX.
 * Personal path: @handle input → POST /api/audiences/calibrate (SSE).
 * Target path: describe textarea → POST /api/audiences/calibrate (SSE).
 *
 * SSE events: status / fallback / error / done (07-03 contract).
 * Honesty spine: fallback = warning-toned notice, NEVER fabricates personas.
 * On done → calls onDone(audience).
 */

import { useState, useRef } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import type { RevealData } from "@/lib/audience/calibration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AudienceReveal } from "./audience-reveal";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import { READING_CARD } from "@/components/reading/reading-section";
import { cn } from "@/lib/utils";
import { WarningCircle } from "@phosphor-icons/react";

interface CalibrationFlowProps {
  audience: Audience;
  onDone: (calibrated: Audience) => void;
  /** Called when the creator chooses to skip calibration and use General. */
  onSkip: () => void;
  /** Prefill the @handle (from the "Calibrate from" source picker / connect deep-link). */
  prefillHandle?: string;
  /** Platform to calibrate against, overriding the audience's (source-picker selection). */
  prefillPlatform?: Audience["platform"];
  className?: string;
}

type Phase =
  | "idle"
  | "streaming"
  | "fallback"
  | "error"
  | "done";

export function CalibrationFlow({ audience, onDone, onSkip, prefillHandle, prefillPlatform, className }: CalibrationFlowProps) {
  const isPersonal = audience.type === "personal";

  const [handle, setHandle] = useState(prefillHandle ?? "");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [fallbackMsg, setFallbackMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [calibratedAudience, setCalibratedAudience] = useState<Audience | null>(null);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);

  async function startCalibration() {
    setPhase("streaming");
    setStatusMsg(isPersonal ? "Reading your followers…" : "Analysing your description…");
    setFallbackMsg("");
    setErrorMsg("");

    const body = isPersonal
      ? {
          handle: handle.replace(/^@/, ""),
          type: "personal",
          platform: prefillPlatform ?? audience.platform,
          goalIntent: audience.goal_intent ?? "grow",
          name: audience.name,
        }
      : {
          description: description.trim(),
          type: "target",
          platform: prefillPlatform ?? audience.platform,
          goalIntent: audience.goal_intent ?? "grow",
          name: audience.name,
        };

    try {
      const res = await fetch("/api/audiences/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, audienceId: audience.id }),
      });

      if (!res.ok || !res.body) {
        setPhase("error");
        setErrorMsg("Calibration failed. Check the handle and try again.");
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      readerRef.current = reader;

      let buffer = "";
      // Track the SSE event name from `event:` lines — the route emits proper
      // `event: <name>\ndata: <json>` frames (it does NOT put a `type` field in data),
      // so the event name MUST come from the event line (was the stuck-on-streaming bug).
      let currentEvent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;

        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          let parsed: { type?: string; message?: string; reason?: string; retry?: boolean; audience?: Audience; reveal?: RevealData };
          try {
            parsed = JSON.parse(raw) as typeof parsed;
          } catch {
            continue;
          }

          // Tolerate both: prefer the SSE event name, fall back to a `type` field.
          const evt = currentEvent || parsed.type;
          currentEvent = ""; // consumed

          switch (evt) {
            case "status":
              setStatusMsg(parsed.message ?? "");
              break;
            case "fallback":
              setPhase("fallback");
              setFallbackMsg(parsed.message ?? "");
              return;
            case "error":
              setPhase("error");
              setErrorMsg(parsed.message ?? "Calibration failed. Check the handle and try again.");
              return;
            case "done":
              if (parsed.audience) {
                // Show the reveal showcase (§P.5) and WAIT — onDone (which navigates
                // away) fires only when the user confirms via "Use this audience".
                setCalibratedAudience(parsed.audience);
                setRevealData(parsed.reveal ?? null);
                setPhase("done");
              }
              return;
          }
        }
      }
    } catch {
      setPhase("error");
      setErrorMsg("Calibration failed. Check the handle and try again.");
    }
  }

  // Idle / form state
  if (phase === "idle") {
    return (
      <div className={cn("flex flex-col gap-6", className)}>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Calibrate audience</h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            {isPersonal
              ? "Maven reads your public follower data to shape who reacts in your Reads."
              : "Describe your target audience so Maven can build who reacts in your Reads."}
          </p>
        </div>

        {isPersonal ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-foreground-secondary" htmlFor="cal-handle">
              Your @handle
            </label>
            <Input
              id="cal-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@yourhandle"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-foreground-secondary" htmlFor="cal-desc">
              Describe your audience
            </label>
            <textarea
              id="cal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Small business owners aged 25–45 interested in productivity tools…"
              rows={4}
              className={cn(
                "w-full rounded-lg border border-white/[0.05] bg-white/[0.05] px-3 py-2.5 text-sm text-foreground",
                "placeholder:text-foreground-muted/60 resize-none",
                "focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/[0.1]",
              )}
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onSkip}>
            Skip — use General
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void startCalibration()}
            disabled={isPersonal ? !handle.trim() : !description.trim()}
          >
            Calibrate audience
          </Button>
        </div>
      </div>
    );
  }

  // Streaming / progress state
  if (phase === "streaming") {
    return (
      <div className={cn("flex flex-col items-center gap-4 py-12", className)}>
        <ConstellationMark width={72} className="opacity-80" />
        <p className="text-sm text-foreground-secondary text-center max-w-xs">
          {statusMsg}
        </p>
      </div>
    );
  }

  // Fallback: thin data — warning-toned, NEVER error/coral, NEVER fabricated (D-06)
  if (phase === "fallback") {
    const handleForMsg = isPersonal ? `@${handle.replace(/^@/, "")}` : audience.name;
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className={cn(READING_CARD, "border-warning/20 bg-warning/5 px-5 py-4 flex gap-3")}>
          <WarningCircle
            weight="fill"
            className="shrink-0 w-5 h-5 mt-0.5"
            style={{ color: "var(--color-warning)" }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--color-warning)" }}>
              {"Couldn't read enough yet"}
            </p>
            <p className="text-sm text-foreground-secondary mt-1">
              {fallbackMsg ||
                `We couldn't read enough from ${handleForMsg} to calibrate a personal audience, so Maven is using General for now. Try again when your account has more public activity.`}
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={onSkip}>
            Continue with General
          </Button>
        </div>
      </div>
    );
  }

  // Error: scrape/network failure — distinct from fallback
  if (phase === "error") {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className={cn(READING_CARD, "border-error/20 bg-error/5 px-5 py-4")}>
          <p className="text-sm font-semibold text-error">Calibration failed</p>
          <p className="text-sm text-foreground-secondary mt-1">
            {errorMsg}
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onSkip}>
            Use General instead
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setPhase("idle");
              setErrorMsg("");
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Done: the "it's real" reveal showcase (§P.5) — real account + derived audience.
  if (phase === "done" && calibratedAudience) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <AudienceReveal
          audience={calibratedAudience}
          reveal={revealData}
          onUse={() => onDone(calibratedAudience)}
        />
      </div>
    );
  }

  return null;
}
