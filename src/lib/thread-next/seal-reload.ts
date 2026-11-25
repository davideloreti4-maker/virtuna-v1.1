/**
 * seal-reload.ts — the composer's seal map after it re-reads a thread's seals from the server
 * (thread answers step 1, Task 6).
 *
 * A reload's read can predate the server's write of a seal the client has just merged (a gauge's run
 * that ended while the read was in flight). For the SAME thread the server's map is merged over the
 * client's, so that seal survives and its row neither looks empty nor fires again. For ANOTHER thread
 * the server's map replaces it, so one thread's numbers never show in another.
 *
 * Pure: no React.
 */

export function reloadedSeals<Seal>(
  prev: Readonly<Record<string, Seal>>,
  fromServer: Readonly<Record<string, Seal>>,
  sameThread: boolean,
): Record<string, Seal> {
  return sameThread ? { ...prev, ...fromServer } : { ...fromServer };
}
