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
import type { Audience, AudiencePlatform, AudienceType, GoalIntent } from "@/lib/audience/audience-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CalibrationFlow } from "./calibration-flow";
import { cn } from "@/lib/utils";

const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
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
  className?: string;
}

export function AudienceForm({ existing, className }: AudienceFormProps) {
  const router = useRouter();
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<AudienceType>(existing?.type ?? "personal");
  const [platform, setPlatform] = useState<AudiencePlatform>(existing?.platform ?? "tiktok");
  const [goalLabel, setGoalLabel] = useState(existing?.goal_label ?? "");
  const [goalIntent, setGoalIntent] = useState<GoalIntent | "">(existing?.goal_intent ?? "");
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
        platform,
        goal_label: goalLabel.trim() || null,
        goal_intent: goalIntent || null,
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

  // Show calibration flow after audience created
  if (savedAudience && !calibrated) {
    return (
      <CalibrationFlow
        audience={savedAudience}
        onDone={handleCalibrationDone}
        onSkip={handleCalibrationSkip}
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
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                type === t
                  ? "border-accent/60 bg-accent/10 text-accent"
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
          placeholder="Goal intent (how Numen weights the audience)"
        />
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
