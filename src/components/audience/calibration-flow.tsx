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
import type { RevealData, CalibrationEvidence } from "@/lib/audience/calibration";
import { formatCount } from "@/lib/account-metrics/account-metrics";
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
  const [evidence, setEvidence] = useState<CalibrationEvidence | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
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

          let parsed: {
            type?: string;
            message?: string;
            reason?: string;
            retry?: boolean;
            audience?: Audience;
            reveal?: RevealData;
          } & Partial<CalibrationEvidence>;
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
            case "evidence":
              // The account we actually pulled + the posts we are about to watch. Arrives
              // seconds in; the audience it produces takes ~2 more minutes.
              if (parsed.handle) {
                setEvidence({
                  handle: parsed.handle,
                  displayName: parsed.displayName ?? parsed.handle,
                  avatarUrl: parsed.avatarUrl ?? "",
                  followerCount: parsed.followerCount ?? 0,
                  videos: parsed.videos ?? [],
                });
              }
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

  // Streaming / progress state.
  //
  // Calibration runs ~2 minutes (the live @zachking run was 128s) and used to show a mark and
  // one line of text for ALL of it. But the scrape returns within seconds, holding the creator's
  // avatar, follower count and every video cover — the strongest available proof that the work is
  // real. So the moment it lands, the wait stops being a spinner and becomes the account itself,
  // with the posts we are about to watch appearing underneath it.
  if (phase === "streaming") {
    if (!evidence) {
      return (
        <div className={cn("flex flex-col items-center gap-4 py-12", className)}>
          <ConstellationMark width={72} className="opacity-80" />
          <p className="text-sm text-foreground-secondary text-center max-w-xs">
            {statusMsg}
          </p>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col gap-6 py-8", className)} data-testid="calibration-evidence">
        {/* The account we actually read. */}
        <div className={cn(READING_CARD, "flex items-center gap-3 px-4 py-3")}>
          {evidence.avatarUrl && !avatarFailed ? (
            // Ephemeral TikTok-CDN avatar — plain <img>, removes itself on error rather than
            // leaving a broken box. eslint-disable-next-line @next/next/no-img-element
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={evidence.avatarUrl}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full border border-white/[0.06] object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="h-11 w-11 shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-foreground">
              {evidence.displayName || `@${evidence.handle}`}
            </p>
            <p className="mt-0.5 text-[13px] text-foreground-muted">
              @{evidence.handle}
              {evidence.followerCount > 0 && ` · ${formatCount(evidence.followerCount)} followers`}
            </p>
          </div>
        </div>

        <p className="text-sm text-foreground-secondary" data-testid="calibration-status">
          {statusMsg}
        </p>

        {/* The posts we are about to watch. Only covers we actually have — a post with no cover
            keeps its slot and shows nothing, rather than rendering a broken image. */}
        {evidence.videos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="calibration-covers">
            {evidence.videos.slice(0, 12).map((v, i) => (
              <CalibrationCover key={i} coverUrl={v.coverUrl} index={i} />
            ))}
          </div>
        )}
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

/**
 * One scraped post, appearing while we watch it. Staggered so the grid fills in rather than
 * snapping in all at once — the posts really are read in order, and a wall of covers appearing
 * instantly reads as a mock-up, not as work.
 *
 * A post with no cover keeps its slot and shows nothing: we never paint a picture we don't have.
 */
function CalibrationCover({ coverUrl, index }: { coverUrl: string | null; index: number }) {
  const [failed, setFailed] = useState(false);
  const show = coverUrl && !failed;

  return (
    <div
      className="reading-reveal aspect-[9/16] overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.02]"
      style={{ animationDelay: `${index * 0.06}s` }}
      data-testid="calibration-cover"
    >
      {show && (
        // Ephemeral TikTok-CDN cover — plain <img>, decorative alt.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
