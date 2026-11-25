import { MavenMark } from "@/components/brand/maven-logo";

/**
 * The answer's "Maven" label (new look, spec 2026-11-20 §4.4; reference
 * `.scratch/next-look/part3/design/field.html`, `.f1-who`): the small mark and the word above each
 * answer. The word is in the secondary ink; the mark is the brand's coral (`--color-accent`), as the
 * answer-system drawing approved on 2026-11-21 draws it (`answers.html`, `.who .ic`). That drawing
 * supersedes slice 1's "not coral": the label is one of the two places the accent is allowed
 * (spec 2026-11-21 §3 rule 3).
 *
 * Geometry as drawn: 18 tall, 13 / 18 at 560, the mark with 6 after it (drawn 16 square; built 20 × 8,
 * the brand mark's own 2.5 : 1). Under the
 * answer-system drawing the answer starts 8 under the label on a phone (`.ax-msgs` gap 12 less the
 * card's -4) and 14 from md (`.desk .thread` gap 14), and its parts (card, sentence, chips) sit 12
 * apart, 14 from md.
 *
 * Rendered by `ThreadAssistantTurn` (`src/components/thread/thread-shell.tsx`) under the flag. It
 * keeps the turn's `<h2>` "Maven" (the F-14 heading contract); the mark is hidden from screen
 * readers, so the heading's name stays the word.
 */

/**
 * The mark: the brand's own (`MavenMark`, the owner's pick of 2026-11-19), 8 tall and so 20 wide, in
 * the accent. The reference drew a stand-in glyph of two arches here; beside the sidebar's real mark
 * that read as a second logo (critic 2026-11-23).
 */
function MarkGlyph() {
  return <MavenMark size={8} className="shrink-0 text-accent" />;
}

/** Untracked, as drawn. Inline: the app-wide `h1, h2, h3 { letter-spacing: -0.02em }` in
 *  globals.css is unlayered, so it beats any tracking utility. */
const UNTRACKED: React.CSSProperties = { letterSpacing: 0 };

/** The label alone: the turn's `<h2>`, or a plain `<span>` where it heads no answer (the thread's
 *  loading outline, `ThreadLoadingSkeleton`). */
export function AssistantLabel({ as: Tag = "h2" }: { as?: "h2" | "span" }) {
  return (
    <Tag
      style={UNTRACKED}
      className="inline-flex h-[18px] items-center gap-1.5 self-start text-meta font-[560] text-foreground-secondary"
    >
      <MarkGlyph />
      Maven
    </Tag>
  );
}

/** An answer: the label, then its parts. */
export function NextAssistantTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:gap-3.5">
      <AssistantLabel />
      <div className="flex flex-col gap-3 md:gap-3.5">{children}</div>
    </div>
  );
}
