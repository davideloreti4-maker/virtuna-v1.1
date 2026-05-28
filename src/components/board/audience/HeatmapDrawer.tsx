'use client';
import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { PersonaRow } from './PersonaRow';
import { PERSONA_SLOT_ORDER } from './audience-constants';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { RowState, PersonaSlotType, HeatmapDrawerProps } from './audience-types';

const ARCHETYPE_LABEL: Record<PersonaSlotType, string> = {
  fyp: 'FYP',
  niche: 'Niche',
  loyalist: 'Loyalist',
  cross_niche: 'Cross-niche',
};

interface GridBodyProps extends HeatmapDrawerProps {
  colorBlindMode: boolean;
}

function GridBody(props: GridBodyProps) {
  const { heatmap, rowStates, totalDurationSec, colorBlindMode } = props;
  const segments = heatmap?.segments ?? null;

  const colTemplate = useMemo(() => {
    if (!segments || segments.length === 0 || totalDurationSec === 0) {
      return 'repeat(10, 1fr)';
    }
    return segments
      .map((s) => `${((s.t_end - s.t_start) / totalDurationSec).toFixed(4)}fr`)
      .join(' ');
  }, [segments, totalDurationSec]);

  // Build 10 rows backed by PERSONA_SLOT_ORDER + heatmap.personas
  const rows = useMemo(() => {
    const personas = heatmap?.personas ?? [];
    const personasBySlot: Record<PersonaSlotType, typeof personas> = {
      fyp: personas.filter((p) => p.slot_type === 'fyp'),
      niche: personas.filter((p) => p.slot_type === 'niche'),
      loyalist: personas.filter((p) => p.slot_type === 'loyalist'),
      cross_niche: personas.filter((p) => p.slot_type === 'cross_niche'),
    };
    const cursors: Record<PersonaSlotType, number> = {
      fyp: 0,
      niche: 0,
      loyalist: 0,
      cross_niche: 0,
    };
    return PERSONA_SLOT_ORDER.map((slot, slotIdx) => {
      const persona = personasBySlot[slot][cursors[slot]++];
      const state: RowState =
        persona && rowStates[persona.id] ? rowStates[persona.id]! : 'skeleton';
      return { slotIdx, slot, persona, state };
    });
  }, [heatmap, rowStates]);

  return (
    <div
      role="grid"
      aria-rowcount={10}
      aria-colcount={segments?.length ?? 0}
      aria-label="Persona attention heatmap"
      style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
        gridAutoRows: '32px',
        gap: '1px',
      }}
    >
      {rows.map(({ slotIdx, slot, persona, state }) => (
        // The wrapper div spans the full grid width; PersonaRow carries role="row"
        // with aria-rowindex passed as a prop.
        <div key={slotIdx} style={{ gridColumn: '1 / -1' }}>
          <PersonaRow
            personaId={persona?.id ?? null}
            slotType={slot}
            archetypeLabel={ARCHETYPE_LABEL[slot]}
            segments={segments}
            attentions={persona?.attentions ?? null}
            swipePredictedAt={persona?.swipe_predicted_at ?? null}
            totalDurationSec={props.totalDurationSec}
            rowState={state}
            colorBlindMode={colorBlindMode}
            rowIndex={slotIdx + 1}
            onCellTap={(segIdx) => {
              if (persona) props.onCellTap(persona.id, segIdx);
            }}
            onRowLabelTap={() => {
              if (persona) props.onRowLabelTap(persona.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * HeatmapDrawer — 10×N CSS Grid heatmap with drawer mechanism.
 *
 * Desktop: inline grid-template-rows 0fr→1fr transition (250ms).
 * Mobile (<768px): Radix Sheet with side="bottom", max-height 70dvh.
 *
 * Color-blind mode: CSS class toggle on GridBody root.
 * The `.heatmap-pattern-cb .heatmap-cell` diagonal-stripe rule lives in globals.css.
 */
export function HeatmapDrawer(props: HeatmapDrawerProps) {
  const isMobile = useIsMobile();
  const [colorBlindMode, setColorBlindMode] = useState(false);

  const affordanceLabel = props.isOpen ? 'Hide personas' : 'Show personas';
  const personaCount = props.rowStates.length || 10;

  const AffordanceButton = (
    <button
      type="button"
      onClick={() => props.onOpenChange(!props.isOpen)}
      className="flex w-full items-center justify-between gap-2 rounded-[8px] border border-white/[0.06] px-2.5 py-1.5 text-xs transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]"
      style={{ background: 'rgba(255,255,255,0.03)' }}
      aria-expanded={props.isOpen}
      aria-controls="audience-heatmap-grid"
    >
      <span className="flex items-center gap-2">
        <span className="font-medium">{affordanceLabel}</span>
        <span className="opacity-50">·</span>
        <span className="opacity-60 tabular-nums">{personaCount}</span>
      </span>
      {props.isOpen ? <CaretUp size={12} aria-hidden="true" className="opacity-70" /> : <CaretDown size={12} aria-hidden="true" className="opacity-70" />}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {AffordanceButton}
        <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
          <SheetContent
            side="bottom"
            className="max-h-[70dvh] overflow-auto bg-[#18191a]"
          >
            <SheetHeader>
              <SheetTitle>Audience personas</SheetTitle>
              <button
                type="button"
                onClick={() => setColorBlindMode((m) => !m)}
                className="text-xs underline"
              >
                {colorBlindMode ? 'Standard' : 'Color-blind'} mode
              </button>
            </SheetHeader>
            <div id="audience-heatmap-grid">
              <GridBody {...props} colorBlindMode={colorBlindMode} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: inline grid-template-rows transition
  return (
    <div>
      {AffordanceButton}
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateRows: props.isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="min-h-0">
          <button
            type="button"
            onClick={() => setColorBlindMode((m) => !m)}
            className="mb-2 text-xs underline"
            aria-pressed={colorBlindMode}
          >
            {colorBlindMode ? 'Standard' : 'Color-blind'} mode
          </button>
          <div id="audience-heatmap-grid">
            <GridBody {...props} colorBlindMode={colorBlindMode} />
          </div>
        </div>
      </div>
    </div>
  );
}
