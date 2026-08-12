/**
 * The hero → thread file handoff (ONBOARDING-FUNNEL-DESIGN.md §0b④).
 *
 * Seam 4 hands a composed intent off as a `/home?v=…&seed=…&run=1` URL
 * (`buildThreadLaunchHref`). A link rides a query string; a **File does not** — which is
 * exactly why the /home seed inlet documents Test as degrading to pre-fill when the launch
 * carries no URL (composer.tsx, "a video upload needs a file the surface can't carry").
 *
 * That degradation is the wrong behaviour for THIS funnel. §0b④ makes upload a first-class
 * entry on purpose: visitors with no posted videos or a private account are disproportionately
 * the best customers, and making them pick the same file twice is friction at the exact step
 * the funnel exists to make effortless.
 *
 * So the file is staged in module scope and consumed on the other side. This works because
 * `router.push` is a CLIENT-side navigation — same JS runtime, same module instance, so the
 * File object survives. A hard reload or a pasted URL does not carry it, and that is fine:
 * the inlet then finds nothing and falls back to the revealed drop zone, which is the
 * behaviour that shipped before this existed.
 *
 * Deliberately NOT sessionStorage: a File is not serialisable, and re-uploading it to storage
 * just to survive a navigation would spend money and time before the visitor has committed to
 * anything.
 */

/** How long a staged file stays valid. Long enough for a slow client nav, short enough that a
 *  file staged in one visit can never surface inside an unrelated later run. */
const MAX_STAGE_AGE_MS = 5 * 60 * 1000;

let staged: { file: File; at: number } | null = null;

/** Stage the hero's file for the thread to pick up. A second call replaces the first — the
 *  visitor changed their mind before launching, and only the latest pick can be right. */
export function stagePendingUpload(file: File): void {
  staged = { file, at: Date.now() };
}

/**
 * Take the staged file, if any. **Consume-once**: the slot is cleared before the age check so
 * a stale file can never be handed to a later run, and a re-render of the inlet can never
 * replay the same upload into a second billed engine call.
 */
export function consumePendingUpload(): File | null {
  if (!staged) return null;

  const { file, at } = staged;
  staged = null;

  if (Date.now() - at > MAX_STAGE_AGE_MS) return null;

  return file;
}

/** Whether a file is staged. Read-only — does not consume. For tests and host-side UI state. */
export function hasPendingUpload(): boolean {
  return staged !== null && Date.now() - staged.at <= MAX_STAGE_AGE_MS;
}

/** Drop anything staged. For an abandoned hero submit, and for test isolation. */
export function clearPendingUpload(): void {
  staged = null;
}
