import type { HeatmapPayload, PersonaStreamingPartial } from '@/lib/engine/types';
import type { PersonaWeights } from '@/lib/engine/persona-weights';

export type PersonaSlotType = 'fyp' | 'niche' | 'loyalist' | 'cross_niche';
export type RowState = 'skeleton' | 'streaming' | 'filling' | 'complete';
export type CurveState = 'idle' | 'baseline' | 'morphing' | 'final';
export type TapKind = 'cell' | 'marker' | 'cluster' | 'curve-point' | 'fix-chip';

export interface AudienceMarker {
  personaId: string;
  slotType: PersonaSlotType;
  archetype: string;
  x: number;  // canvas pixels (CSS px, post-DPR scale)
  y: number;
  opacity: number; // 0..1 — animated by RetentionCurve RAF
}

export interface MarkerCluster {
  kind: 'cluster';
  x: number;
  y: number;
  count: number;
  markers: AudienceMarker[];
}

export type MarkerOrCluster = AudienceMarker | MarkerCluster;

export interface ChoreographyState {
  rowStates: Record<string, RowState>;       // keyed by persona_id
  curveState: CurveState;
  isAntiViralityActive: boolean;
  isMorphInProgress: boolean;
}

// Tap popover payload variants
export type TapPopoverPayload =
  | { kind: 'cell'; personaId: string; segmentIdx: number; attention: number; reason?: string }
  | { kind: 'marker'; personaId: string; t: number; attention: number }
  | { kind: 'cluster'; markers: AudienceMarker[] }
  | { kind: 'curve-point'; t: number; weightedAttention: number; contributingPersonas: Array<{ personaId: string; attention: number }> }
  | { kind: 'fix-chip'; segmentIdx: number; fixText: string };

export type { HeatmapPayload, PersonaStreamingPartial, PersonaWeights };

// ─── Component prop interfaces ─────────────────────────────────────────────

export interface PersonaRowProps {
  personaId: string | null;             // null when skeleton slot has no real persona yet
  slotType: PersonaSlotType;
  archetypeLabel: string;
  segments: HeatmapPayload['segments'] | null;
  attentions: number[] | null;          // null while waiting for pass2_persona_end
  swipePredictedAt: number | null;
  totalDurationSec: number;
  rowState: RowState;
  rowIndex?: number;                    // aria-rowindex for grid context (1-based)
  onCellTap: (segmentIdx: number) => void;
  onRowLabelTap: () => void;
}

export interface HeatmapDrawerProps {
  heatmap: HeatmapPayload | null;
  rowStates: Record<string, RowState>;  // from useAudienceChoreography
  totalDurationSec: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCellTap: (personaId: string, segmentIdx: number) => void;
  onRowLabelTap: (personaId: string) => void;
}
