'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { HeatmapPayload } from './audience-types';

// ─── Prop interface ────────────────────────────────────────────────────────

export interface PersonaInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: string | null;
  heatmap: HeatmapPayload | null;
  pass1Verdict?: string;
  pass1Confidence?: number;
  onJumpToSegment: (segmentIdx: number) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

// ─── Attention Sparkline ───────────────────────────────────────────────────

function AttentionSparkline({ attentions }: { attentions: number[] }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || attentions.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR-aware setup
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.offsetWidth || 200;
    const h = rect.height || 48;

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
      style={{ width: '100%', height: 48, display: 'block' }}
    />
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function PersonaInspector({
  open,
  onOpenChange,
  personaId,
  heatmap,
  pass1Verdict,
  pass1Confidence,
  onJumpToSegment,
  triggerRef,
}: PersonaInspectorProps) {
  const isMobile = useIsMobile();
  const side = isMobile ? 'bottom' : 'right';

  // Find persona in heatmap
  const persona = React.useMemo(() => {
    if (!personaId || !heatmap) return null;
    return heatmap.personas.find((p) => p.id === personaId) ?? null;
  }, [personaId, heatmap]);

  const segmentReasons = persona?.segment_reasons
    ? Object.entries(persona.segment_reasons).map(([idx, reason]) => ({
        segIdx: Number(idx),
        reason,
      }))
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'border-white/[0.06] bg-[#18191a]',
          side === 'right' && 'max-w-[360px]',
          side === 'bottom' && 'max-h-[85dvh]',
        )}
        aria-label={persona ? `${persona.id} detailed analysis` : 'Persona analysis'}
        onCloseAutoFocus={(e) => {
          if (triggerRef?.current) {
            e.preventDefault();
            triggerRef.current.focus();
          }
        }}
      >
        {!persona ? (
          // Empty state
          <div className="flex flex-col gap-2 p-4">
            <SheetHeader>
              <SheetTitle className="sr-only">Persona analysis</SheetTitle>
            </SheetHeader>
            <div className="flex items-center justify-center h-32">
              <p className="text-sm" style={{ color: 'rgba(249,249,249,0.5)' }}>
                No persona selected
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4 overflow-y-auto">
            {/* Header */}
            <SheetHeader>
              <div
                className="inline-flex items-center rounded border px-2 py-0.5 text-[11px] mb-1 w-fit"
                style={{ borderColor: '#FF7F50', color: '#FF7F50' }}
              >
                {persona.slot_type.toUpperCase()}
              </div>
              <SheetTitle className="text-base font-semibold" style={{ color: 'rgba(249,249,249,0.9)' }}>
                {persona.id}
              </SheetTitle>
              <p className="text-xs" style={{ color: 'rgba(249,249,249,0.5)' }}>
                {persona.slot_type} archetype
              </p>
            </SheetHeader>

            {/* Pass 1 verdict */}
            {pass1Verdict && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(249,249,249,0.4)' }}>
                  Pass 1 Verdict
                </h3>
                <p className="text-sm" style={{ color: 'rgba(249,249,249,0.8)' }}>
                  {pass1Verdict}
                  {pass1Confidence !== undefined && (
                    <span className="ml-2 text-xs" style={{ color: 'rgba(249,249,249,0.5)' }}>
                      ({Math.round(pass1Confidence * 100)}% confidence)
                    </span>
                  )}
                </p>
              </section>
            )}

            {/* Swipe context */}
            {persona.swipe_predicted_at !== null && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(249,249,249,0.4)' }}>
                  Swipe Prediction
                </h3>
                <p className="text-sm" style={{ color: 'rgba(249,249,249,0.8)' }}>
                  Predicted swipe at {persona.swipe_predicted_at}s
                </p>
              </section>
            )}

            {/* Segment reasons timeline */}
            {segmentReasons.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(249,249,249,0.4)' }}>
                  Inflection Points
                </h3>
                <ul className="flex flex-col gap-2">
                  {segmentReasons.map(({ segIdx, reason }) => (
                    <li key={segIdx} className="flex flex-col gap-1">
                      <p className="text-sm" style={{ color: 'rgba(249,249,249,0.8)', lineHeight: 1.5 }}>
                        {reason}
                      </p>
                      <button
                        type="button"
                        onClick={() => onJumpToSegment(segIdx)}
                        aria-label={`Jump to segment ${segIdx}`}
                        className="text-xs self-start"
                        style={{ color: '#FF7F50' }}
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
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'rgba(249,249,249,0.4)' }}>
                Attention
              </h3>
              <AttentionSparkline attentions={persona.attentions} />
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
