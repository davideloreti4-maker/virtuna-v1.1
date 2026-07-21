'use client';

/**
 * VideoTestCardRenderer — the /test in-thread CRAFT teardown (TEST-01). "The editor's cut."
 *
 * A frame-by-frame read of how well-MADE the creator's video is, rendered FULLY in-thread
 * (owner: "all skills 1:1 in thread"). Reworked 2026-07-21 for the Test/Simulation split
 * (docs/HANDOFF-2026-07-21-test-card-rework.md): the old thin verdict card that navigated out
 * to /analyze is gone. This card owns CRAFT — hook mechanics, pacing/edit, framing, delivery,
 * the fixes, the filmstrip — and hands RECEPTION (retention curve, the crowd, reach, who-stops)
 * to the separate Simulation surface via the ONE door out, "Simulate it →".
 *
 * Sections, top to bottom (mirrors the approved mockup):
 *   1. Header    — the craft score ring (owner-locked KEEP the number) + the craft-driver bars.
 *   2. Filmstrip — their video frame by frame; the cold open marked sage asset, the weak beat amber.
 *   3. Ledger    — working ✓ (sage) / not-working ✕ (coral, near-zero dosage).
 *   4. Fixes     — the director's notes: their FRAME → diagnosis → a NEUTRAL "why" → the move →
 *                  an optional PROVEN corpus receipt (top fixes only; honest absence otherwise).
 *   5. Seam      — "Simulate it →" (→ /analyze/[id] until the Sim surface ships) + Save.
 *
 * Honesty spine: keyframe URLs are ephemeral (CoverFill degrades each to a play-tile); the corpus
 * proof reuses the shared <ProofReceipt> under the warrant contract. Design system = flat-warm
 * charcoal (bg-surface-sunken fill · 6% borders · sage=working · amber=weak · coral near-zero).
 */

import type { VideoTestCardBlock } from '@/lib/tools/blocks';
import { TrustBadge } from '@/components/audience/trust-badge';
import { SaveAffordance } from '@/components/thread/save-affordance';
import { ProofReceipt } from './proof-receipt';
import { CoverFill } from '@/components/primitives/CoverFill';
import { CardPrimaryAction, CardActionBar, SECTION_LABEL } from './card-primitives';

export interface VideoTestCardRendererProps {
  block: VideoTestCardBlock;
}

/** seconds → "M:SS" clock label (client mirror of the mapper's formatter). */
function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The ring hue by craft grade — sage (well-made) → amber → coral, coral kept to the lowest band. */
function ringColor(score: number): string {
  if (score >= 70) return 'var(--color-positive)';
  if (score >= 45) return 'var(--color-warning)';
  return 'var(--color-accent)';
}

/** A driver bar's fill by band — strong sage, mid muted cream, weak amber (never the coral accent). */
function driverBar(band: 'strong' | 'mid' | 'weak'): string {
  if (band === 'strong') return 'bg-[var(--color-positive)]';
  if (band === 'weak') return 'bg-[var(--color-warning)]';
  return 'bg-foreground-muted';
}

/** A 9:16 video frame tile (their frame), degrading to a play-tile when the signed URL is absent. */
function FrameTile({
  url,
  atMs,
  widthClass,
  borderClass = 'border-white/[0.06]',
}: {
  url: string | null;
  atMs?: number | null;
  widthClass: string;
  borderClass?: string;
}) {
  return (
    <span
      className={`relative block ${widthClass} aspect-[9/16] shrink-0 overflow-hidden rounded-md border ${borderClass}`}
    >
      <CoverFill coverUrl={url} playSize={14} />
      {atMs != null && (
        <span className="absolute bottom-1 left-1 rounded-xs bg-black/50 px-1 py-px text-[9px] tabular-nums text-foreground-secondary">
          {fmtClock(atMs / 1000)}
        </span>
      )}
    </span>
  );
}

export function VideoTestCardRenderer({ block }: VideoTestCardRendererProps) {
  const {
    craftScore,
    drivers = [],
    filmstrip = [],
    dropLabel,
    durationLabel,
    working = [],
    notWorking = [],
    fixes = [],
    audienceName,
    analysisId,
    tier,
  } = block.props;

  const CIRC = 2 * Math.PI * 33; // ring radius 33
  const hasHeader = craftScore != null || drivers.length > 0;

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-sunken"
      aria-label={`Video craft test for ${audienceName}`}
    >
      {/* ── HEADER — craft ring + driver bars ── */}
      <div className="px-4 pt-4 pb-4">
        <div className="mb-4 flex items-center gap-2">
          <span className={SECTION_LABEL}>Test</span>
          <span className="h-1 w-1 rounded-full bg-foreground-muted" aria-hidden="true" />
          <span className={SECTION_LABEL}>frame-by-frame read</span>
          <span className="ml-auto">
            <TrustBadge tier={tier} />
          </span>
        </div>

        {hasHeader && (
          <div className="flex items-center gap-4">
            {craftScore != null && (
              <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={`Craft score ${craftScore} of 100`}>
                <svg width="76" height="76" viewBox="0 0 76 76" className="block -rotate-90">
                  <circle cx="38" cy="38" r="33" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle
                    cx="38"
                    cy="38"
                    r="33"
                    fill="none"
                    stroke={ringColor(craftScore)}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - craftScore / 100)}
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-px">
                  <span className="text-[27px] font-semibold leading-none tabular-nums text-foreground">{craftScore}</span>
                  <span className="text-[8.5px] uppercase tracking-[0.05em] text-foreground-muted">Craft</span>
                </span>
              </div>
            )}
            {drivers.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
                {drivers.map((d) => (
                  <div key={d.name} className="flex items-center gap-2.5">
                    <span className="w-[74px] shrink-0 text-[12px] capitalize text-foreground-secondary">{d.name}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <span className={`block h-full rounded-full ${driverBar(d.band)}`} style={{ width: `${d.score}%` }} />
                    </span>
                    <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-foreground">{d.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {hasHeader && (
          <p className="mt-3.5 text-[11.5px] text-foreground-muted">
            Retention &amp; reach aren&rsquo;t craft — they&rsquo;re measured in{' '}
            <span className="text-foreground-secondary">Simulate</span>.
          </p>
        )}
      </div>

      {/* ── FILMSTRIP — their video, frame by frame ── */}
      {filmstrip.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          <p className={`${SECTION_LABEL} mb-3.5`}>Your video, frame by frame</p>
          <div className="overflow-x-auto pb-0.5">
            <div className="flex min-w-min gap-[7px]">
              {filmstrip.map((f) => (
                <div key={f.idx} className="w-[58px] shrink-0">
                  <FrameTile
                    url={f.keyframeUrl}
                    atMs={f.atMs}
                    widthClass="w-[58px]"
                    borderClass={
                      f.mark === 'asset'
                        ? 'border-[var(--color-positive)]/50'
                        : f.mark === 'weak'
                          ? 'border-[var(--color-warning)]/55'
                          : 'border-white/[0.06]'
                    }
                  />
                  <div className="mt-1.5 text-center">
                    <div className="text-[10.5px] capitalize text-foreground-secondary">{f.label}</div>
                    {f.mark && (
                      <div
                        className={`mt-0.5 text-[9px] uppercase tracking-[0.05em] ${
                          f.mark === 'asset' ? 'text-[var(--color-positive)]' : 'text-[var(--color-warning)]'
                        }`}
                      >
                        {f.mark === 'asset' ? '● asset' : '▲ weak beat'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {(durationLabel || dropLabel) && (
            <div className="mt-3 flex justify-between text-[10.5px] tabular-nums text-foreground-muted">
              <span>0:00</span>
              {dropLabel && <span className="text-[var(--color-warning)]">▲ {dropLabel}</span>}
              <span>{durationLabel ?? ''}</span>
            </div>
          )}
        </div>
      )}

      {/* ── WORKING / NOT-WORKING ledger ── */}
      {(working.length > 0 || notWorking.length > 0) && (
        <div className="border-t border-white/[0.06] px-4 py-4">
          <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 min-[440px]:gap-0">
            <div className="min-[440px]:pr-4.5">
              <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-positive)]">
                <span aria-hidden="true">✓</span> Working
              </div>
              <ul className="flex flex-col gap-2">
                {working.map((w, i) => (
                  <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-foreground-secondary">
                    <span className="mt-px shrink-0 text-[var(--color-positive)]" aria-hidden="true">✓</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-white/[0.06] pt-3.5 min-[440px]:border-l min-[440px]:border-t-0 min-[440px]:pl-4.5 min-[440px]:pt-0">
              <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-accent-text)]">
                <span aria-hidden="true">!</span> Not working
              </div>
              <ul className="flex flex-col gap-2">
                {notWorking.map((n, i) => (
                  <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-foreground-secondary">
                    <span className="mt-px shrink-0 text-[var(--color-accent-text)]" aria-hidden="true">✕</span>
                    <span>
                      {n.text}
                      {n.atMs != null && (
                        <span className="ml-1 tabular-nums text-foreground-muted">@{fmtClock(n.atMs / 1000)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── THE DIRECTOR'S FIXES ── */}
      {fixes.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-4">
          <div>
            <p className={SECTION_LABEL}>The director&rsquo;s fixes</p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground-muted">
              A proven corpus example appears where one really fits — not forced onto every note.
            </p>
          </div>
          {fixes.map((fix, i) => (
            <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.018] p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[11px] font-bold tabular-nums text-foreground-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[13.5px] font-semibold text-foreground">{fix.title}</span>
                {fix.lever && (
                  <span className="ml-auto rounded-full border border-white/[0.06] px-2 py-0.5 text-[10.5px] text-foreground-secondary">
                    {fix.lever}
                  </span>
                )}
              </div>

              <div className="mb-3 flex gap-3">
                {fix.keyframeUrl != null && (
                  <FrameTile url={fix.keyframeUrl} atMs={fix.atMs} widthClass="w-[46px]" />
                )}
                <p className="text-[13px] leading-relaxed text-foreground-secondary">{fix.diagnosis}</p>
              </div>

              {fix.why && (
                <div className="mb-3 flex gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.022] px-3 py-2.5">
                  <span className="mt-px shrink-0 text-[11px] font-bold uppercase tracking-[0.05em] text-foreground-muted">
                    Why
                  </span>
                  <p className="text-[12px] leading-relaxed text-foreground-secondary">{fix.why}</p>
                </div>
              )}

              {fix.move && (
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="shrink-0 text-foreground-muted" aria-hidden="true">→</span>
                  <span className="text-[13.5px] font-medium leading-snug text-foreground">{fix.move}</span>
                </div>
              )}

              {fix.proof && <ProofReceipt proof={fix.proof} eyebrow="Proven · corpus" />}
            </div>
          ))}
        </div>
      )}

      {/* ── SEAM — the one door out (Simulation owns reception) ── */}
      <p className="px-4 pt-3 text-center text-[12px] leading-relaxed text-foreground-muted">
        The craft is here. How your audience actually reacts — the crowd, the drop-off, the reach —
        lives in the simulation.
      </p>
      <CardActionBar>
        <CardPrimaryAction href={`/analyze/${analysisId}`}>
          Simulate with your audience →
        </CardPrimaryAction>
        <SaveAffordance
          className="ml-auto"
          item_type="read"
          title={`${craftScore != null ? `Craft ${craftScore}` : 'Craft read'} · ${audienceName}`}
          snapshot={block.props}
        />
      </CardActionBar>
    </div>
  );
}
