'use client';
/**
 * AdaptFrameBody — self-sourcing frame body for the Adapt frame.
 *
 * State machine (UI-SPEC §Surface Patterns):
 *   (a) nicheEmpty → inline NichePicker + heading/body copy + "Generate concepts" CTA
 *   (b) niche present + decode present + adapt absent + live session → auto-fire once (adaptFiredRef)
 *   (c) generating (isPending) → 3 Skeletons in aria-live="polite" container
 *   (d) success → 3 stacked AdaptConceptCard under "ADAPTED FOR YOUR NICHE" label
 *   (e) decode absent + niche present → empty-state copy
 *   (f) failure (isError) → role="alert" error block; Decode frame unaffected (D-06)
 *
 * Dual-read: `row?.variants?.remix?.adapt` (persisted) ?? liveAdaptConcepts (mutation response).
 * Rehydrate-no-regen: if variants.remix.adapt already present, adaptFiredRef is pre-set to true
 *   so the auto-fire effect never runs (Pitfall 3, D-05).
 *
 * Niche inline: await updateProfile.mutateAsync THEN call adapt with the just-picked
 *   labels directly — never re-reads cache (Pitfall 5, D-11/D-12).
 *
 * Analog: src/components/board/content-analysis/ContentAnalysisFrame.tsx (self-sourcing + dual-read).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useCreatorProfile, useUpdateCreatorProfile } from '@/hooks/queries/use-creator-profile';
import { NichePicker } from '@/components/app/cards/niche-picker';
import { getPrimaryLabel, getSubLabel } from '@/lib/niches/taxonomy';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { AdaptConcept, DecodeResult } from '@/lib/engine/remix/decode-types';
import { decodeResultToAdaptInput } from '@/lib/engine/remix/decode-types';
import { AdaptConceptCard } from './AdaptConceptCard';
import { useAdaptConcepts } from '@/hooks/queries/use-adapt-concepts';
import type { Camera, GroupFrameLayout } from '../board-types';

// ── Internal row shape read from useAnalysisStream result ─────────────────────
interface AdaptRow {
  variants?: {
    remix?: {
      decode?: DecodeResult | null;
      adapt?: AdaptConcept[] | null;
    } | null;
  } | null;
}

interface AdaptFrameBodyProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

/**
 * AdaptFrameBody — mounts in both AdaptShellNode (desktop canvas overlay)
 * and BoardMobile (card stack). Self-sources via usePermalinkAnalysis +
 * useAnalysisStream (identical to ContentAnalysisFrame pattern).
 */
export function AdaptFrameBody({ camera: _camera, layout: _layout }: AdaptFrameBodyProps) {
  // ── Self-source: permalink hydration → stream ────────────────────────────
  const { data: permalinkData, id: analysisId } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const row = stream.result as unknown as AdaptRow | null;

  // ── Develop stream — separate instance; only started on explicit card click ──
  // C3/D-02: zero streams until click; exactly one POST per click; no loop/prefetch.
  const router = useRouter();
  const developStream = useAnalysisStream({ initialData: null });
  const developPrevIdRef = useRef<string | null>(null);

  // Navigate to child board on started event (D-01 — verbatim Board.tsx pattern)
  useEffect(() => {
    const id = developStream.analysisId;
    if (id && developPrevIdRef.current === null) {
      router.push(`/analyze/${id}`);
    }
    developPrevIdRef.current = id;
  }, [developStream.analysisId, router]);

  // Per-concept Develop handler — assembles brief (D-04/D-05) and starts ONE stream
  const handleDevelop = useCallback((concept: AdaptConcept) => {
    if (!analysisId) return;
    // D-04: full concept context (hook + angle + format_borrowed)
    // D-05: concept.hook is the first line → label in Recent
    const brief = [
      concept.hook,
      concept.angle,
      `Format: ${concept.format_borrowed}`,
    ].join('\n\n');

    void developStream.start({
      input_mode: 'text',
      content_text: brief,
      content_type: 'video',
      mode: 'score',         // D-06: standard scored analysis (not remix)
      parent_id: analysisId, // D-07: source remix analysis id (known before started frame)
    });
  }, [analysisId, developStream]);

  // ── Dual-read adapt: persisted variant takes priority (rehydrate-no-regen)
  const persistedAdapt =
    (row?.variants?.remix?.adapt ?? null) as AdaptConcept[] | null;
  const [liveAdaptConcepts, setLiveAdaptConcepts] = useState<AdaptConcept[] | null>(null);

  // The authoritative source: persisted from DB → live mutation result
  const adapt: AdaptConcept[] | null = persistedAdapt ?? liveAdaptConcepts;

  // ── Decode output: the canonical DecodeResult persisted by Phase 3 ──────────
  const decodeOutput: DecodeResult | null =
    (row?.variants?.remix?.decode ?? null) as DecodeResult | null;

  // ── Niche gate (D-11): BOTH must be null for the inline picker to show ───
  const { data: profile } = useCreatorProfile();
  const updateProfile = useUpdateCreatorProfile();
  const nicheEmpty =
    (profile?.niche_primary == null) && (profile?.niche_sub == null);

  // ── Local draft for the inline NichePicker ───────────────────────────────
  const [draft, setDraft] = useState<{ primary: string | null; sub: string | null }>({
    primary: null,
    sub: null,
  });

  // ── Mutation hook ──────────────────────────────────────────────────────────
  const adaptMutation = useAdaptConcepts(analysisId ?? '');
  const [mutationError, setMutationError] = useState<boolean>(false);

  // ── Already-fired guard (Board.tsx:182 streamingAnalysisIdRef pattern) ────
  // Pre-set to true when persisted adapt is already present so the auto-fire
  // effect never re-generates on permalink reload (Pitfall 3).
  const adaptFiredRef = useRef(false);
  if (persistedAdapt && !adaptFiredRef.current) {
    adaptFiredRef.current = true;
  }

  // ── Core generation function ──────────────────────────────────────────────
  const triggerAdaptGeneration = async (niche: string) => {
    if (!decodeOutput || !analysisId) return;
    try {
      setMutationError(false);
      // Bridge the persisted DecodeResult into the wire shape (D-01: luck never crosses).
      const adaptInput = decodeResultToAdaptInput(decodeOutput, niche);
      const result = await adaptMutation.mutateAsync({
        analysis_id: analysisId,
        decode: {
          hook_pattern: adaptInput.hook_pattern,
          structure: adaptInput.structure,
          the_turn: adaptInput.the_turn,
          emotional_beat: adaptInput.emotional_beat,
          repeatable: adaptInput.repeatable,
        },
        niche,
      });
      setLiveAdaptConcepts(result.concepts);
    } catch {
      setMutationError(true);
    }
  };

  // ── Auto-fire effect (D-04) ────────────────────────────────────────────────
  // Fires when: niche present AND decode present AND adapt absent AND not yet fired.
  // Guards against: permalink-with-persisted-adapt (pre-set ref), already in flight,
  // nicheEmpty, and missing decode (waits for Phase 3 Decode).
  useEffect(() => {
    if (adaptFiredRef.current) return;
    if (nicheEmpty) return;
    if (!decodeOutput) return;
    if (adapt) return; // persisted adapt already present — no need to generate

    adaptFiredRef.current = true;

    const niche = [
      getPrimaryLabel(profile?.niche_primary ?? ''),
      getSubLabel(profile?.niche_primary ?? '', profile?.niche_sub ?? ''),
    ]
      .filter(Boolean)
      .join(' / ');

    void triggerAdaptGeneration(niche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nicheEmpty, decodeOutput, adapt]);

  // ── Inline niche confirm handler (Pitfall 5: pass directly, don't re-read cache)
  const handleGenerateWithNiche = async () => {
    if (!draft.primary || !draft.sub) return;
    await updateProfile.mutateAsync({
      niche_primary: draft.primary,
      niche_sub: draft.sub,
    });
    // Pass niche labels directly — cache invalidation from updateProfile.onSuccess
    // may not have settled yet (Pitfall 5)
    const niche = [
      getPrimaryLabel(draft.primary),
      getSubLabel(draft.primary, draft.sub),
    ]
      .filter(Boolean)
      .join(' / ');
    adaptFiredRef.current = true;
    void triggerAdaptGeneration(niche);
  };

  // ── Render states ─────────────────────────────────────────────────────────

  // (a) Niche empty → inline NichePicker prompt
  if (nicheEmpty) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            Add your niche to generate concepts
          </p>
          <p className="text-xs font-medium text-foreground-muted">
            Concepts adapt the source format to your niche. It takes seconds.
          </p>
        </div>
        <NichePicker
          primary={draft.primary}
          sub={draft.sub}
          onChange={setDraft}
        />
        <Button
          variant="primary"
          size="sm"
          disabled={!draft.primary || !draft.sub || updateProfile.isPending || adaptMutation.isPending}
          onClick={() => void handleGenerateWithNiche()}
        >
          Generate concepts
        </Button>
      </div>
    );
  }

  // (f) Error state — adapt generation failed; Decode frame unaffected (D-06)
  if (mutationError || adaptMutation.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <WarningCircle size={16} className="text-white/45" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {"Couldn't generate concepts"}
          </p>
        </div>
        <p className="text-xs font-medium text-foreground-muted">
          Try refreshing the page. Decode results are still available.
        </p>
      </div>
    );
  }

  // (c) Generating — show skeletons
  if (adaptMutation.isPending) {
    return (
      <div
        aria-live="polite"
        aria-label="Generating adapted concepts…"
        className="flex flex-col gap-4"
      >
        <Skeleton className="h-[120px] w-full rounded-xl" />
        <Skeleton className="h-[120px] w-full rounded-xl" />
        <Skeleton className="h-[120px] w-full rounded-xl" />
      </div>
    );
  }

  // (d) Success — 3 stacked AdaptConceptCards
  if (adapt && adapt.length > 0) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <p className="text-xs font-medium text-white/45 uppercase tracking-widest">
          ADAPTED FOR YOUR NICHE
        </p>
        <div className="flex flex-col gap-4">
          {adapt.map((concept, i) => (
            <AdaptConceptCard
              key={i}
              concept={concept}
              onDevelop={() => handleDevelop(concept)}
              isPending={
                developStream.phase === 'analyzing' ||
                developStream.phase === 'reconnecting' ||
                developStream.phase === 'polling'
              }
            />
          ))}
        </div>
      </div>
    );
  }

  // (e) Decode absent + niche present → empty-state copy
  if (!decodeOutput) {
    return (
      <p className="text-xs font-medium text-foreground-muted">
        Concepts generate once the source video is decoded.
      </p>
    );
  }

  // Decode present but adapt not yet fired (edge case during SSR / initial render)
  return null;
}
