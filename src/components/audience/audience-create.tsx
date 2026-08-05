"use client";

/**
 * AudienceCreate — the /audience/new three-door create flow (P4, sketch §2).
 *
 * Doors (the two things a user owns + the described path):
 *   connect  — your own account. TikTok runs the ONE-scrape calibrate pipeline
 *              (bundle → audience + account + posts archive, server-side);
 *              Instagram/YouTube connect analytics only (honest: no calibration).
 *   handle   — any public creator → a SIMULATED audience (no connected account).
 *   describe — a written target audience (niche path). Growth/Conversion templates
 *              prefill the description and carry their goal intent.
 *
 * Name is auto-derived (@handle, or the description's first words) — goal/intent
 * stay editable post-create on the detail page. Facts only, no narration (the
 * anti-slop rules); the ONE accent element is the liveness dot while building.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CalibrationEvidence } from "@/lib/audience/calibration";
import type { Audience } from "@/lib/audience/audience-types";
import { calibrationVocabulary } from "@/lib/audience/calibration-stages";
import type { StageState } from "@/components/thread/progress-checklist";
import { CalibrationProgress } from "./calibration-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CreateDoor = "connect" | "handle" | "describe";

const DOORS: Array<{ key: CreateDoor; title: string; line: string }> = [
  { key: "connect", title: "Connect account", line: "Built from your own content." },
  { key: "handle", title: "From a handle", line: "Any public creator." },
  { key: "describe", title: "From a description", line: "Define a target audience." },
];

/** The dead preset rows, reborn as describe-door templates (concept lock). */
const TEMPLATES = [
  {
    key: "grow" as const,
    label: "Growth",
    text: "Viewers outside my following — discovery-mode scrollers deciding in the first seconds whether to stay.",
  },
  {
    key: "sell" as const,
    label: "Conversion",
    text: "Warm followers who already trust me — deciding whether to buy, book, or sign up.",
  },
];

const CONNECT_PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

/** Auto-derive the row name from a description — first words, one line. */
export function nameFromDescription(description: string): string {
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Described audience";
  if (trimmed.length <= 60) return trimmed;
  const cut = trimmed.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
}

interface AudienceCreateProps {
  /** Preselect a door (?door= deep-link; connect dialog lands on "connect"). */
  initialDoor?: CreateDoor;
  /** Prefill the @handle (connect-flow deep-link). */
  prefillHandle?: string;
  className?: string;
}

type Phase = "form" | "streaming" | "fallback";

export function AudienceCreate({ initialDoor, prefillHandle, className }: AudienceCreateProps) {
  const router = useRouter();

  const [door, setDoor] = useState<CreateDoor>(initialDoor ?? "connect");
  const [handle, setHandle] = useState(prefillHandle ?? "");
  const [platform, setPlatform] = useState("tiktok");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<"grow" | "sell" | null>(null);

  const [phase, setPhase] = useState<Phase>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [evidence, setEvidence] = useState<CalibrationEvidence | null>(null);
  const [stages, setStages] = useState<StageState[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [fallbackMsg, setFallbackMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The done navigation races the unmount — track to avoid setState after leave.
  const leftRef = useRef(false);
  useEffect(() => () => void (leftRef.current = true), []);

  const cleanHandle = handle.replace(/^@/, "").trim();
  const canContinue =
    door === "describe" ? description.trim().length > 0 : cleanHandle.length > 0;

  function pickDoor(next: CreateDoor) {
    setDoor(next);
    setErrorMsg("");
    if (next !== "connect") setPlatform("tiktok");
  }

  function applyTemplate(key: "grow" | "sell") {
    const t = TEMPLATES.find((t) => t.key === key)!;
    setTemplate(key);
    setDescription(t.text);
  }

  // ── Instagram / YouTube: analytics-only connect (no calibration — honest) ──
  async function connectAnalyticsOnly() {
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/connected-accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle: cleanHandle }),
      });
      if (!res.ok) {
        setErrorMsg("Account not found. Check the handle — private accounts can't be read.");
        return;
      }
      const data = (await res.json()) as { account: { id: string } };
      // /audience/[id] canonicalizes an account id → analytics-only variant.
      router.push(`/audience/${data.account.id}`);
    } catch {
      setErrorMsg("Account not found. Check the handle — private accounts can't be read.");
    } finally {
      if (!leftRef.current) setSubmitting(false);
    }
  }

  // ── TikTok doors: the SSE calibrate pipeline (one scrape server-side) ──
  async function startCalibration() {
    setSubmitting(true);
    setErrorMsg("");
    setEvidence(null);
    // A retry must not inherit the previous attempt's spine, or the new run opens with steps
    // already marked done.
    setStages([]);
    setPhase("streaming");
    setStatusMsg(door === "describe" ? "Reading your description…" : "Reading the account…");

    const body =
      door === "describe"
        ? {
            description: description.trim(),
            type: "target",
            platform: "custom",
            goalIntent: template ?? "grow",
            name: nameFromDescription(description),
          }
        : {
            handle: cleanHandle,
            type: door === "connect" ? "personal" : "target",
            platform: "tiktok",
            goalIntent: "grow",
            name: `@${cleanHandle}`,
          };

    try {
      const res = await fetch("/api/audiences/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        failBack();
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let currentEvent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let parsed: {
            message?: string;
            audience?: Audience;
            name?: string;
            status?: StageState["status"];
          } & Partial<CalibrationEvidence>;
          try {
            parsed = JSON.parse(raw) as typeof parsed;
          } catch {
            continue;
          }
          const evt = currentEvent;
          currentEvent = "";

          switch (evt) {
            case "status":
              setStatusMsg(parsed.message ?? "");
              break;
            case "stage":
              // The route has emitted these since 2026-08-02 and this client dropped every one
              // of them, so /audience/new sat on a pulsing dot for ~2 minutes while /welcome —
              // the SAME pipeline — drew the progress spine. Last-write-wins per name, order
              // preserved: a repeated frame cannot duplicate a row, and a `done` cannot be
              // overwritten by a stale `active`.
              if (parsed.name && parsed.status) {
                const { name, status } = parsed;
                setStages((prev) => {
                  const i = prev.findIndex((s) => s.name === name);
                  if (i === -1) return [...prev, { name, status }];
                  const next = [...prev];
                  next[i] = { name, status };
                  return next;
                });
              }
              break;
            case "evidence":
              if (parsed.handle) {
                setEvidence({
                  handle: parsed.handle,
                  displayName: parsed.displayName ?? parsed.handle,
                  avatarUrl: parsed.avatarUrl ?? "",
                  followerCount: parsed.followerCount ?? 0,
                  heartCount: parsed.heartCount ?? 0,
                  videoCount: parsed.videoCount ?? 0,
                  verified: parsed.verified,
                  videos: parsed.videos ?? [],
                });
              }
              break;
            case "fallback":
              setPhase("fallback");
              setFallbackMsg(parsed.message ?? "");
              return;
            case "error":
              failBack();
              return;
            case "done":
              if (parsed.audience) {
                // The detail page IS the reveal — who's in the room.
                router.push(`/audience/${parsed.audience.id}`);
              }
              return;
          }
        }
      }
    } catch {
      failBack();
    } finally {
      if (!leftRef.current) setSubmitting(false);
    }
  }

  function failBack() {
    if (leftRef.current) return;
    setPhase("form");
    setSubmitting(false);
    setErrorMsg(
      door === "describe"
        ? "Couldn't build from that description. Try again."
        : "Account not found. Check the handle — private accounts can't be read.",
    );
  }

  function submit() {
    if (!canContinue || submitting) return;
    if (door === "connect" && platform !== "tiktok") {
      void connectAnalyticsOnly();
    } else {
      void startCalibration();
    }
  }

  // ── Fallback (thin data) — warning-toned, never fabricated ──
  if (phase === "fallback") {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className="rounded-2xl bg-white/[0.02] p-5">
          <p className="text-sm font-medium" style={{ color: "var(--color-warning)" }}>
            {"Couldn't read enough yet"}
          </p>
          <p className="mt-1 text-sm text-foreground-secondary">
            {fallbackMsg || "Not enough public activity to build from. New threads use General."}
          </p>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={() => router.push("/audience")}>
            Continue with General
          </Button>
        </div>
      </div>
    );
  }

  // ── Streaming: the account itself, with the real pipeline running through it ──
  //
  // `hasHandle` is the discriminator calibrationVocabulary documents — NOT the audience type.
  // The "From a handle" door builds a TARGET audience from a real account, and that run really
  // is reading an account, so it takes the account vocabulary. Only the describe door has no
  // handle behind it.
  if (phase === "streaming") {
    const { plan } = calibrationVocabulary(door !== "describe");
    return (
      <div className={cn("flex flex-col gap-4", className)} data-testid="create-reveal">
        <CalibrationProgress
          evidence={evidence}
          stages={stages}
          plan={plan}
          statusMsg={statusMsg}
          testId="create-building"
        />
      </div>
    );
  }

  // ── Form: doors + the active door's step zone ──
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Audience source">
        {DOORS.map((d) => {
          const on = door === d.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => pickDoor(d.key)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]",
                on
                  ? "border-white/[0.14] bg-white/[0.04]"
                  : "border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]",
              )}
            >
              <span
                className={cn(
                  "block text-sm font-semibold tracking-[-0.005em] transition-colors",
                  on ? "text-foreground" : "text-foreground-secondary",
                )}
              >
                {d.title}
              </span>
              <span
                className={cn(
                  "mt-1 block text-body leading-normal transition-colors",
                  on ? "text-foreground-secondary" : "text-foreground-muted",
                )}
              >
                {d.line}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-white/[0.02] p-4">
        {door === "describe" ? (
          <>
            <textarea
              aria-label="Describe the audience"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setTemplate(null);
              }}
              placeholder="Who are they, and what makes them stop scrolling?"
              rows={3}
              className={cn(
                "w-full resize-none rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm text-foreground",
                "placeholder:text-foreground-muted/60",
                "focus:outline-none",
              )}
              maxLength={500}
            />
            <div className="mt-3 flex items-center gap-2">
              <div className="flex gap-1.5" role="group" aria-label="Templates">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={template === t.key}
                    onClick={() => applyTemplate(t.key)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-label font-medium transition-colors",
                      template === t.key
                        ? "border-border-hover bg-white/[0.04] text-foreground"
                        : "border-white/[0.06] text-foreground-secondary hover:border-white/[0.1] hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="primary"
                className="ml-auto"
                disabled={!canContinue || submitting}
                onClick={submit}
              >
                Continue
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Input
              aria-label={door === "connect" ? "Your @handle" : "Creator @handle"}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
              className={cn("flex-1", errorMsg && "border-error/40")}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            {door === "connect" ? (
              <Select
                options={CONNECT_PLATFORMS}
                value={platform}
                onChange={setPlatform}
                placeholder="Platform"
                className="w-36"
              />
            ) : (
              <span className="font-mono text-micro uppercase tracking-[0.08em] text-foreground-muted">
                TikTok
              </span>
            )}
            <Button
              type="button"
              variant="primary"
              disabled={!canContinue || submitting}
              onClick={submit}
            >
              Continue
            </Button>
          </div>
        )}

        {door === "connect" && platform !== "tiktok" && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-body text-foreground-muted">
            Analytics only.
          </p>
        )}

        {errorMsg && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-body text-error" data-testid="create-error">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}

// RevealFigure / RevealCover lived here and are gone: both are now CalibrationProgress's job,
// shared with /welcome. RevealFigure is the one that rendered `videos.length` as "Videos" —
// the scraped window sold as the account's catalogue.
