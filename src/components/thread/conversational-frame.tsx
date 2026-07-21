'use client';

/**
 * Conversational frame (premium thread PR-2) — the voice layer that turns a bare card
 * dump into a dialogue: an **intro** line orients the turn (above the cards), the cards are
 * the artifacts, and the **outro** continues it (the engine's real follow-up + forward chips).
 *
 * Copy floor: `.planning/premium-thread-copy-floor.md §2`. The rule: a templated line is honest
 * when it describes an INPUT (audience, the hook you fed in, the skill) — never an OUTPUT before
 * it exists. So intros ORIENT (audience-only; script cites the input hook); they never cite
 * scores/rank. The OUTRO is NOT templated — it's the engine's `followupText` (already authored +
 * streamed), restyled with a reveal; the chips are derived from REAL card handoffs only.
 *
 * Motion: the intro (plain string) does a true per-word fade (blur→sharp); the outro (markdown)
 * does a block reveal (per-word would break the markdown). Both honor prefers-reduced-motion.
 */

import { Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { CardPrimaryAction } from './card-primitives';
import { FollowupRow } from './followup-row';
import type { ChatFollowup } from '@/lib/tools/chat-followups';

export type ThreadSkill = 'hooks' | 'ideas' | 'script' | 'remix';

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

function truncate(s: string | undefined, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}

/**
 * The intro line — INPUTS ONLY (audience, the input hook, the skill). Renders at submit, never
 * cites results. (Copy floor §2.)
 */
export function introLine(
  skill: ThreadSkill,
  audienceLabel: string,
  platform: string,
  hookLine?: string | null,
): string {
  const who = audienceLabel;
  const where = PLATFORM_LABEL[platform] ?? 'TikTok';
  switch (skill) {
    case 'hooks':
      return `Pulling hooks for ${who} — I'll react each one with your 10 reactors and rank the strongest first.`;
    case 'ideas':
      return `Looking for angles ${who} would actually stop on — scoring each against your 10 reactors.`;
    case 'script':
      return hookLine
        ? `Writing a script from "${truncate(hookLine, 60)}" — then pressure-testing the open against ${who}.`
        : `Writing a script for ${who} — then pressure-testing the open with your 10 reactors.`;
    case 'remix':
      return `Decoding this video, then rewriting it for ${who} on ${where}.`;
  }
}

/**
 * Outro fallback — only used when the engine returned NO followupText. Honest, derived from the
 * top card; returns null when there's no safe line (never fabricate). (Copy floor §2.)
 */
export function outroFallback(skill: ThreadSkill, topRank?: number): string | null {
  if (skill === 'hooks' && topRank != null) {
    return `#${topRank} is your strongest. Want me to turn it into a script?`;
  }
  return null;
}

// ── WordFade — per-word blur→sharp reveal for plain-string voice lines ──────────────

export function WordFade({
  text,
  className,
  startDelayMs = 0,
  perWordMs = 38,
}: {
  text: string;
  className?: string;
  startDelayMs?: number;
  perWordMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <span className={className}>{text}</span>;

  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span
            aria-hidden="true"
            className="word-fade-word"
            style={{ animationDelay: `${startDelayMs + i * perWordMs}ms` }}
          >
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </span>
  );
}

// ── ThreadIntro — the orientation line above the card group ─────────────────────────

export function ThreadIntro({
  skill,
  audienceLabel,
  platform,
  hookLine,
}: {
  skill: ThreadSkill;
  audienceLabel: string;
  platform: string;
  hookLine?: string | null;
}) {
  // The intent line TYPES OUT (per-word cascade) — a smoother, more alive entrance than a hard
  // appear. This is the header voice moment; the result + outro still land only after the spine
  // completes (never answer text streaming early — that path stays gated on !isStreaming).
  return (
    <WordFade
      text={introLine(skill, audienceLabel, platform, hookLine)}
      className="block text-[15px] leading-relaxed text-foreground"
      perWordMs={30}
    />
  );
}

// ── ThreadOutro — the engine's follow-up (restyled) + real forward chips ─────────────

export interface ForwardChip {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

export function ThreadOutro({
  text,
  chips,
  followups,
}: {
  /** The engine followupText, or an outroFallback — already resolved by the caller. */
  text: string | null;
  /** Forward-chain chips derived from REAL card handoffs (no chip without a destination). */
  chips?: ForwardChip[];
  /**
   * The curated "what next" follow-up chips for this skill (chat-followups.ts). A DIFFERENT type
   * from the forward chip above — ghost pills, the alternatives. The send handler comes from
   * FollowupContext (composer-provided), so no onFollowup prop threads through the skill views.
   */
  followups?: ChatFollowup[];
}) {
  const hasChips = !!chips && chips.length > 0;
  const hasFollowups = !!followups && followups.length > 0;
  if (!text && !hasChips && !hasFollowups) return null;

  return (
    <div className="reading-reveal flex flex-col gap-3">
      {text && (
        <div className="md" aria-label="Model follow-up">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{text}</ReactMarkdown>
        </div>
      )}
      {hasChips && (
        <div className="flex flex-wrap gap-2">
          {chips!.map((chip, i) =>
            chip.primary ? (
              // The forward-chain chip IS the card primary — one tonal definition app-wide.
              <CardPrimaryAction key={i} onClick={chip.onClick} disabled={!chip.onClick}>
                {chip.label}
              </CardPrimaryAction>
            ) : (
              <button
                key={i}
                type="button"
                onClick={chip.onClick}
                disabled={!chip.onClick}
                className={cn(
                  'rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-default disabled:opacity-40',
                  'border border-white/[0.06] bg-white/[0.02] text-foreground-secondary hover:border-white/[0.10] hover:text-foreground',
                )}
              >
                {chip.label}
              </button>
            ),
          )}
        </div>
      )}
      {hasFollowups && <FollowupRow followups={followups!} />}
    </div>
  );
}
