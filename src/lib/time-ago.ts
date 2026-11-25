/**
 * How long ago something happened, coarse: "just now", "5m ago", "2h ago", "3d ago". Shared by
 * the audience screens (when an account last synced), Home and Library (when a chat was last
 * written to, when it was simulated). Null for no time, an unreadable one, or one in the future.
 */

/** "2h ago" — coarse on purpose; a fact line, not a log. */
export function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const WEEK_MS = 7 * 24 * 3_600_000;
const DAY_MONTH = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

/** When a chat was last written to: "2h ago" within a week, then its date ("Oct 24"), with the
 *  year once it is not this one. "118d ago" asks the reader to do the sum. */
export function whenLabel(iso: string): string | null {
  const at = new Date(iso).getTime();
  const now = Date.now();
  if (!Number.isFinite(at)) return null;
  if (now - at < WEEK_MS) return timeAgo(iso);
  const date = new Date(at);
  return (date.getFullYear() === new Date(now).getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR).format(date);
}
