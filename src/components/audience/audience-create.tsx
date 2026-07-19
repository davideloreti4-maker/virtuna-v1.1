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
import { formatCount } from "@/lib/account-metrics/account-metrics";
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
            case "evidence":
              if (parsed.handle) {
                setEvidence({
                  handle: parsed.handle,
                  displayName: parsed.displayName ?? parsed.handle,
                  avatarUrl: parsed.avatarUrl ?? "",
                  followerCount: parsed.followerCount ?? 0,
                  heartCount: parsed.heartCount ?? 0,
                  videoCount: parsed.videoCount ?? 0,
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

  // ── Streaming: the reveal (evidence the moment it exists, dot while building) ──
  if (phase === "streaming") {
    return (
      <div className={cn("flex flex-col gap-4", className)} data-testid="create-reveal">
        <div className="rounded-2xl bg-white/[0.02] p-5">
          {evidence ? (
            <>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                  @{evidence.handle}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
                  TikTok
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3" data-testid="reveal-figures">
                <RevealFigure n={evidence.videos.length} label="Videos" exact />
                <RevealFigure n={evidence.followerCount} label="Followers" />
                <RevealFigure n={evidence.heartCount} label="Likes" />
              </div>

              {evidence.videos.length > 0 && (
                <div className="mt-5 grid grid-cols-4 gap-1.5 sm:grid-cols-8" data-testid="reveal-strip">
                  {evidence.videos.slice(0, 8).map((v, i) => (
                    <RevealCover key={i} coverUrl={v.coverUrl} index={i} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground-secondary">{statusMsg}</p>
          )}

          <div className="mt-5 flex items-center gap-2" data-testid="create-building">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[color:var(--color-accent)]" />
            <span className="text-[13px] text-foreground-secondary">Building audience</span>
          </div>
        </div>
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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
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
                  "mt-1 block text-[13px] leading-normal transition-colors",
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
                      "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
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
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
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
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-[13px] text-foreground-muted">
            Analytics only.
          </p>
        )}

        {errorMsg && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-[13px] text-error" data-testid="create-error">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}

/** One reveal figure — big tabular-nums number, mono small-caps unit. */
function RevealFigure({ n, label, exact }: { n: number; label: string; exact?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[22px] font-semibold tabular-nums tracking-[-0.01em] text-foreground">
        {exact ? n : formatCount(n)}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
        {label}
      </span>
    </div>
  );
}

/** One scraped cover — keeps its slot blank when TikTok's ephemeral CDN URL dies. */
function RevealCover({ coverUrl, index }: { coverUrl: string | null; index: number }) {
  const [failed, setFailed] = useState(false);
  const show = coverUrl && !failed;
  return (
    <div
      className="reading-reveal aspect-[9/16] overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.02]"
      style={{ animationDelay: `${index * 0.06}s` }}
      data-testid="reveal-cover"
    >
      {show && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
