"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * VoiceSampleInput — Card 9 of the 10-card creator interview (N1 voice sample).
 *
 * Optional free-text textarea for a verbatim writing sample the creator wants
 * the engine to emulate. The engine reads STYLE, rhythm, and tone only —
 * never specific content or claims (honesty-spine, formatVoice() instruction header).
 *
 * Hard cap: 1 000 graphemes (UI-enforced). The assembler enforces BUNDLE_CHAR_CAP
 * as the downstream safety net — the UI cap is a soft UX guard.
 *
 * Pattern mirrors PainPointsInput (Card 8): grapheme-aware counting + truncation,
 * same Textarea + counter structure, same Raycast design language.
 *
 * Completely optional: blank value = cold-start (voice role silently omitted).
 */

const MAX_LENGTH = 1000;

export interface VoiceSampleInputProps {
  value: string;
  onChange: (next: string) => void;
}

// Module-scope segmenter — mirrors PainPointsInput (WR-12 pattern).
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

export function VoiceSampleInput({
  value,
  onChange,
}: VoiceSampleInputProps): React.JSX.Element {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(truncateToGraphemes(e.target.value, MAX_LENGTH));
  };

  const count = countGraphemes(value);

  return (
    <div className="space-y-1.5">
      <Textarea
        size="md"
        rows={6}
        value={value}
        placeholder="Paste a short script or caption you want to sound like — the engine will match your style, not copy the content."
        onChange={handleChange}
        data-testid="card-9-textarea"
      />
      <p
        className="text-xs text-foreground-muted text-right"
        data-testid="card-9-counter"
      >
        {count} / {MAX_LENGTH}
      </p>
    </div>
  );
}
