/**
 * The markers that fence user-supplied text inside a prompt: `<<<USER_CONTENT>>>` and
 * `<<<END_USER_CONTENT>>>`. Text from a user (or scraped from a third party) is cleaned of them
 * before it is fenced, so that only the fence the code writes is in the prompt.
 *
 * One helper for every place that cleans: the creator profile's free text when it is saved
 * (`schemas/creator-profile.ts`), the same text when it is put in a prompt (`engine/creator.ts`),
 * and every fenced section of the knowledge bundle (`kc/assembler.ts`).
 *
 * Pure: no imports.
 */

const MARKER = /<<<(?:END_)?USER_CONTENT>>>/gi;

/**
 * `input` without any fence marker, in any letter case. It cleans until the text no longer changes,
 * so what it returns never holds a marker. Each round only ever shortens the text, so it ends.
 */
export function stripUserContentMarkers(input: string): string {
  let text = input;
  for (;;) {
    const cleaned = text.replace(MARKER, "");
    if (cleaned === text) return text;
    text = cleaned;
  }
}
