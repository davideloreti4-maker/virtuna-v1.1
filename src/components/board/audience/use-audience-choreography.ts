'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { usePerfStore } from '@/lib/perf-tier';
import { announce } from '@/lib/a11y';
import { isAntiViralityGatedFull } from '@/lib/engine/anti-virality';
import { PERSONA_SLOT_ORDER, CELL_FILL_WAVE_MS, CURVE_MORPH_MS } from './audience-constants';
import type { ChoreographyState, RowState, CurveState, PersonaSlotType } from './audience-types';

/** Maps archetype name → persona slot type. Unknown archetypes fall back to undefined (no transition). */
const ARCHETYPE_TO_SLOT: Record<string, PersonaSlotType> = {
  // FYP archetypes
  high_engager: 'fyp',
  saver: 'fyp',
  lurker: 'fyp',
  sharer: 'fyp',
  viewer: 'fyp',
  tough_crowd: 'fyp',
  purposeful_viewer: 'fyp',
  // Niche archetypes
  niche_deep: 'niche',
  niche_deep_buyer: 'niche',
  niche_deep_scout: 'niche',
  // Loyalist
  loyalist: 'loyalist',
  // Cross-niche
  cross_niche_curiosity: 'cross_niche',
} as const;

type StreamReturn = ReturnType<typeof useAnalysisStream>;

/**
 * Pure orchestration hook that drives the Audience node's live-streaming animation state machine.
 *
 * Subscribes to useAnalysisStream (or an injected stream for tests), usePrefersReducedMotion,
 * and usePerfStore. Emits skeleton rows in PERSONA_SLOT_ORDER on wave_0_complete, transitions
 * row states on pass2_persona_start / pass2_persona_end, drives curve state through
 * idle → baseline → morphing → final.
 *
 * @param stream - Optional injected stream (for testing). If omitted, calls useAnalysisStream() internally.
 */
export function useAudienceChoreography(stream?: StreamReturn): ChoreographyState {
  // Allow test injection — hook must always be called for Rules of Hooks compliance.
  // The internal stream is only USED when no external stream is injected.
  const internalStream = useAnalysisStream();
  const s = stream ?? internalStream;

  const prefersReducedMotion = usePrefersReducedMotion();
  const tier = usePerfStore((st) => st.tier);
  const reducedMotion = prefersReducedMotion || tier === 'low';

  // Row state: keyed by slot placeholder ('slot-0'..'slot-9') until real persona_id arrives,
  // then replaced with the real persona_id.
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  // Available slots per type — consumed as personas are assigned
  const slotsByTypeRef = useRef<Record<PersonaSlotType, string[]>>({
    fyp: [],
    niche: [],
    loyalist: [],
    cross_niche: [],
  });

  // Fill-wave timers per persona_id
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Curve state
  const [curveState, setCurveState] = useState<CurveState>('idle');
  const morphTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks which persona_ids have already been processed for each transition
  const startedPersonasRef = useRef<Set<string>>(new Set());
  const completedPersonasRef = useRef<Set<string>>(new Set());

  // aria-live announcement tracking refs (fire once per transition)
  const announcedStreamingRef = useRef(false);
  const announcedCompleteRef = useRef(false);
  const announcedAntiViralityRef = useRef<string | null>(null);

  // Track seeded state to make wave_0 seeding idempotent
  const wave0SeededRef = useRef(false);

  // ---- Effect 1: Seed skeleton rows on wave_0_complete ----
  useEffect(() => {
    if (wave0SeededRef.current) return;
    const wave0Done = s.stages.some(
      (ev) => ev.type === 'stage_end' && ev.stage === 'wave_0_segmentation',
    );
    if (!wave0Done) return;

    // Seed 10 skeleton rows in PERSONA_SLOT_ORDER sequence
    const newRowStates: Record<string, RowState> = {};
    const slotsByType: Record<PersonaSlotType, string[]> = {
      fyp: [],
      niche: [],
      loyalist: [],
      cross_niche: [],
    };

    PERSONA_SLOT_ORDER.forEach((slotType, i) => {
      const key = `slot-${i}`;
      newRowStates[key] = 'skeleton';
      slotsByType[slotType].push(key);
    });

    wave0SeededRef.current = true;
    slotsByTypeRef.current = slotsByType;
    setRowStates(newRowStates);
  }, [s.stages]);

  // ---- Effect 2: Handle pass2_persona_start from stages ----
  // Detect new pass2_persona_start events and transition matching slot to 'streaming'
  useEffect(() => {
    if (!wave0SeededRef.current) return;

    const startEvents = s.stages.filter((ev) => ev.type === 'pass2_persona_start');
    if (startEvents.length === 0) return;

    let hasNewEvents = false;
    const assignments: Array<{ slotKey: string; personaId: string }> = [];

    for (const ev of startEvents) {
      if (ev.type !== 'pass2_persona_start') continue;
      const { persona_id, archetype } = ev;
      if (startedPersonasRef.current.has(persona_id)) continue;

      const slotType = ARCHETYPE_TO_SLOT[archetype];
      if (!slotType) continue;

      const availableSlots = slotsByTypeRef.current[slotType];
      if (!availableSlots || availableSlots.length === 0) continue;

      const slotKey = availableSlots.shift()!;
      startedPersonasRef.current.add(persona_id);
      assignments.push({ slotKey, personaId: persona_id });
      hasNewEvents = true;
    }

    if (!hasNewEvents) return;

    setRowStates((prev) => {
      const next = { ...prev };
      for (const { slotKey, personaId } of assignments) {
        delete next[slotKey];
        next[personaId] = 'streaming';
      }
      return next;
    });
  }, [s.stages]);

  // ---- Effect 3: Handle pass2_persona_end from stages ----
  useEffect(() => {
    if (!wave0SeededRef.current) return;

    const endEvents = s.stages.filter((ev) => ev.type === 'pass2_persona_end');
    if (endEvents.length === 0) return;

    const newCompletions: string[] = [];

    for (const ev of endEvents) {
      if (ev.type !== 'pass2_persona_end') continue;
      const { persona_id } = ev;
      if (completedPersonasRef.current.has(persona_id)) continue;
      completedPersonasRef.current.add(persona_id);
      newCompletions.push(persona_id);
    }

    if (newCompletions.length === 0) return;

    if (reducedMotion) {
      // Skip filling, go directly to complete
      setRowStates((prev) => {
        const next = { ...prev };
        for (const pid of newCompletions) {
          if (pid in next) next[pid] = 'complete';
        }
        return next;
      });
    } else {
      // Transition to filling, then schedule complete
      setRowStates((prev) => {
        const next = { ...prev };
        for (const pid of newCompletions) {
          if (pid in next) next[pid] = 'filling';
        }
        return next;
      });

      for (const pid of newCompletions) {
        const existingTimer = timersRef.current[pid];
        if (existingTimer !== undefined) clearTimeout(existingTimer);

        timersRef.current[pid] = setTimeout(() => {
          setRowStates((r) => {
            if (r[pid] !== 'filling') return r;
            return { ...r, [pid]: 'complete' };
          });
          delete timersRef.current[pid];
        }, CELL_FILL_WAVE_MS);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.stages, reducedMotion]);

  // ---- Effect 3b: Permalink/completed hydration ----
  // On a completed analysis loaded from cache (permalink replay), `s.stages` is
  // empty — Effects 1-3 never seed/transition rows, so every PersonaRow stays
  // 'skeleton' and the heatmap renders blank despite heatmap.personas existing.
  // Mark each real persona 'complete' so the grid renders. Gated on empty stages
  // so it never clobbers the live stage-driven reveal.
  useEffect(() => {
    if (s.phase !== 'complete') return;
    if (s.stages.length > 0) return;
    const personas = s.result?.heatmap?.personas;
    if (!personas || personas.length === 0) return;
    setRowStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of personas) {
        if (next[p.id] !== 'complete') {
          next[p.id] = 'complete';
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [s.phase, s.stages.length, s.result?.heatmap]);

  // ---- Effects 4+5: Curve state machine (merged to avoid multi-render race) ----
  // Merging into one effect prevents the "idle → baseline" and "baseline → morphing"
  // transitions from requiring two separate render cycles when both conditions are
  // satisfied simultaneously (e.g. when result already has both persona_behavioral_aggregate
  // AND heatmap at mount time).
  useEffect(() => {
    const hasAggregate = !!s.result?.persona_behavioral_aggregate;
    const hasHeatmap = s.result?.heatmap != null;
    const isComplete = s.phase === 'complete';

    if (curveState === 'idle') {
      if (!isComplete || !hasAggregate) return;

      if (reducedMotion) {
        // Skip baseline + morphing, jump to final if heatmap present
        setCurveState(hasHeatmap ? 'final' : 'baseline');
        return;
      }

      if (hasHeatmap) {
        // Both conditions met in one render — go directly to morphing
        setCurveState('morphing');
        if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
        morphTimerRef.current = setTimeout(() => {
          setCurveState('final');
          morphTimerRef.current = null;
        }, CURVE_MORPH_MS);
      } else {
        setCurveState('baseline');
      }
      return;
    }

    if (curveState === 'baseline') {
      if (!hasHeatmap) return;

      if (reducedMotion) {
        setCurveState('final');
        return;
      }

      setCurveState('morphing');
      if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
      morphTimerRef.current = setTimeout(() => {
        setCurveState('final');
        morphTimerRef.current = null;
      }, CURVE_MORPH_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.result?.persona_behavioral_aggregate, s.result?.heatmap, curveState, reducedMotion]);

  // ---- Effect 6: aria-live — streaming start ----
  useEffect(() => {
    if (announcedStreamingRef.current) return;
    if (s.phase === 'analyzing' || s.phase === 'complete' || s.phase === 'reconnecting') {
      announcedStreamingRef.current = true;
      announce('Reading your audience…', 'polite');
    }
  }, [s.phase]);

  // ---- Effect 7: aria-live — all rows complete ----
  useEffect(() => {
    if (announcedCompleteRef.current) return;
    const rowValues = Object.values(rowStates);
    if (rowValues.length > 0 && rowValues.every((state) => state === 'complete')) {
      announcedCompleteRef.current = true;
      announce('Audience analysis ready', 'polite');
    }
  }, [rowStates]);

  // ---- Anti-virality: computed live from result ----
  const antiViralityResult = useMemo(() => {
    if (!s.result) return { gated: false, reason: null, dropoff_segment_indices: [] as number[] };
    return isAntiViralityGatedFull(
      s.result.confidence ?? 1,
      s.result.heatmap ?? null,
    );
  }, [s.result]);

  const isAntiViralityActive = antiViralityResult.gated;

  // ---- Effect 8: aria-live — anti-virality ----
  useEffect(() => {
    if (!isAntiViralityActive) return;
    const idxList = antiViralityResult.dropoff_segment_indices.join(', ');
    if (announcedAntiViralityRef.current === idxList) return;
    announcedAntiViralityRef.current = idxList;
    announce(`Critical drop detected at segments ${idxList}`, 'assertive');
  }, [isAntiViralityActive, antiViralityResult.dropoff_segment_indices]);

  const isMorphInProgress = curveState === 'morphing';

  // ---- Cleanup all timers on unmount ----
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      if (morphTimerRef.current) clearTimeout(morphTimerRef.current);
    };
  }, []);

  return {
    rowStates,
    curveState,
    isAntiViralityActive,
    isMorphInProgress,
  };
}
