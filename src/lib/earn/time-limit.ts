/**
 * time-limit.ts — a time limit for work the caller must not wait on for long (the referrer's lookup at
 * checkout, the referral row). Pure.
 */

/** What `within` answers when the time ran out. A symbol, so no answer of the work can be mistaken for it. */
export const LATE: unique symbol = Symbol("late");

/**
 * The work's answer, or `LATE` after `ms`. The work starts on the next tick, so a throw inside it is a
 * rejection of this promise, never of the caller's own turn. Work that is given up goes on by itself; a
 * rejection it ends in later is swallowed here.
 */
export async function within<T>(ms: number, work: () => T | PromiseLike<T>): Promise<T | typeof LATE> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const running = Promise.resolve().then(work);
  const late = new Promise<typeof LATE>((resolve) => {
    timer = setTimeout(() => resolve(LATE), ms);
  });
  try {
    const answer = await Promise.race([running, late]);
    if (answer === LATE) running.catch(() => {});
    return answer;
  } finally {
    clearTimeout(timer);
  }
}
