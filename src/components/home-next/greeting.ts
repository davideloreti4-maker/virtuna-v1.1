/**
 * Home's greeting and the account's initials (Home spec 2026-11-23 §3.1). Pure: no React.
 */

/** The first word of a name, or null when there is none. */
export function firstNameOf(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

/** Morning until 12:00, afternoon until 18:00, then evening (the arrival's rule). */
export function greetingFor(now: Date, name: string | null): string {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return name ? `Good ${part}, ${name}.` : `Good ${part}.`;
}

/** Up to two first letters of the name, upper case. Without a name, the email's first letter: on a
 *  phone a lone "?" in the top corner reads as Help. "?" only when there is neither. */
export function initialsOf(name: string | null | undefined, email?: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length) return words.map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return email?.trim()[0]?.toUpperCase() ?? "?";
}
