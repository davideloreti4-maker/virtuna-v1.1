"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * PainPointsInput — Card 8 of the 9-card creator interview (PROFILE-11).
 *
 * Pure controlled free-text Textarea with a hard 500-grapheme cap and a
 * live counter.
 *
 * WR-12: counting / truncation are grapheme-cluster aware (`Intl.Segmenter`)
 * so an emoji or skin-tone modifier — which spans multiple UTF-16 code units
 * — is treated as one user-visible "character" and never truncated mid-
 * grapheme. The downstream zod check (`z.string().max(500)`) still uses code-
 * unit length, so the grapheme-aware cap here is the conservative front-
 * stop: the UI never produces more than 500 graphemes, which corresponds to
 * at most a few hundred code units beyond 500. The native `maxLength` prop
 * is left off because it would re-introduce code-unit truncation on the
 * browser side.
 */

const MAX_LENGTH = 500;

export interface PainPointsInputProps {
  value: string;
  onChange: (next: string) => void;
}

// Module-scope segmenter — instantiation is non-trivial. Reused across
// renders. The locale `undefined` matches the user's default locale.
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function countGraphemes(input: string): number {
  if (!segmenter) return input.length;
  let count = 0;
  for (const _segment of segmenter.segment(input)) {
    void _segment;
    count += 1;
  }
  return count;
}

function truncateToGraphemes(input: string, max: number): string {
  if (!segmenter) return input.slice(0, max);
  const segments: string[] = [];
  for (const { segment } of segmenter.segment(input)) {
    if (segments.length >= max) break;
    segments.push(segment);
  }
  return segments.join("");
}

export function PainPointsInput({
  value,
  onChange,
}: PainPointsInputProps): React.JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(truncateToGraphemes(e.target.value, MAX_LENGTH));
  };

  const count = countGraphemes(value);

  return (
    <div className="space-y-1.5">
      <Textarea
        size="md"
        rows={4}
        value={value}
        placeholder="What's your biggest challenge as a creator right now?"
        onChange={handleChange}
        data-testid="card-8-textarea"
      />
      <p
        className="text-xs text-foreground-muted text-right"
        data-testid="card-8-counter"
      >
        {count} / 500
      </p>
    </div>
  );
}
