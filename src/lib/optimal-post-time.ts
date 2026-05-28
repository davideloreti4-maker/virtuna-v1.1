/**
 * Phase 6 D-25/D-26: convert engine UTC post-time window to user TZ.
 * Engine always emits UTC (OptimalPostWindow.timezone === "UTC" literal).
 * Client converts on render. No server-side TZ logic.
 */
export const DAY_TO_INDEX: Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun', number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};
const INDEX_TO_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface ConvertedWindow {
  day: string;
  hourRangeFormatted: string;
  crossedMidnight: boolean;
  userTz: string;
}

export function convertUTCWindow(
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun',
  hourRange: [number, number],
  userTz: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): ConvertedWindow {
  const [startUtcHour, endUtcHour] = hourRange;
  // Build a synthetic UTC Date for the next occurrence of `dayOfWeek` at `startUtcHour`.
  // Use a fixed reference week (2024-01-01 = Monday) to avoid DST ambiguity at the
  // moment of conversion; both start and end use the same reference date so the
  // delta is preserved.
  const REF_MONDAY_UTC = new Date(Date.UTC(2024, 0, 1, 0, 0, 0)); // Mon 2024-01-01 00:00 UTC
  const dayOffset = DAY_TO_INDEX[dayOfWeek] - 1; // Mon=0, Tue=1, ...
  const startDateUtc = new Date(REF_MONDAY_UTC);
  startDateUtc.setUTCDate(REF_MONDAY_UTC.getUTCDate() + dayOffset);
  startDateUtc.setUTCHours(startUtcHour, 0, 0, 0);

  const endDateUtc = new Date(startDateUtc);
  // hourRange[1] may be 24 (exclusive end-of-day); subtract via ms to keep edge case clean.
  endDateUtc.setTime(startDateUtc.getTime() + (endUtcHour - startUtcHour) * 60 * 60 * 1000);

  // Extract weekday name in user TZ from the START date (per D-25: midnight-crossing
  // uses post-conversion day name).
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: userTz,
  });
  const day = dayFormatter.format(startDateUtc); // "Mon" .. "Sun"

  // Detect midnight crossing: compare weekday-index in user TZ between UTC ref and user-TZ render.
  const utcDayIndex = startDateUtc.getUTCDay();
  const userDayName = day;
  const userDayIndex = INDEX_TO_DAY.indexOf(userDayName as typeof INDEX_TO_DAY[number]);
  const crossedMidnight = userDayIndex !== utcDayIndex;

  // Format hour range using Intl.DateTimeFormat.formatRange (per RESEARCH item 20).
  const rangeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    hour12: true,
    timeZone: userTz,
  });
  // formatRange handles same-period ("6 – 9 PM") AND cross-period ("11 AM – 1 PM") automatically.
  const hourRangeFormatted = rangeFormatter.formatRange(startDateUtc, endDateUtc);

  return { day, hourRangeFormatted, crossedMidnight, userTz };
}
