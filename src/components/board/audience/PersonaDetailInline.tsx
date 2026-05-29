'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { MARKER_RING_COLOR } from './audience-constants';
import type { HeatmapPayload } from './audience-types';

// ─── Attention Sparkline ───────────────────────────────────────────────────
// (was inline in the now-removed PersonaInspector Sheet — kept here as the
// canonical owner since this inline detail is the only consumer.)

function AttentionSparkline({ attentions }: { attentions: number[] }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || attentions.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.offsetWidth || 200;
    const h = rect.height || 40;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (attentions.length < 2) return;

    const xStep = w / (attentions.length - 1);
    const padding = 2;

    ctx.beginPath();
    ctx.strokeStyle = '#FF7F50';
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    attentions.forEach((v, i) => {
      const x = i * xStep;
      const y = padding + (1 - v) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }, [attentions]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Persona attention sparkline"
      style={{ width: '100%', height: 40, display: 'block' }}
    />
  );
}

// ─── Inline persona detail ──────────────────────────────────────────────────

export interface PersonaDetailInlineProps {
  personaId: string | null;
  heatmap: HeatmapPayload | null;
  pass1Confidence?: number;
  onJumpToSegment: (segmentIdx: number) => void;
  onClose: () => void;
}

/**
 * PersonaDetailInline — persona reasoning shown INLINE inside the Audience
 * frame (replaces the former PersonaInspector right/bottom Sheet). Per the
 * board UX overhaul: detail lives in-frame, no overlays/popups.
 *
 * Rendered below the heatmap when a persona row is selected; a close button
 * collapses it. Reuses the slot ring colour for visual continuity with the
 * row label + curve marker.
 */
export function PersonaDetailInline({
  personaId,
  heatmap,
  pass1Confidence,
  onJumpToSegment,
  onClose,
}: PersonaDetailInlineProps) {
  const persona = React.useMemo(() => {
    if (!personaId || !heatmap) return null;
    return heatmap.personas.find((p) => p.id === personaId) ?? null;
  }, [personaId, heatmap]);

  if (!persona) return null;

  const ringColor = MARKER_RING_COLOR[persona.slot_type] ?? '#FF7F50';
  const segmentReasons = persona.segment_reasons
    ? Object.entries(persona.segment_reasons).map(([idx, reason]) => ({
        segIdx: Number(idx),
        reason: reason as string,
      }))
    : [];

  return (
    <div
      className="flex flex-col gap-2.5 rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-3"
      data-testid="persona-detail-inline"
      aria-label={`${persona.id} detail`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span
            className="inline-flex w-fit items-center rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide"
            style={{ borderColor: ringColor, color: ringColor }}
          >
            {persona.slot_type}
          </span>
          <span className="text-sm font-semibold text-white/90">{persona.id}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close persona detail"
          className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Swipe prediction + confidence */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {persona.swipe_predicted_at != null && (
          <span className="text-white/70">
            Swipes at{' '}
            <span className="font-medium tabular-nums text-white/90">
              {persona.swipe_predicted_at.toFixed(0)}s
            </span>
          </span>
        )}
        {pass1Confidence !== undefined && (
          <span className="text-white/45 tabular-nums">
            {Math.round(pass1Confidence * 100)}% confidence
          </span>
        )}
      </div>

      {/* Inflection points */}
      {segmentReasons.length > 0 && (
        <section>
          <h4 className="mb-1 text-[10px] font-normal uppercase tracking-[0.04em] text-white/45">
            Inflection points
          </h4>
          <ul className="flex flex-col gap-1.5">
            {segmentReasons.map(({ segIdx, reason }) => (
              <li key={segIdx} className="flex flex-col gap-0.5">
                <p className="text-xs leading-[1.45] text-white/75">{reason}</p>
                <button
                  type="button"
                  onClick={() => onJumpToSegment(segIdx)}
                  aria-label={`Jump to segment ${segIdx}`}
                  className="self-start text-[11px] text-accent hover:underline"
                >
                  Jump to segment →
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Attention sparkline */}
      <section>
        <h4 className="mb-1 text-[10px] font-normal uppercase tracking-[0.04em] text-white/45">
          Attention
        </h4>
        <AttentionSparkline attentions={persona.attentions} />
      </section>
    </div>
  );
}
