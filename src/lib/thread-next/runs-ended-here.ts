/**
 * runs-ended-here.ts — the runs this tab saw end without an answer (stopped, or failed), by chat.
 *
 * A chat reopened with a question stored a moment ago and no answer after it shows the run's wait
 * (composer.tsx, `REOPENED_WAIT_MS`): its run may still be going on the server. Not when this tab
 * already knows that run is over without an answer: the creator stopped it, or it failed here. A
 * wait then would show "Thinking" for a run that is not there. Kept for the tab's life, across the
 * composer's mounts (leaving /home and coming back), the latest question per chat.
 *
 * No React.
 */

const ended = new Map<string, string>();

/** The run for `ask` in chat `threadId` ended here with no answer. */
export function noteRunEndedHere(threadId: string, ask: string): void {
  ended.set(threadId, ask.trim());
}

/** Did the run for `ask` in chat `threadId` end here with no answer? */
export function runEndedHere(threadId: string, ask: string): boolean {
  return ended.get(threadId) === ask.trim();
}

/** For tests: forget every run. */
export function forgetRunsEndedHere(): void {
  ended.clear();
}
