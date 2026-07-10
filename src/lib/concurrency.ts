/**
 * concurrency.ts — bounded-parallelism helper for batch work (scrapes, uploads, fan-out fetches).
 *
 * A plain `Promise.all(items.map(worker))` fires everything at once, which hammers upstream services
 * and blows the DB pool; a serial `for` loop is safe but slow enough to exhaust a function timeout.
 * `mapWithConcurrency` keeps at most `limit` workers in flight — the middle ground.
 */

/**
 * Run `worker` over `items`, at most `limit` in flight at once. Resolves when all items are done.
 *
 * Items are pulled from a shared cursor by a fixed pool of runners, so a slow item never blocks a
 * free runner from starting the next one. `worker` is expected to isolate its own failures (this
 * helper does not catch — a rejecting worker rejects the whole call, matching `Promise.all`).
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (limit < 1) throw new Error("mapWithConcurrency: limit must be >= 1");
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      if (item !== undefined) await worker(item, index);
    }
  });
  await Promise.all(runners);
}
