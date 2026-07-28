import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The nine type ROLES from globals.css @theme, registered with tailwind-merge.
 *
 * THIS IS LGAD-CRITICAL, NOT COSMETIC. tailwind-merge ships knowing Tailwind's
 * built-in scale (text-xs … text-9xl) but nothing about custom `--text-*` theme
 * keys. Faced with `text-body` it cannot tell a font-size from a text COLOR, and
 * it guesses colour — so the moment a role shared a cn() with a real colour, the
 * role was silently deleted:
 *
 *   twMerge("text-body font-medium", "text-foreground-secondary")
 *     → "font-medium text-foreground-secondary"      ← text-body GONE
 *   twMerge("text-sm font-medium", "text-foreground-secondary")
 *     → "text-sm font-medium text-foreground-secondary"   ← built-in survives
 *
 * The class vanished before it reached the DOM, so the element fell back to the
 * inherited 16px base. Caught in review: the sidebar's nav labels measured 16px
 * where the role says 13px, and its section label carried `letter-spacing: 1.28px`
 * — which is 0.08em × 16px, the arithmetic fingerprint of the wrong base size.
 *
 * Keep this list in sync with the `--text-*` role tokens in globals.css. A role
 * that is defined there but missing here compiles, renders, and is wrong.
 */
const TYPE_ROLES = [
  "micro",
  "caption",
  "label",
  "body",
  "reading",
  "title",
  "subhead",
  "heading",
  "stat",
  // Pre-existing custom `--text-*` keys. They carry the same latent defect —
  // tailwind-merge never knew them either — so they belong here regardless of
  // which pass introduced them.
  "hero",
  "display",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_ROLES] }],
    },
  },
});

/**
 * Combines clsx and tailwind-merge for conditional class merging
 * with proper Tailwind CSS conflict resolution.
 *
 * @example
 * cn("bg-red-500", "bg-blue-500") // => "bg-blue-500"
 * cn("p-4", condition && "p-8") // => "p-4" or "p-8"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * The app's ONE keyboard focus ring. Visible focus is a WCAG AA requirement
 * (FOUND-07) — every interactive element must show where keyboard focus lands.
 *
 * Unified 2026-07-28. Before this there were THREE competing treatments:
 *   1. this constant — coral `ring-accent` with `ring-offset-2` (8 uses, marketing only)
 *   2. a byte-identical local `const focusRing` (white/10, inset) copy-pasted into
 *      four component files, three of which sit on routes that now redirect
 *   3. nothing at all — so most of the app fell through to Chrome's default
 *      `outline: auto 1px rgb(0, 95, 204)`, a blue found nowhere in this system
 *
 * Why not the old coral: `docs/DESIGN-SYSTEM.md` locks accent DOSAGE to liveness
 * signals — live dots, the lit node, the brand mark — explicitly NOT chrome. A
 * coral ring on every link is chrome.
 *
 * Why not the old white/10: it computes to ~1.5:1 against --charcoal-app, under
 * the 3:1 WCAG floor for a focus indicator. It was branded and invisible.
 *
 * Cream at 55% (`--focus-ring`, globals.css) lands near 4.5:1 and stays on-brand.
 * INSET (`ring-inset`, no offset) because overflow-hidden containers — the sidebar,
 * thread lists — clip an outward ring against their own edge.
 *
 * Most elements no longer need this: globals.css sets an app-wide `:focus-visible`
 * floor. Reach for it only where a component must opt out of the global outline
 * (i.e. it already sets `focus-visible:outline-none`).
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring)]";

/**
 * Strip one layer of wrapping quotes from a model-emitted string.
 *
 * Every surface that shows a verbatim — an audience quote, a behavioral tell's evidence, a
 * persona's reasoning — renders it inside typographic quotes the COMPONENT owns
 * (`&ldquo;{value}&rdquo;`). That is correct: the quoting is presentation, so the mark matches
 * the design system rather than whatever the model happened to type.
 *
 * But nothing stops a model from also quoting the string itself, and then the reader sees
 * ""like this"" — which reads as a rendering fault and undercuts the one thing a verbatim is
 * for (sounding like a real person actually said it). Seen live on Profile Read's evidence
 * lines. The fix belongs here, at the boundary where untrusted text meets a quoting component,
 * not in eleven separate renderers.
 *
 * Strips a SINGLE matched pair of straight or curly quotes, and only when the string both opens
 * and closes with one — so an internal quote (He said "no") and a one-sided quote survive
 * untouched. Idempotent for our purposes: the component adds exactly one pair back.
 */
export function stripWrappingQuotes(value: string | null | undefined): string {
  const s = (value ?? '').trim();
  if (s.length < 2) return s;
  const first = s[0]!;
  const last = s[s.length - 1]!;
  const pairs: Record<string, string> = { '"': '"', '“': '”', "'": "'", '‘': '’' };
  return pairs[first] === last ? s.slice(1, -1).trim() : s;
}
