/**
 * let-go-runs.ts — a run the creator left mid-way (a thread switch) has ended in the background.
 *
 * A thread switch lets each stream's run go on unseen (`detach` in the stream hooks): its request
 * stays open to its end, so its route stores the result in the chat it was started in. Nothing on
 * screen folds it, so nothing read the chat list again: a chat left mid-run kept its old line (or was
 * missing) in Recent until some later run folded. The hooks say here when such a request ends
 * (`reportLetGoRunEnded`); the composer listens (`subscribeLetGoRunsEnded`) and reads the list again.
 * Module state, on purpose, as `open-sheets.ts`: the hooks hold no query client.
 *
 * Held, but not without end (`holdLetGo`): a request let go is ended once the route itself would
 * have been (its maxDuration, 300 s, plus a margin), and at most `LET_GO_MAX` are held at once (one
 * more ends the oldest), so a body that never closes cannot keep a connection open for good. A long
 * hold (`{ long: true }`, the Test simulation's paid run) is never ended to make room, nor counted.
 *
 * No React.
 */

const listeners = new Set<() => void>();

/** A request let go by a thread switch has ended (stored, failed or refused: the list may have moved). */
export function reportLetGoRunEnded(): void {
  for (const listener of [...listeners]) listener();
}

/** Hear each such end. Returns the way to stop. */
export function subscribeLetGoRunsEnded(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The routes' own limit (maxDuration 300 s, the chat's routes and /api/analyze alike) plus a margin:
 * past it, nothing more will come. Every hold, long or not, ends at it.
 */
export const LET_GO_LIMIT_MS = 330_000;
/** Requests let go and still open at once: a browser holds only a few connections to one host. */
export const LET_GO_MAX = 3;

type Held = { controller: AbortController; timer: ReturnType<typeof setTimeout>; long: boolean };
const held: Held[] = [];

function drop(entry: Held): void {
  const i = held.indexOf(entry);
  if (i >= 0) held.splice(i, 1);
  clearTimeout(entry.timer);
}

/**
 * Hold a request let go until it ends (call the returned release then), ending it at the limit or
 * when it is the oldest of more than `LET_GO_MAX`.
 *
 * `{ long: true }` (a paid run whose request IS the work, the Test simulation's /api/analyze POST):
 * kept out of the three-slot FIFO (never ended to make room, and not counted). Both end at
 * `LET_GO_LIMIT_MS`.
 */
export function holdLetGo(controller: AbortController, opts: { long?: boolean } = {}): () => void {
  const long = opts.long === true;
  const entry: Held = {
    controller,
    long,
    timer: setTimeout(() => {
      drop(entry);
      controller.abort();
    }, LET_GO_LIMIT_MS),
  };
  held.push(entry);
  const capped = () => held.filter((h) => !h.long);
  while (capped().length > LET_GO_MAX) {
    const oldest = capped()[0]!;
    drop(oldest);
    oldest.controller.abort();
  }
  return () => drop(entry);
}
