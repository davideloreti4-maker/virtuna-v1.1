"use client";

import { useEffect, useRef, useState } from "react";

import {
  PlatformPicker,
  type PlatformId,
} from "@/components/app/cards/platform-picker";
import { NichePicker } from "@/components/app/cards/niche-picker";
import {
  AudiencePicker,
  type AgeRange,
  type GenderSkew,
  type TargetAudience,
} from "@/components/app/cards/audience-picker";
import {
  GoalStagePicker,
  type CreatorGoal,
  type CreatorStage,
} from "@/components/app/cards/goal-stage-picker";
import {
  ContentStylePicker,
  type ContentStyle,
  type CutsPerSecond,
} from "@/components/app/cards/content-style-picker";
import {
  ReferenceCreatorsInput,
  type ReferenceCreatorEntry,
} from "@/components/app/cards/reference-creators-input";
import {
  WinsFlopsInput,
  type UrlEntry,
} from "@/components/app/cards/wins-flops-input";
import {
  CadencePicker,
  type PostingFrequency,
} from "@/components/app/cards/cadence-picker";
import { PainPointsInput } from "@/components/app/cards/pain-points-input";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { useToast } from "@/components/ui/toast";

import {
  useCreatorProfile,
  useUpdateCreatorProfile,
} from "@/hooks/queries/use-creator-profile";

/**
 * ProfileSettingsForm — PROFILE-15: the edit-from-settings surface.
 *
 * Renders all 9 picker components from Plan 02-03 as labeled sections
 * in a single scrollable form. No wizard stepping; the user edits any
 * field at any time and clicks "Save changes" to PATCH the whitelist.
 *
 * Modal trigger (PROFILE-14) lives separately in Plan 02-04 — both
 * surfaces share the same TanStack cache via
 * `queryKeys.profile.creatorProfile()`.
 */

const EMPTY_AUDIENCE: TargetAudience = {
  age_range: null,
  gender_skew: null,
  geo: null,
  language: null,
};

function ProfileSettingsFormSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-6 w-40 rounded bg-white/[0.05]" />
        <div className="mt-2 h-4 w-72 rounded bg-white/[0.05]" />
      </div>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i}>
          <div className="mb-3 h-4 w-32 rounded bg-white/[0.05]" />
          <div className="h-[88px] rounded-xl bg-white/[0.04]" />
        </div>
      ))}
      <div className="h-11 w-36 rounded-md bg-white/[0.05]" />
    </div>
  );
}

export function ProfileSettingsForm(): React.JSX.Element {
  const { data: profile, isLoading } = useCreatorProfile();
  const updateMutation = useUpdateCreatorProfile();
  const { toast } = useToast();

  // Card 0
  const [platforms, setPlatforms] = useState<PlatformId[]>([]);
  // Card 1
  const [nichePrimary, setNichePrimary] = useState<string | null>(null);
  const [nicheSub, setNicheSub] = useState<string | null>(null);
  // Card 2
  const [audience, setAudience] = useState<TargetAudience>(EMPTY_AUDIENCE);
  // Card 3
  const [goal, setGoal] = useState<CreatorGoal | null>(null);
  const [stage, setStage] = useState<CreatorStage | null>(null);
  // Card 4
  const [style, setStyle] = useState<ContentStyle | null>(null);
  const [cuts, setCuts] = useState<CutsPerSecond | null>(null);
  // Card 5
  const [referenceCreators, setReferenceCreators] = useState<
    ReferenceCreatorEntry[]
  >([]);
  // Card 6
  const [wins, setWins] = useState<UrlEntry[]>([]);
  const [flops, setFlops] = useState<UrlEntry[]>([]);
  // Card 7
  const [frequency, setFrequency] = useState<PostingFrequency | null>(null);
  const [todAware, setTodAware] = useState<boolean>(false);
  // Card 8
  const [painPoints, setPainPoints] = useState<string>("");
  const [storageRetentionOptedIn, setStorageRetentionOptedIn] = useState<boolean>(false);

  // CR-04 + WR-A: gate the `useEffect([profile])` sync via `syncedRef` so
  // background refetches (e.g. cross-tab activity) do NOT clobber in-flight
  // edits. `refetchOnWindowFocus: false` (in use-creator-profile.ts) is the
  // primary defense; this ref guard is the belt.
  //
  // WR-A (iter-3): the original iter-1 fix latched `syncedRef = true` once
  // and never re-opened the gate, which silently swallowed server-side
  // sanitization (e.g. WR-07's zero-width strip). The user would type
  // "abc<U+200B>" into pain points, save successfully, the server would
  // sanitize to "abc", invalidate the cache, but the form would still
  // display the pre-sanitized 4-char value until a full page reload.
  //
  // Fix: re-open the gate when handleSave succeeds (`syncedRef = false`)
  // so the post-save invalidation's refetch is allowed to push canonical
  // server truth back into local state EXACTLY ONCE. After that single
  // re-sync, the gate latches `true` again so any later refetch (a
  // hypothetical cross-tab event or manual `refetch()`) cannot clobber
  // in-progress edits.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!profile || syncedRef.current) return;
    syncedRef.current = true;
    setPlatforms((profile.target_platforms as PlatformId[] | null) ?? []);
    setNichePrimary(profile.niche_primary);
    setNicheSub(profile.niche_sub);
    setAudience(
      profile.target_audience
        ? {
            age_range:
              (profile.target_audience.age_range as AgeRange | null) ?? null,
            gender_skew:
              (profile.target_audience.gender_skew as GenderSkew | null) ??
              null,
            geo: profile.target_audience.geo,
            language: profile.target_audience.language,
          }
        : EMPTY_AUDIENCE
    );
    setGoal((profile.primary_goal as CreatorGoal | null) ?? null);
    setStage((profile.creator_stage as CreatorStage | null) ?? null);
    setStyle((profile.content_style as ContentStyle | null) ?? null);
    setCuts((profile.cuts_per_second as CutsPerSecond | null) ?? null);
    setReferenceCreators(profile.reference_creators ?? []);
    setWins(profile.past_wins ?? []);
    setFlops(profile.past_flops ?? []);
    setFrequency(
      (profile.posting_frequency as PostingFrequency | null) ?? null
    );
    setTodAware(profile.time_of_day_aware ?? false);
    setPainPoints(profile.pain_points ?? "");
    setStorageRetentionOptedIn(profile.storage_retention_opted_in ?? false);
  }, [profile]);

  const handleSave = async (): Promise<void> => {
    try {
      await updateMutation.mutateAsync({
        target_platforms: platforms,
        niche_primary: nichePrimary,
        niche_sub: nicheSub,
        target_audience: audience,
        primary_goal: goal,
        creator_stage: stage,
        content_style: style,
        cuts_per_second: cuts,
        reference_creators: referenceCreators,
        past_wins: wins,
        past_flops: flops,
        posting_frequency: frequency,
        time_of_day_aware: todAware,
        pain_points: painPoints,
        storage_retention_opted_in: storageRetentionOptedIn,
      });
      // WR-A (iter-3): re-open the sync gate so the post-save refetch
      // (kicked off by the mutation's onSuccess invalidateQueries) is
      // allowed to push the sanitized server response back into local
      // state. The effect will latch `syncedRef = true` again on the
      // next run, so this is a one-shot re-sync, not a permanent
      // re-enable.
      syncedRef.current = false;
      toast({ variant: "success", title: "Profile updated" });
    } catch {
      toast({ variant: "error", title: "Failed to save — please try again" });
    }
  };

  if (isLoading) {
    return <ProfileSettingsFormSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div>
        <Heading level={2} size={5}>
          Creator Profile
        </Heading>
        <Text size="sm" className="mt-1 block text-foreground-secondary">
          Edit your interview answers anytime. Honest data improves prediction
          accuracy.
        </Text>
      </div>

      <section data-testid="settings-card-0" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Target platforms
        </label>
        <PlatformPicker value={platforms} onChange={setPlatforms} />
      </section>

      <section data-testid="settings-card-1" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Niche
        </label>
        <NichePicker
          primary={nichePrimary}
          sub={nicheSub}
          onChange={({ primary, sub }) => {
            setNichePrimary(primary);
            setNicheSub(sub);
          }}
        />
      </section>

      <section data-testid="settings-card-2" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Audience
        </label>
        <AudiencePicker value={audience} onChange={setAudience} />
      </section>

      <section data-testid="settings-card-3" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Goal &amp; Stage
        </label>
        <GoalStagePicker
          goal={goal}
          stage={stage}
          onChange={({ goal: nextGoal, stage: nextStage }) => {
            setGoal(nextGoal);
            setStage(nextStage);
          }}
        />
      </section>

      <section data-testid="settings-card-4" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Content style
        </label>
        <ContentStylePicker
          style={style}
          cuts={cuts}
          onChange={({ style: nextStyle, cuts: nextCuts }) => {
            setStyle(nextStyle);
            setCuts(nextCuts);
          }}
        />
      </section>

      <section data-testid="settings-card-5" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Reference creators
        </label>
        <ReferenceCreatorsInput
          value={referenceCreators}
          onChange={setReferenceCreators}
        />
      </section>

      <section data-testid="settings-card-6" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Past wins &amp; flops
        </label>
        <WinsFlopsInput
          wins={wins}
          flops={flops}
          onChange={({ wins: nextWins, flops: nextFlops }) => {
            setWins(nextWins);
            setFlops(nextFlops);
          }}
        />
      </section>

      <section data-testid="settings-card-7" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Posting cadence
        </label>
        <CadencePicker
          frequency={frequency}
          todAware={todAware}
          onChange={({ frequency: nextFreq, todAware: nextTod }) => {
            setFrequency(nextFreq);
            setTodAware(nextTod);
          }}
        />
      </section>

      <section data-testid="settings-card-8" className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Pain points
        </label>
        <PainPointsInput value={painPoints} onChange={setPainPoints} />
      </section>

      {/* INT-06: Data retention toggle */}
      <section
        data-testid="settings-retention"
        className="flex items-center justify-between py-4 border-t border-white/[0.06]"
      >
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            Keep my uploaded videos for re-analysis
          </span>
          <span className="text-xs text-foreground-muted">
            By default, uploaded videos are deleted after 30 days.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={storageRetentionOptedIn}
          disabled={updateMutation.isPending}
          onClick={() => setStorageRetentionOptedIn((prev) => !prev)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
            storageRetentionOptedIn
              ? "bg-action"
              : "bg-white/[0.08]",
            updateMutation.isPending && "opacity-50 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
              storageRetentionOptedIn ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </section>

      <div className="flex items-center gap-4 border-t border-white/[0.06] pt-6">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
