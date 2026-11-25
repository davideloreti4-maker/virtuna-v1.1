/**
 * stale.ts — when a job has stopped (X41, X75): a running job not touched for two minutes, or a queued one no worker
 * claimed in that time. Its own module so that takes.ts, which the page imports, needs nothing of the server's
 * (jobs.ts reads the worker's settings). The worker touches a running job every 30 s at least.
 */
export const STALE_MS = 2 * 60 * 1000;
