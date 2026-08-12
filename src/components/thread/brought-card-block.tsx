'use client';

/**
 * BroughtCardRenderer — the ＋ door's card: something the CREATOR brought, and how the room read it.
 *
 * Every other card in the thread is an artifact a skill produced. This one is a hook / script /
 * caption that arrived from outside the product through "＋ Test something of your own", so its
 * kicker says so ("YOU BROUGHT THIS") and it carries no rank, no mechanism and no forward chain:
 * there is no batch it won and no reasoning anyone derived. What it carries is the run — the
 * behaviour that was scored, the room's measured fraction, the lead verbatim, and (when the ARM
 * screen asked about one slice) that slice's own number beside the room's.
 *
 * It also exists for a structural reason spelled out in blocks.ts: `/api/tools/react` persists a
 * SEAL, and a seal is only ever read through a DESCRIPTOR built from a rendered card block. No
 * block ⇒ no descriptor ⇒ the sealed row renders nowhere. This block is what makes a brought
 * stimulus land on the board at all.
 *
 * THREAD-04: the route emits validated props only; this component owns layout.
 */

import type { BroughtCardBlock } from '@/lib/tools/blocks';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { ProofUnit } from './proof-unit';
import { CardEyebrow, SECTION_LABEL } from './card-primitives';
import { BAND_COLOR } from './band-block';

/**
 * The verb the count is stated in, per lens. The engine emits its fraction as "N/10 stop" whatever
 * lens ran, so wording every card "stopped" would silently re-state a `finish` or `buy` run as a
 * scroll-stop claim it never made (the ProofUnit `verb` lesson, applied to the dial ⑤ now sends).
 */
const LENS_VERB: Record<BroughtCardBlock['props']['lens'], string> = {
  stop: 'stopped',
  finish: 'watched it through',
  share: 'would send it on',
  follow: 'would follow you',
  buy: 'would act on it',
};

/** What the creator called it at the door — the chip beside the kicker. */
const KIND_LABEL: Record<BroughtCardBlock['props']['kind'], string> = {
  draft: 'draft',
  hook: 'hook',
  idea: 'idea',
  script: 'script',
};

export interface BroughtCardRendererProps {
  block: BroughtCardBlock;
}

export function BroughtCardRenderer({ block }: BroughtCardRendererProps) {
  const { stimulus, kind, lens, band, fraction, scrollQuote, scene, slice, personas, population } =
    block.props;

  return (
    <div
      className="elev-rest overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      data-testid="brought-card"
      data-lens={lens}
      aria-label={`You brought: ${stimulus.slice(0, 60)}`}
    >
      <div className="flex flex-col gap-3 px-4 pb-4 pt-4">
        {/* Meta = the kind alone. The scene ("scrolling the FYP") used to ride here too, which
            crowded the row into a two-line wrap at card width; it now rides the provenance line
            below, next to the read it describes. */}
        <CardEyebrow
          kicker="You brought this"
          dotColor={BAND_COLOR[band]}
          meta={<span className={SECTION_LABEL}>{KIND_LABEL[kind]}</span>}
        />

        {/* The stimulus — content under test, so it reads at full strength. Sans, not serif: this
            is the creator's own text, not one of the app's voice moments. `whitespace-pre-wrap`
            because a pasted script arrives with its line breaks and they are part of the draft. */}
        <p className="whitespace-pre-wrap text-reading leading-relaxed text-foreground">{stimulus}</p>

        {/* The room's measured read — one fraction, stated in the lens's own verb. */}
        <ProofUnit
          framed={false}
          band={band}
          fraction={fraction}
          verb={LENS_VERB[lens]}
          quote={scrollQuote}
          flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
          conceptText={stimulus}
          population={population}
          // NO `rewrite`. The Lens's "Rewrite for this audience →" re-POSTs to the ORIGINATING
          // skill's runner, and a brought draft has no originating skill — wiring it to `hooks`
          // (the nearest fit) would spend a credit turning the creator's own script into a
          // generated hook and call that a rewrite of this card. Omitted ⇒ the Lens simply shows
          // no sticky CTA, which is the documented honest degrade.
          label="See how the room reacted to this"
        />

        {/* A sliced run asked a different question than the room read, so BOTH numbers ride here:
            the slice's own rate (what the board row shows, labelled) and the room's fraction above
            (what the panel measured). Neither is presented as the other — and when the slice could
            NOT be answered the card says that, instead of letting the room's number pass for it. */}
        {slice ? (
          <p className="text-label text-foreground-muted" data-testid="brought-card-slice">
            Asked about <span className="text-foreground-secondary">{slice.label}</span>:{' '}
            {slice.honored ? (
              <>
                <span className="tabular-nums text-foreground-secondary">{slice.stopPct}%</span> of
                that <span className="tabular-nums">{(slice.total ?? 0).toLocaleString('en-US')}</span>
                -strong slice. The fraction above is your whole audience.
              </>
            ) : (
              <>
                not read: {slice.reason ?? 'this audience cannot be projected into slices yet'}. The
                fraction above is your whole audience, which is a different question.
              </>
            )}
          </p>
        ) : null}

        {/* Provenance, demoted to one quiet line — plain words, not the model's internal name
            (the same jargon the Make faces shed). `personas` presence is what the Lens opens on;
            it is never claimed here beyond the count already stated. */}
        <p className="text-label text-foreground-muted/70">
          Simulated · {personas?.length ?? 0} reactions{scene ? ` · ${scene}` : ''}
        </p>
      </div>
    </div>
  );
}
