'use client';

/**
 * RemixCardRenderer — decode → adapt → FILM (THREAD-04 / D-05).
 *
 * Radical rework (owner 2026-07-22): the card used to stack reference boxes (why the original
 * worked) above a lone adapted line, and told you nothing about executing YOUR version. It is
 * now a decode→adapt MAP — a two-column matrix that maps each element of the original (why it
 * worked, muted-left) to your version (the deliverable, foreground-right) — ending in a
 * ready-to-film shoot plan for the adapted format. The remix's moat (D-05) is now legible as a
 * learn-from-it → make-yours pipeline, not a wall of teardown.
 *
 *  - Flat matte, warm-cream, band color used once (the ProofUnit dot), sage/soft-coral palette.
 *  - Hero: adaptedHook (serif + Copy) — the header contract, 2026-08-02. It used to live in the
 *    right cell of map row 1, so the card opened on someone else's post.
 *  - Row map: Their hook (hookPattern, full width now its pair is the hero) · The turn (theTurn →
 *    angle) · Format (formatBorrowed → your shots). Structure + Emotional beat stay on the expand.
 *  - "How to film your version" foot block (production) mirrors the Script card.
 *  - ONE shared <SimDoor> (2026-08-02: replaces the on-face ProofUnit — a projected card
 *    carries no verdict apparatus; a legacy measured card keeps its "adapted hook" fraction).
 *  - ONE cream primary = the forward chain step "Write hooks for this →"; Save = icon.
 *
 * THREAD-04: the model emits validated RemixCardBlock props only; THIS component owns layout.
 */

import { useContext, useState } from 'react';
import { VideoCamera, Play, ArrowUpRight } from '@phosphor-icons/react';
import type { RemixCardBlock } from '@/lib/tools/blocks';
import { useOnDevelopRemix } from '@/lib/remix-develop-context';
import { PlatformContext } from '@/lib/platform-context';
import { cardScrollQuoteReactions } from '@/components/audience-lens/flat-card-reactions';
import { buildCardRewrite } from '@/components/audience-lens/card-rewrite';
import { SimDoor } from './sim-door';
import { RemixBeats } from './remix-beats';
import { CoverFill } from '@/components/primitives/CoverFill';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { CardPrimaryAction, CardActionBar, CardHero, CopyAffordance, SECTION_LABEL } from './card-primitives';
import { CaretToggle } from './caret-toggle';

export interface RemixCardRendererProps {
  block: RemixCardBlock;
  /** Optional: wired by Plan 06-05 to trigger remix→hooks chain handoff (anchorFrom:'card').
   *  When absent, reads from RemixDevelopContext; falls back to stub if neither present. */
  onDevelop?: () => void;
  /**
   * Shoot-sheet data supplied directly — the /dev/cards path only. A COMPONENT prop, deliberately
   * NOT a `block.props` field: those are zod-validated and model-emittable, and the sheet must
   * never be something a model can hand the card.
   *
   * Exists because the gallery could not show the sheet at all. `RemixBeats` fetches by
   * `blueprintId`, the fixture has none, so the section silently vanished and /dev/cards rendered
   * the pre-lane card — measured live 2026-08-12. See `RemixBeats.initialData`.
   */
  beatsPreview?: React.ComponentProps<typeof RemixBeats>["initialData"];
}

export function RemixCardRenderer({
  block,
  onDevelop: onDevelopProp,
  beatsPreview,
}: RemixCardRendererProps) {
  const {
    adaptedHook,
    angle,
    whoItsFor,
    formatBorrowed,
    blueprintId,
    blueprintVariant,
    sourceDecode,
    band,
    fraction,
    scrollQuote,
    coverUrl,
    proof,
    production,
    population,
    provenance,
  } = block.props;

  // New Qwen call system (2026-07-22): a "projected" card's adapted-hook band/fraction/quote are the
  // adapt call's generation-time estimate — no persona SIM ran. It must NOT claim a measured
  // reaction: the proof unit reads in the conditional ("would stop") and the provenance tag says
  // "projected", not "SIM-1 Flash". "See the room →" measures it. Absent ⇒ legacy MEASURED (back-compat).
  const projected = provenance === 'projected';

  const onDevelopCtx = useOnDevelopRemix();
  const platform = useContext(PlatformContext) ?? 'tiktok';

  const onDevelop = onDevelopProp ?? (onDevelopCtx
    ? () => onDevelopCtx(adaptedHook, platform)
    : undefined);

  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="elev-rest @container overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Remix: ${adaptedHook.slice(0, 60)}`}
    >
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
        {/* HERO — the adapted hook, on the shared <CardHero> row (the header contract, 2026-08-02).
            It used to be buried in the right cell of map row 1, which meant the card opened on its
            SOURCE (someone else's post) and the creator's own deliverable came third. The remix's
            output is a line you lift, exactly like the hook card's, so it leads and carries Copy.
            The map keeps the decode; row 1 is now a full-width "Their hook" so the adapted line is
            not printed twice. */}
        <CardHero
          affordance={
            <CopyAffordance text={adaptedHook} aria-label="Copy adapted hook to clipboard" />
          }
        >
          {adaptedHook}
        </CardHero>

        {/* Source strip — the post this remix adapts, ATTRIBUTED. A flat one-line row, not the
            boxed compact receipt: the box hugged its content and left the rest of the head band
            empty (the near-empty-strip pattern the owner keeps flagging). The reference reads as
            a quiet attribution line; the map below is the hero. */}
        {proof ? (
          <SourceStrip proof={proof} />
        ) : coverUrl ? (
          <div
            className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
            aria-label="The original post this remix borrows from"
            title="Remixing this post"
          >
            <span className="relative block aspect-[9/16] w-10 shrink-0 overflow-hidden rounded-sm border border-white/[0.06]">
              <CoverFill coverUrl={coverUrl} playSize={12} />
            </span>
            <span className={SECTION_LABEL}>The post you&rsquo;re remixing</span>
          </div>
        ) : null}

        {/* DECODE → ADAPT MAP — the card's hero and its D-05 moat, made legible. Each ROW maps
            one element of the ORIGINAL (why it worked, muted) to YOUR VERSION (the deliverable,
            foreground). Sized by the CARD via container query (@min), never the viewport: a
            342px card can sit in a wide viewport, where an `sm:` grid split it into starved
            columns — and worse, the single-column order interleaved the old column headers so
            "Your version" captioned the original's cell. Pairs now stack together. */}
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          {/* Row 1 — Their hook, FULL WIDTH. The paired "Your hook" cell is gone: its content
              (adaptedHook + Copy) is the card's hero now, and printing the deliverable twice on
              one card is the repeat the owner keeps flagging. What survives is the decode this
              row exists for — the PATTERN the original ran, which the hero is the answer to. */}
          {sourceDecode && (
            <MapRow
              leftLabel="Their hook"
              left={<p className="text-body leading-relaxed text-foreground-muted">{sourceDecode.hookPattern}</p>}
            />
          )}

          {/* Row 2 — The turn: original reversal → your angle. A drop-seeded card has no
              decode (sourceDecode absent — the corpus row's pattern lives on the receipt's
              madlib line instead), so the row keeps only YOUR half rather than fabricating
              a "Their turn" cell. */}
          {sourceDecode ? (
            <MapRow
              leftLabel="Their turn"
              left={<p className="text-body leading-relaxed text-foreground-muted">{sourceDecode.theTurn}</p>}
              rightLabel="Your angle"
              right={<p className="text-body leading-relaxed text-foreground-secondary">{angle}</p>}
            />
          ) : (
            <MapRow
              leftLabel="Your angle"
              left={<p className="text-body leading-relaxed text-foreground-secondary">{angle}</p>}
            />
          )}

          {/* Row 3 — Format: borrowed pattern → your shots */}
          <MapRow
            last
            leftLabel="Their format"
            left={<p className="text-body leading-relaxed text-foreground-muted">{formatBorrowed}</p>}
            rightLabel="Your shots"
            right={
              <p className="text-body leading-relaxed text-foreground-secondary">
                {production ? production.shots : `Recreate the ${formatBorrowed.toLowerCase()} for your angle.`}
              </p>
            }
          />
        </div>

        {/* Expand toggle — the rest of the decode anatomy, named for the value it reveals:
            how the original is built (structure) and the feeling it lands (emotional beat).
            No decode (drop-seeded card) → no door to nothing. */}
        {sourceDecode && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 self-start text-label text-foreground-muted transition-colors hover:text-foreground-secondary"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse how the original is built' : 'Expand how the original is built'}
          >
            <CaretToggle open={expanded} />
            How the original is built
          </button>
        )}

      </div>

      {/* HOW TO FILM YOUR VERSION — the ready-to-film payoff (owner 2026-07-22). Mirrors the
          Script card's production block: the shoot checklist for the adapted format. The map's
          "Your shots" row already leads with the shot list; this carries the rest (on-screen
          text · setup · edit). Absent → nothing (honesty; inert until the runner emits it). */}
      {production && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <VideoCamera size={13} weight="fill" className="shrink-0 text-foreground-secondary opacity-70" aria-hidden="true" />
            <p className={SECTION_LABEL}>How to film your version</p>
          </div>
          <dl className="mt-2 flex flex-col gap-1.5">
            {[
              // `shots` is DELIBERATELY absent: the map's "Your shots" cell above already prints
              // this exact string, and printing it twice on one card was measured verbatim
              // (2026-08-13, /dev/cards at 390 and 1440 — the two copies sit ~5 lines apart on
              // desktop). The block comment above has described this split since it was written;
              // only the code disagreed.
              { term: 'On-screen text', value: production.onScreenText },
              { term: 'Setup', value: production.setup },
              ...(production.edit ? [{ term: 'Edit', value: production.edit }] : []),
            ].map((row) => (
              <div key={row.term} className="flex gap-2 text-label leading-relaxed">
                <dt className="w-[92px] shrink-0 text-foreground-muted">{row.term}</dt>
                <dd className="min-w-0 flex-1 text-foreground-secondary">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* THE SHOOT SHEET — the beat-by-beat rows, fetched (phase 1, 2026-08-10).
          `blueprintVariant`, NOT 0. ONE remix_blueprints row serves ALL of a run's ranked cards
          — one source video, one skeleton, N adapted scripts — so the id alone does not say which
          script is this card's. Hard-coded, cards 2 and 3 print the rank-1 sheet: a plausible
          sheet, not a visible bug, and no test that renders one card in isolation can see it.
          Absent ⇒ 0, which is right for the single-card case and for every pre-lane block. */}
      {(blueprintId || beatsPreview) && (
        <RemixBeats
          blueprintId={blueprintId ?? "preview"}
          variantIndex={blueprintVariant ?? 0}
          initialData={beatsPreview}
        />
      )}

      {/* EXPAND — the rest of the decode anatomy (hook pattern + the turn already lead the map). */}
      {expanded && sourceDecode && (
        <div className="flex flex-col gap-4 border-t border-white/[0.06] px-4 py-3">
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Structure</p>
            <p className="text-reading leading-relaxed text-foreground-secondary">{sourceDecode.structure}</p>
          </div>
          <div>
            <p className={`mb-1 ${SECTION_LABEL}`}>Emotional beat</p>
            <p className="text-reading leading-relaxed text-foreground-secondary">{sourceDecode.emotionalBeat}</p>
          </div>
        </div>
      )}

      {/* AUDIENCE BAND — who your version lands on (whoItsFor, folded out of its loose caption)
          and the door that measures it. A legacy measured card keeps its real adapted-hook
          fraction (honesty-scoped); a projected card states the aim only. */}
      <SimDoor
        projected={projected}
        aimText={whoItsFor}
        band={band}
        fraction={fraction}
        suffix="adapted hook"
        flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}
        conceptText={adaptedHook}
        population={population}
        platform={platform}
        rewrite={buildCardRewrite({
          skill: 'remix',
          fraction,
          scrollQuote,
          conceptText: adaptedHook,
          platform,
          leverRidesAnchor: true,
        })}
        label={projected ? 'Simulate this adapted hook with your audience' : 'See how your audience reacted to this adapted hook'}
      />

      {/* Actions — one cream primary (forward chain "Write hooks for this →") + Save icon. */}
      <CardActionBar>
        <CardPrimaryAction
          onClick={onDevelop}
          disabled={!onDevelop}
          aria-label="Develop this remix concept into hooks"
          title={onDevelop ? 'Develop this remix into hooks' : 'Wired in Plan 06-05'}
        >
          Write hooks for this →
        </CardPrimaryAction>

        {/* A remix IS an adapted hook, but it is not a hook: it carries the decode→adapt matrix
            and its forward step is "write hooks for this", not "write a script". Saving it as
            item_type "hook" (which it did until 2026-08-02, for want of a remix type) made the
            shelf label it "Hook" and offer it the hook action. `remix` is now a real type. */}
        <SaveAffordance className="ml-auto" item_type="remix" title={adaptedHook} snapshot={block.props} />
      </CardActionBar>
    </div>
  );
}

/** One row of the decode→adapt map: the original's element beside (wide card) or above (narrow
 *  card) your version. The split keys on the CARD's width via container query — a media query
 *  cannot see the constraint that matters (a 342px card inside an arbitrary viewport).
 *
 *  Omit `right`/`rightLabel` for a FULL-WIDTH single cell (row 1 "Their hook", whose paired
 *  deliverable moved to the card hero) — a half-empty pair cell reads as missing data. */
function MapRow({
  leftLabel,
  left,
  rightLabel,
  right,
  last,
}: {
  leftLabel: string;
  left: React.ReactNode;
  rightLabel?: string;
  right?: React.ReactNode;
  last?: boolean;
}) {
  const divider = last ? '' : 'border-b border-white/[0.06]';

  if (right == null) {
    return (
      <div className={`px-3.5 py-3 ${divider}`}>
        <p className={`mb-1 ${SECTION_LABEL}`}>{leftLabel}</p>
        {left}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 @min-[480px]:grid-cols-2 ${divider}`}>
      <div className="px-3.5 py-3">
        <p className={`mb-1 ${SECTION_LABEL}`}>{leftLabel}</p>
        {left}
      </div>
      {/* The intra-PAIR divider is lighter than the between-ROW divider (0.03 vs 0.06). Below
          480px the grid collapses and both were 0.06, so "Their turn / Your angle / Their format
          / Your shots" read as four peer rows and the decode→adapt MAPPING — the card's whole
          claim — was invisible on every phone. Measured 2026-08-13 at a native 390px context.
          Weight, not colour: the accent dosage is locked and a map is not a meaning-moment. */}
      <div className="border-t border-white/[0.03] px-3.5 py-3 @min-[480px]:border-l @min-[480px]:border-white/[0.06] @min-[480px]:border-t-0">
        <p className={`mb-1 ${SECTION_LABEL}`}>{rightLabel}</p>
        {right}
      </div>
    </div>
  );
}

/** The source-attribution zone: the post this remix adapts, in the same full-width bordered
 *  tone-zone the card family uses (the hook's Visual box, the receipt). Cover tower + label +
 *  handle + views; links out to the original when the proof carries a URL. */
function SourceStrip({ proof }: { proof: NonNullable<RemixCardBlock['props']['proof']> }) {
  const views =
    proof.views != null
      ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(proof.views)
      : null;

  const body = (
    <>
      {/* The source video, at a size you can actually read. It was `w-10` (measured 40×71 on a
          338px card) — a postage stamp that read as decoration, and the ONLY representation of
          the video on a 1708px-tall card. */}
      <span className="relative block aspect-[9/16] w-14 shrink-0 overflow-hidden rounded border border-white/[0.06]">
        <CoverFill coverUrl={proof.coverUrl} playSize={14} />
        {/* The play badge is a SIBLING, deliberately not a CoverFill change: CoverFill stacks its
            own Play glyph UNDERNEATH the cover, so the glyph is only ever visible when the cover
            is missing or expired (measured `coveredByImg: true`). That is backwards here — a
            loaded cover is exactly when the creator needs to be told this is a video they can
            open. CoverFill is shared (Account Read covers, Discover tiles); the caller changes.
            No accent: the dosage rule is LOCKED and this is chrome, not meaning. */}
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/35"
          aria-hidden="true"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-foreground">
            <Play size={11} weight="fill" />
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={SECTION_LABEL}>The post you&rsquo;re remixing</span>
        <span className="text-body leading-snug">
          <span className="font-medium text-foreground-secondary">@{proof.handle}</span>
          {views && <span className="text-foreground-muted"> · {views} views</span>}
        </span>
        {/* Says what the click DOES. The strip has been an <a> since 51fadaf7 (2026-08-02), but
            nothing on it said so — no underline, no icon, no rest-state cue — so a handoff written
            11 days later still recorded it as an inert thumbnail. An affordance nobody can see is
            indistinguishable from one that isn't there. */}
        {proof.videoUrl && (
          <span className="mt-0.5 flex items-center gap-1 text-label text-foreground-muted">
            Watch the original
            <ArrowUpRight size={11} weight="bold" className="shrink-0" aria-hidden="true" />
          </span>
        )}
      </span>
    </>
  );

  const zoneClass =
    'flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5';

  if (proof.videoUrl) {
    return (
      <a
        href={proof.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${zoneClass} transition-colors hover:border-white/[0.10]`}
        title="Open the post you're remixing"
        aria-label={`The post you're remixing: @${proof.handle}`}
      >
        {body}
      </a>
    );
  }
  return (
    <div className={zoneClass} aria-label={`The post you're remixing: @${proof.handle}`}>
      {body}
    </div>
  );
}
