"use client";

/**
 * ConnectStep — step 1 of onboarding: name the audience we are about to build.
 *
 * Before this, the step collected a TikTok handle, wrote it to `creator_profiles.tiktok_handle`,
 * and stopped. Nothing read that string except the /competitors pages, so onboarding finished
 * having created NO connected account and NO calibrated audience — and since every card in the
 * product is audience-relative, a fresh account's first card could only ever render the
 * "Not tested yet" fallback. The step promised a connection and delivered a string.
 *
 * Now it opens one of two real doors, and both end in a calibrated audience:
 *
 *   personal — their @handle → the one-scrape calibrate pipeline (audience + connected account
 *              + snapshot + posts archive, all server-side in ONE Apify call)
 *   target   — a written description → the same pipeline's no-handle branch, which SEARCHES the
 *              niche instead of reading an account. Works for someone who has no account yet, or
 *              whose account is private.
 *              ⚠️ It is not free: that branch still calls scrapeNiche → Apify (calibration.ts:344).
 *              "No account needed" is the honest claim; "no cost" is not.
 *
 * The describe door is deliberately the escape hatch rather than a "Skip for now" link. Skipping
 * used to complete onboarding with nothing set up, which left the product permanently inert; the
 * describe path costs the user one sentence and leaves them with a working product.
 *
 * This step only CREATES THE DRAFT ROW. The wait belongs to CalibrationFlow (step 2) — see the
 * welcome page. Splitting it that way is what keeps this from becoming a third calibration UI.
 */

import { useState } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { Heading, Text } from "@/components/ui/typography";
import { nameFromDescription } from "@/components/audience/audience-create";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { cn } from "@/lib/utils";

interface ConnectStepProps {
  /**
   * Hand the created draft up to the page, which mounts CalibrationFlow against it.
   * `handle` / `description` prefill that flow so it never re-asks what we just collected.
   */
  onDraftReady: (
    draft: Audience,
    prefill: { handle?: string; description?: string }
  ) => void;
}

type Door = "personal" | "target";

export function ConnectStep({ onDraftReady }: ConnectStepProps) {
  const { tiktokHandle, setTiktokHandle } = useOnboardingStore();

  const [door, setDoor] = useState<Door>("personal");
  const [handle, setHandle] = useState(tiktokHandle);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cleanHandle = handle.trim().replace(/^@/, "");
  const canContinue =
    door === "personal" ? cleanHandle.length > 0 : description.trim().length > 0;

  async function createDraft() {
    if (submitting) return;

    if (door === "personal") {
      if (!cleanHandle) {
        setError("Please enter your TikTok handle");
        return;
      }
      if (!/^[a-zA-Z0-9._]+$/.test(cleanHandle)) {
        setError("Handle can only contain letters, numbers, dots, and underscores");
        return;
      }
      // Persist the handle now, not at completion: if calibration fails or they abandon the
      // second step, we still know who they said they were.
      setTiktokHandle(cleanHandle);
    } else if (!description.trim()) {
      setError("Describe who you're making for");
      return;
    }

    setSubmitting(true);
    setError(null);

    const body =
      door === "personal"
        ? {
            name: `@${cleanHandle}`,
            type: "personal" as const,
            platform: "tiktok" as const,
            goal_intent: "grow" as const,
          }
        : {
            name: nameFromDescription(description),
            type: "target" as const,
            platform: "custom" as const,
            goal_intent: "grow" as const,
          };

    try {
      const res = await fetch("/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Couldn't start. Try again.");
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { audience: Audience };
      // Deliberately no setSubmitting(false) on success — this component unmounts as the page
      // swaps to the calibrate stage, and a state write on the way out is a no-op warning.
      onDraftReady(
        data.audience,
        door === "personal"
          ? { handle: cleanHandle }
          : { description: description.trim() }
      );
    } catch {
      setError("Couldn't start. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="text-center">
        <Heading level={3} className="mb-2">
          {door === "personal" ? "Connect your TikTok" : "Describe your audience"}
        </Heading>
        <Text size="sm" muted>
          {door === "personal"
            ? "We'll read your account once to build the audience your ideas get tested against."
            : "One sentence about who you're making for. We'll build the audience from it — no account needed."}
        </Text>
      </div>

      <div className="space-y-4">
        {door === "personal" ? (
          <InputField
            label="TikTok Handle"
            placeholder="@yourhandle"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createDraft();
            }}
            error={error ?? undefined}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm text-foreground-secondary"
              htmlFor="onboarding-describe"
            >
              Who are you making for?
            </label>
            <textarea
              id="onboarding-describe"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Small business owners aged 25–45 who want to grow on TikTok but have no time to film."
              rows={4}
              maxLength={500}
              className={cn(
                "w-full resize-none rounded-[8px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-foreground",
                "placeholder:text-foreground-muted/60",
                "focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-white/10"
              )}
            />
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        )}

        <Button
          variant="primary"
          className="w-full"
          disabled={!canContinue || submitting}
          onClick={() => void createDraft()}
        >
          {submitting ? "Starting…" : "Continue"}
        </Button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-white/[0.06]" />
          <span className="font-mono text-micro uppercase tracking-[0.08em] text-foreground-muted">
            or
          </span>
          <span className="h-px flex-1 bg-white/[0.06]" />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setDoor(door === "personal" ? "target" : "personal");
            setError(null);
          }}
          className="block w-full text-center text-sm text-foreground-secondary hover:text-foreground transition-colors disabled:opacity-50"
        >
          {door === "personal"
            ? "Describe who you're making for instead"
            : "Use my TikTok handle instead"}
        </button>
      </div>
    </div>
  );
}
