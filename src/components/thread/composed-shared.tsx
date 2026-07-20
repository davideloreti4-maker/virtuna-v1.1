'use client';

/**
 * Shared fragments of THE STREAM renderer family (composed-block / composed-cards).
 * Rev 8: structured result groups render in the make-family CARD language; these are
 * the light fragments both halves share. Design contract: stream-concept-rev8
 * (docs/prototypes/) — five-size ladder, band color once, matte.
 */

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { BookmarkSimple, ChatCircle, Heart, ShareNetwork } from '@phosphor-icons/react';
import { BAND_COLOR } from '@/components/thread/band-block';
import type { StreamBand, StreamProof, StreamVerbatim } from '@/lib/tools/stream-primitives';

// The five-size type ladder (rev 7 margin rail). Nothing else in this family renders.
export const T_META = 'text-xs';
export const T_SUPPORT = 'text-sm';
export const T_BODY = 'text-[15px]';
export const T_HERO = 'text-[17px]';

export const HAIRLINE = 'border-white/[0.06]';

export function BandWord({ band }: { band: StreamBand }) {
  const color = BAND_COLOR[band];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${T_SUPPORT} font-semibold`} style={{ color }}>
      <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {band}
    </span>
  );
}

/** Proof line — band dot+word · neutral fraction · optional room door. Flows left. */
export function ProofLine({ proof }: { proof: StreamProof }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${T_META}`}>
      <BandWord band={proof.band} />
      {proof.fraction && (
        <span className={`${T_SUPPORT} text-foreground-secondary tabular-nums`}>{proof.fraction}</span>
      )}
      {proof.door && <span className="text-foreground-muted">See the room →</span>}
    </div>
  );
}

/** Verbatim — one quote, one speaker. Italic, left-ruled. */
export function VerbatimLine({ verbatim }: { verbatim: StreamVerbatim }) {
  return (
    <div className={`border-l-2 border-white/[0.10] pl-2.5 ${T_SUPPORT} italic text-foreground-secondary`}>
      “{verbatim.quote}” <span className={`not-italic ${T_META} text-foreground-muted`}>— {verbatim.speaker}</span>
    </div>
  );
}

export function Prose({ text, quiet }: { text: string; quiet?: boolean }) {
  return (
    <div className={`md ${T_BODY} ${quiet ? 'text-foreground-secondary' : 'text-foreground'}`}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{text}</ReactMarkdown>
    </div>
  );
}

/** "trap-mistake" → "Trap Mistake". */
export const formatFacet = (slug: string) =>
  slug.includes('-') && !slug.includes(' ')
    ? slug.split('-').map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ')
    : slug;

/** The measured engagement row (the VideoCard 4-col idiom, inline): icon + numeral pairs,
 *  muted — only what was measured renders. */
export function EngagementRow({
  engagement,
  className,
}: {
  engagement: { likes?: string; comments?: string; shares?: string; saves?: string };
  className?: string;
}) {
  const pairs = [
    { icon: Heart, value: engagement.likes, label: 'likes' },
    { icon: ChatCircle, value: engagement.comments, label: 'comments' },
    { icon: ShareNetwork, value: engagement.shares, label: 'shares' },
    { icon: BookmarkSimple, value: engagement.saves, label: 'saves' },
  ].filter((p) => p.value);
  if (pairs.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${T_META} tabular-nums text-foreground-muted${className ? ` ${className}` : ''}`}>
      {pairs.map(({ icon: Icon, value, label }) => (
        <span key={label} className="inline-flex items-center gap-1" aria-label={`${value} ${label}`}>
          <Icon size={12} weight="regular" aria-hidden="true" />
          {value}
        </span>
      ))}
    </span>
  );
}
