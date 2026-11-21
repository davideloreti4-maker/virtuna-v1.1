/**
 * The answer's "Maven" label (new look, spec 2026-11-20 §4.4; reference
 * `.scratch/next-look/part3/design/field.html`, `.f1-who`): the small mark and the word, in the
 * secondary ink, above each answer. Not coral: the brand mark's accent stays in the side nav.
 *
 * Geometry as drawn: 18 tall, 13 / 18 at 560, the mark 16 square with 6 after it; the answer
 * starts 6 under the label and its parts sit 14 apart (the reference's say → cards → chips).
 *
 * Rendered by `ThreadAssistantTurn` (`src/components/thread/thread-shell.tsx`) under the flag. It
 * keeps the turn's `<h2>` "Maven" (the F-14 heading contract); the mark is hidden from screen
 * readers, so the heading's name stays the word.
 */

/** The reference's mark glyph (`I.mark`): one stroke, two arches. 24 viewBox, drawn at 16. */
function MarkGlyph() {
  return (
    <svg
      aria-hidden
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M2.5 15.2C5.2 8 9.3 8 12 13.4 14.7 8 18.8 8 21.5 15.2" />
    </svg>
  );
}

/** Untracked, as drawn. Inline: the app-wide `h1, h2, h3 { letter-spacing: -0.02em }` in
 *  globals.css is unlayered, so it beats any tracking utility. */
const UNTRACKED: React.CSSProperties = { letterSpacing: 0 };

/** The label alone: the turn's `<h2>`. */
function AssistantLabel() {
  return (
    <h2
      style={UNTRACKED}
      className="inline-flex h-[18px] items-center gap-1.5 self-start text-meta font-[560] text-foreground-secondary"
    >
      <MarkGlyph />
      Maven
    </h2>
  );
}

/** An answer: the label, then its parts. */
export function NextAssistantTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <AssistantLabel />
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}
