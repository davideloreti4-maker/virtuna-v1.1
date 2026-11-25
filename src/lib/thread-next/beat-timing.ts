/**
 * beat-timing.ts — read a script beat's free-text `timing` (spec §4.3).
 *
 * Accepted: "0–3s", "0-3s", "3–15s", "0:00–0:03", "0:03-0:08", "20 to 24s" (a range: en dash,
 * hyphen or "to"), and "15s", "0:20" (a single time: a start, no end). Each side is either seconds
 * ("3", "3s", "1.5s") or minutes and seconds ("0:03", "1:15"). Anything else reads as nothing, and
 * the card shows no time for that beat (spec §8: such beats show no times and no total).
 *
 * Pure: no React.
 */

/** One time: "3", "3s", "1.5s", "0:03", "1:15" → seconds. */
function seconds(raw: string): number | null {
  const s = raw.trim();
  const clock = /^(\d+):([0-5]\d)$/.exec(s);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const plain = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(s);
  if (plain) return Number(plain[1]);
  return null;
}

/** [start, end]; end is null for a single time. Null when the string is not a timing. */
function parse(s: string): [number, number | null] | null {
  const sides = s.trim().split(/\s*(?:–|-|\bto\b)\s*/i);
  if (sides.length === 1) {
    const start = seconds(sides[0] ?? "");
    return start === null ? null : [start, null];
  }
  if (sides.length !== 2) return null;
  const start = seconds(sides[0] ?? "");
  const end = seconds(sides[1] ?? "");
  return start === null || end === null ? null : [start, end];
}

/** The beat's start in seconds, or null. */
export function timingStart(s: string): number | null {
  return parse(s)?.[0] ?? null;
}

/** The beat's end in seconds; null for a single time or an unreadable one. */
export function timingEnd(s: string): number | null {
  return parse(s)?.[1] ?? null;
}

/** Seconds as a clock: 0 → "0:00", 24 → "0:24", 75 → "1:15". Fractions floor; nonsense is 0. */
export function clockLabel(sec: number): string {
  const total = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
