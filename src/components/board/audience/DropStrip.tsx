'use client';
import { KeyframeImage } from '../_kit';
import type { DropMoment } from './audience-derive';

export interface DropStripProps {
  /** Key drop moments (biggest drop + next-worst), already time-ordered. */
  moments: DropMoment[];
}

/**
 * "Where they drop" — an always-visible row of real video keyframes at the key
 * retention drops, placed directly under the hero insight. Each cell shows the
 * frame + its mm:ss timecode; the single biggest drop gets the coral `marked`
 * outline and a "−NN%" badge. Energy is graded down from worst→milder so the
 * eye lands on the worst moment first.
 *
 * This component is ONLY mounted when real filmstrips exist (the gate lives in
 * AudienceNode) — in text/url/no-video modes the strip never renders, so there
 * is no empty state and no layout shift.
 */
export function DropStrip({ moments }: DropStripProps) {
  if (moments.length === 0) return null;

  return (
    <div data-testid="drop-strip">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
        Where they drop
      </div>
      <div className="grid grid-cols-3 gap-2">
        {moments.map((m) => (
          <KeyframeImage
            key={m.index}
            src={m.url}
            ratio="wide"
            alt={`Drop at ${m.timecode}`}
            timecode={m.timecode}
            badge={m.deltaPct > 0 ? `−${m.deltaPct}%` : undefined}
            marked={m.worst}
            energy={m.worst ? 0.85 : 0.55}
          />
        ))}
      </div>
    </div>
  );
}
