import { formatRelativeTime, isStale } from "@/lib/competitors-utils";

interface StaleIndicatorProps {
  lastScrapedAt: string | null;
  /**
   * Suppress the warning tone and state the age as a plain fact.
   *
   * For when something LOUDER on the same row already names the problem — a failed scrape
   * says "this is broken" far more precisely than an amber timestamp does, and painting both
   * gives one condition two alarms (Apple-grammar pass, 2026-08-16).
   */
  quiet?: boolean;
}

export function StaleIndicator({ lastScrapedAt, quiet = false }: StaleIndicatorProps) {
  const stale = !quiet && isStale(lastScrapedAt);

  return (
    <span className={`text-xs ${stale ? "text-warning" : "text-foreground-muted"}`}>
      Updated {formatRelativeTime(lastScrapedAt)}
    </span>
  );
}
