"use client";

/**
 * AudienceForm — create / edit audience.
 * Full-page form (not a modal) — mobile-first.
 * Fields: name, type (personal/target), platform, goal_label, goal_intent (dropdown).
 * No persona-edit affordances (D-03).
 * On create + type=personal, mounts CalibrationFlow after save.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Audience,
  AudiencePlatform,
  AudienceType,
  CustomContext,
  GoalIntent,
} from "@/lib/audience/audience-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { CalibrationFlow } from "./calibration-flow";
import type { AccountOption } from "./audience-manager";
import { cn } from "@/lib/utils";

const ACCOUNT_PLATFORM_LABEL: Record<AccountOption["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

// Only the platforms an audience can HONESTLY be calibrated from.
//
// Instagram + YouTube were offered here, and picking one silently ran a TIKTOK scrape: the whole
// calibration stack (scrapeProfileBundle / the niche discover actor) is TikTok-only and takes no
// platform. The resulting audience was built from TikTok, stamped `instagram`, and — because a
// handle is not one identity across platforms — could be a COMPLETE STRANGER'S audience presented
// as the user's own. The server now refuses these (calibration.ts PLATFORM guard); this list stops
// us offering the user a choice the engine cannot keep.
//
// Instagram/YouTube remain fully supported for CONNECT → analytics, which is a different flow
// (/api/connected-accounts/connect) and genuinely branches per platform. Restore an option here
// only when calibration can actually scrape that platform's VIDEOS (profile-only is not enough —
// enrichment needs videos).
const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "custom", label: "Custom" },
];

const GOAL_INTENT_OPTIONS = [
  { value: "grow", label: "Grow my following" },
  { value: "sell", label: "Drive sales & conversions" },
  { value: "authority", label: "Build authority & trust" },
  { value: "nurture", label: "Nurture existing fans" },
];

interface AudienceFormProps {
  /** Existing audience for edit mode. Undefined = create mode. */
  existing?: Audience;
  /**
   * Preset the create `mode` (07-05 / D-08). `/audience/new?mode=general` passes
   * "general" so the description Build path lands a General SIM in the library.
   * Absent ⇒ "socials" (the DB default) — the Socials form stays byte-identical
   * (no visible control is added for this).
   */
  initialMode?: Audience["mode"];
  /** The user's connected accounts — the "Calibrate from" source picker (personal type). */
  accounts?: AccountOption[];
  /** Deep-link preselection from the connect flow — jumps straight to a personal calibration. */
  preselect?: { accountId: string; handle?: string; platform?: string };
  className?: string;
}

export function AudienceForm({ existing, initialMode, accounts = [], preselect, className }: AudienceFormProps) {
  const router = useRouter();
  const isEdit = !!existing;

  const preselectedAccount = preselect
    ? accounts.find((a) => a.id === preselect.accountId)
    : undefined;

  const [name, setName] = useState(
    existing?.name ?? (preselectedAccount ? `@${preselectedAccount.handle}` : ""),
  );
  const [type, setType] = useState<AudienceType>(existing?.type ?? "personal");
  const [platform, setPlatform] = useState<AudiencePlatform>(
    existing?.platform ?? (preselectedAccount?.platform as AudiencePlatform) ?? "tiktok",
  );
  // "Calibrate from" source: a connected account's handle prefills the calibration step.
  // null = "A new @handle" (manual entry). Seeded from a connect-flow deep-link.
  const [sourceHandle, setSourceHandle] = useState<string | null>(
    preselectedAccount?.handle ?? preselect?.handle ?? null,
  );
  const [goalLabel, setGoalLabel] = useState(existing?.goal_label ?? "");
  const [goalIntent, setGoalIntent] = useState<GoalIntent | "">(existing?.goal_intent ?? "");
  // Audience axis (D-04). No visible control — preset by the page from ?mode (D-08).
  const [mode] = useState<Audience["mode"]>(initialMode ?? existing?.mode ?? "socials");
  // POP-05 — editable "what good means" free-text.
  const [successCriterion, setSuccessCriterion] = useState(existing?.success_criterion ?? "");
  // POP-02/TRUST-02/D-07 — user-added grounding (distinct from scrape-derived evidence).
  const [customContext, setCustomContext] = useState<CustomContext[]>(existing?.custom_context ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After successful create, the savedAudience drives the calibration flow
  const [savedAudience, setSavedAudience] = useState<Audience | null>(null);

  // If calibration is complete, the calibrated version replaces savedAudience
  const [calibrated, setCalibrated] = useState<Audience | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        type,
        mode,
        platform,
        goal_label: goalLabel.trim() || null,
        goal_intent: goalIntent || null,
        success_criterion: successCriterion.trim() || null,
        // Drop empty notes — only persist grounding the user actually wrote.
        custom_context: customContext.filter((c) => c.note.trim().length > 0),
      };

      let res: Response;
      if (isEdit && existing) {
        res = await fetch(`/api/audiences/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/audiences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Something went wrong.");
        return;
      }

      const data = await res.json() as { audience: Audience };

      if (isEdit) {
        // Edit: navigate back to the profile view
        router.push(`/audience/${data.audience.id}`);
      } else {
        // Create: check if calibration is needed
        if (type === "personal" || type === "target") {
          // Mount the calibration flow
          setSavedAudience(data.audience);
        } else {
          router.push("/audience");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // After calibration done — transition to profile view
  function handleCalibrationDone(audience: Audience) {
    setCalibrated(audience);
    router.push(`/audience/${audience.id}`);
  }

  function handleCalibrationSkip() {
    if (savedAudience) {
      router.push(`/audience/${savedAudience.id}`);
    } else {
      router.push("/audience");
    }
  }

  // ─── User-added grounding (custom_context) editor ────────────────────────────

  function addCustomContext() {
    setCustomContext((prev) => [...prev, { source: "user", note: "" }]);
  }

  function updateCustomContextNote(index: number, note: string) {
    setCustomContext((prev) =>
      prev.map((c, i) => (i === index ? { ...c, note } : c)),
    );
  }

  function removeCustomContext(index: number) {
    setCustomContext((prev) => prev.filter((_, i) => i !== index));
  }

  // Show calibration flow after audience created
  if (savedAudience && !calibrated) {
    return (
      <CalibrationFlow
        audience={savedAudience}
        onDone={handleCalibrationDone}
        onSkip={handleCalibrationSkip}
        prefillHandle={sourceHandle ?? undefined}
        prefillPlatform={platform}
        className={className}
      />
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={cn("flex flex-col gap-6", className)}>
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground-secondary" htmlFor="aud-name">
          Audience name
        </label>
        <Input
          id="aud-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My TikTok audience"
          required
          maxLength={80}
        />
      </div>

      {/* Type segmented */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-foreground-secondary">Type</span>
        <div
          className="flex gap-2"
          role="group"
          aria-label="Audience type"
        >
          {(["personal", "target"] as AudienceType[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10",
                type === t
                  ? "border-border-hover bg-hover text-foreground"
                  : "border-white/[0.06] text-foreground-secondary hover:border-white/[0.1] hover:bg-white/[0.03] hover:text-foreground",
              )}
            >
              {t === "personal" ? "Personal" : "Target"}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground-muted">
          {type === "personal"
            ? "Calibrate from your own @handle."
            : "Describe a target audience by demographics or behavior."}
        </p>
      </div>

      {/* Calibrate from — pick a connected account (prefills its handle + platform) or a new
          @handle. Only for personal audiences with at least one connected account. */}
      {type === "personal" && accounts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-foreground-secondary">Calibrate from</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Calibration source">
            {accounts.map((a) => {
              const active = sourceHandle === a.handle;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSourceHandle(a.handle);
                    setPlatform(a.platform as AudiencePlatform);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-border-hover bg-hover text-foreground"
                      : "border-white/[0.06] text-foreground-secondary hover:border-white/[0.1] hover:bg-white/[0.03] hover:text-foreground",
                  )}
                >
                  @{a.handle}
                  <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.06em] opacity-70">
                    {ACCOUNT_PLATFORM_LABEL[a.platform]}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={sourceHandle === null}
              onClick={() => setSourceHandle(null)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                sourceHandle === null
                  ? "border-border-hover bg-hover text-foreground"
                  : "border-white/[0.06] text-foreground-secondary hover:border-white/[0.1] hover:bg-white/[0.03] hover:text-foreground",
              )}
            >
              A new @handle
            </button>
          </div>
          <p className="text-xs text-foreground-muted">
            {sourceHandle
              ? `We'll read @${sourceHandle} to calibrate the room.`
              : "You'll enter a @handle in the next step."}
          </p>
        </div>
      )}

      {/* Platform */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground-secondary" htmlFor="aud-platform">
          Platform
        </label>
        <Select
          options={PLATFORM_OPTIONS}
          value={platform}
          onChange={(v) => setPlatform(v as AudiencePlatform)}
          placeholder="Select platform"
        />
      </div>

      {/* Goal label + intent */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground-secondary" htmlFor="aud-goal">
          Goal (optional)
        </label>
        <Input
          id="aud-goal"
          value={goalLabel}
          onChange={(e) => setGoalLabel(e.target.value)}
          placeholder="e.g. Grow my following"
          maxLength={120}
        />
        <Select
          options={GOAL_INTENT_OPTIONS}
          value={goalIntent}
          onChange={(v) => setGoalIntent(v as GoalIntent)}
          placeholder="Goal intent (how Maven weights the audience)"
        />
      </div>

      {/* Success criterion (POP-05) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground-secondary" htmlFor="aud-success-criterion">
          Success criterion — what &ldquo;good&rdquo; means for this audience (optional)
        </label>
        <Textarea
          id="aud-success-criterion"
          value={successCriterion}
          onChange={(e) => setSuccessCriterion(e.target.value)}
          placeholder="e.g. Saves & shares over raw views — depth of engagement, not reach."
          maxLength={2000}
          minRows={3}
        />
      </div>

      {/* User-added grounding — custom_context (POP-02 / TRUST-02 / D-07) */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground-secondary">User-added grounding</span>
            <p className="text-xs text-foreground-muted">
              Context you supply — tagged{" "}
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-foreground-secondary">
                user-added
              </span>{" "}
              and shown apart from scraped evidence. Strengthens provenance, never fakes it.
            </p>
          </div>
        </div>

        {customContext.length > 0 && (
          <ul className="flex flex-col gap-2">
            {customContext.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-2 shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent"
                  aria-hidden="true"
                >
                  user-added
                </span>
                <Textarea
                  aria-label={`User-added grounding note ${i + 1}`}
                  value={c.note}
                  onChange={(e) => updateCustomContextNote(i, e.target.value)}
                  placeholder="e.g. This audience over-indexes on founders who distrust hype."
                  maxLength={2000}
                  minRows={2}
                  size="sm"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomContext(i)}
                  aria-label={`Remove grounding note ${i + 1}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <Button type="button" variant="secondary" size="sm" onClick={addCustomContext}>
            Add grounding
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-error rounded-lg border border-error/20 bg-error/10 px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || !name.trim()}
        >
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
