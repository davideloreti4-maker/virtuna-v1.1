'use client';

/**
 * LensTrigger — the SINGLE shared entry that mounts the reusable AudienceLens inline on
 * every flat (text) skill surface (D-04: one reusable Lens, not six bespoke surfaces).
 *
 * The four text card-blocks (idea/hook/script/remix) and the shared personas-block (the
 * text Read) all render THIS one affordance. It wires the `onOpen` seam (≥44px tap target,
 * Enter/Space, role=button) over a small "audience" cue and opens the same `<AudienceLens>`
 * in CASCADE mode — flat Shape-B reactions, no `segment_reactions` timeline (D-06): cloud,
 * drill, chat, cluster, Population, Rewrite all available; only segment-by-segment replay is
 * not (there is no real timeline to replay). The video Test surface (09-02) opens the IDENTICAL
 * Lens with a heatmap instead — so all 6 skills share one entry.
 */

import { useState, type CSSProperties, type ReactNode } from 'react';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
import type { PopulationAggregate } from '@/lib/audience/population';
import { AudienceLens, type LensRewrite } from './AudienceLens';

export interface LensTriggerProps {
  /** Flat Shape-B reactions for this card's concept (no timeline → cascade mode). */
  flatPersonas: FlatPersonaReaction[];
  /** The concept text the room reacted to — grounds the "Ask them why →" chat (D-03). */
  conceptText: string;
  /**
   * Audience Sim v2 (Stage 2): the REAL N-individual projection for this card → the Population·
   * 1,000 view. Optional/additive — absent ⇒ the honest-lean rollup swarm (unchanged Sheet).
   */
  population?: PopulationAggregate;
  /** Platform for chat grounding + the Rewrite re-POST (defaults tiktok). */
  platform?: 'tiktok' | 'instagram' | 'youtube';
  /** The Rewrite-for-audience loop for this skill (omitted ⇒ no sticky CTA, D-05). */
  rewrite?: LensRewrite;
  /** Honors the user's OS motion preference. */
  reducedMotion?: boolean;
  /** The clickable cue rendered inline on the card (e.g. a small "See the room" row). */
  children: ReactNode;
  /** Accessible label for the open affordance. */
  label?: string;
  /** Override the clickable wrapper className (e.g. ProofUnit's bordered proof box).
   *  Defaults to the compact inline-cue style. Ignored on the empty-degrade path. */
  className?: string;
  /** Extra styles merged onto the wrapper (minHeight 44 + cursor pointer always applied). */
  style?: CSSProperties;
}

export function LensTrigger({
  flatPersonas,
  conceptText,
  population,
  platform = 'tiktok',
  rewrite,
  reducedMotion = false,
  children,
  label = 'Open the audience reaction',
  className,
  style,
}: LensTriggerProps) {
  const [open, setOpen] = useState(false);

  // No reactions → no affordance (matches PersonaCloud's empty-degrade `return null`).
  if (flatPersonas.length === 0) return <>{children}</>;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        // ≥44px tap target (reuse-contract row 2 / 7).
        style={{ minHeight: 44, cursor: 'pointer', ...style }}
        className={
          className ??
          'flex items-center rounded-[8px] transition-colors hover:bg-[var(--color-hover)]'
        }
      >
        {children}
      </div>

      <AudienceLens
        heatmap={null}
        simResults={undefined}
        flatPersonas={flatPersonas}
        conceptText={conceptText}
        population={population}
        platform={platform}
        rewrite={rewrite}
        reducedMotion={reducedMotion}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
