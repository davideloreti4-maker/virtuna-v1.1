/**
 * beat-name.ts — a script beat's name as the new look shows it (thread depth spec §3.1): the beat's
 * `label` as sent, trimmed. "CTA" (any case, the whole label) is written "Call to action": the
 * runner's short form is jargon a creator should not have to decode. An empty label has no name, so
 * the card draws nothing and takes no room. Used by the script card and its "How to film it" sheet.
 *
 * Pure: no React.
 */

export function beatName(label: string): string | null {
  const name = label.trim();
  if (name.length === 0) return null;
  return /^cta$/i.test(name) ? "Call to action" : name;
}
