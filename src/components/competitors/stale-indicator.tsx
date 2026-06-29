import { formatRelativeTime, isStale } from "@/lib/competitors-utils";

interface StaleIndicatorProps {
  lastScrapedAt: string | null;
}

export function StaleIndicator({ lastScrapedAt }: StaleIndicatorProps) {
  const stale = isStale(lastScrapedAt);

  return (
    <span className={`text-xs ${stale ? "text-warning" : "text-foreground-muted"}`}>
      Updated {formatRelativeTime(lastScrapedAt)}
    </span>
  );
}
