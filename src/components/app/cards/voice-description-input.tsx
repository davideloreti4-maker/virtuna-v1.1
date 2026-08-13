"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * VoiceDescriptionInput — Card 9 of the 10-card creator interview.
 *
 * ─── 🔴 THIS CARD USED TO ASK FOR A SPECIMEN, AND THAT WAS THE DEFECT ────────────────────────
 *
 * Until 2026-08-13 the placeholder read *"Paste a short script or caption you want to sound like —
 * the engine will match your style, not copy the content."* PR #482 measured that promise and it
 * is FALSE. Three arms x six seeds through the real loop, one field different:
 *
 *     "Btw this dance took me hours to learn"  (8 words)   43% of hooks written for a budgeting
 *                                                          app were about a dance — while sharing
 *                                                          0% of the sample's words
 *     a 17-word line in the creator's register             13% of the pack reproduced VERBATIM
 *
 * A quoted line cannot carry style, so the generator copies CONTENT instead — donating the
 * sample's topic when it is short, its words when it is long. The UI was promising the one
 * behaviour the engine was measured not to have.
 *
 * So the card now asks for a DESCRIPTION of how the creator writes ("blunt, no fluff"), which is
 * what `ProfileRow.writing_voice_description` is contracted to hold and what `formatVoice`'s
 * instruction header is correct against. See
 * `docs/superpowers/specs/2026-08-12-exemplar-fence-design.md`.
 *
 * ⚠️ NOT PERSISTED YET. `creator_profiles` has no voice column (verified against prod 2026-08-13)
 * and `creatorProfilePatchSchema`'s whitelist omits the field, so this answer is dropped at the
 * API boundary. That is why the copy change matters now rather than later: it decides what lands
 * in the column on the day someone adds it. `schemas/__tests__/creator-profile.test.ts` pins the
 * gap and fails loudly the moment someone adds the field to the whitelist.
 *
 * Hard cap: 1 000 graphemes (UI-enforced). The assembler enforces BUNDLE_CHAR_CAP as the
 * downstream safety net — the UI cap is a soft UX guard.
 *
 * Pattern mirrors PainPointsInput (Card 8): grapheme-aware counting + truncation, same Textarea +
 * counter structure. Completely optional: blank value = cold-start (voice role silently omitted).
 */

const MAX_LENGTH = 1000;

export interface VoiceDescriptionInputProps {
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

export function VoiceDescriptionInput({
  value,
  onChange,
}: VoiceDescriptionInputProps): React.JSX.Element {
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
        placeholder="e.g. blunt, no fluff. short declaratives, lowercase energy. never corporate-speak, never a listicle."
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
