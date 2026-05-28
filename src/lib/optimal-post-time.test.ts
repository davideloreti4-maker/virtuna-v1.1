import { describe, it, expect } from 'vitest';
import { convertUTCWindow } from './optimal-post-time';

describe('convertUTCWindow', () => {
  it('converts UTC Tue 18-21 → PST as Tue 10AM-1PM', () => {
    const r = convertUTCWindow('Tue', [18, 21], 'America/Los_Angeles');
    expect(r.day).toBe('Tue');
    expect(r.crossedMidnight).toBe(false);
    expect(r.hourRangeFormatted).toMatch(/10.*1.*PM/i);
    expect(r.userTz).toBe('America/Los_Angeles');
  });
  it('converts UTC Tue 18-21 → JST as Wed (midnight crossing)', () => {
    const r = convertUTCWindow('Tue', [18, 21], 'Asia/Tokyo');
    expect(r.day).toBe('Wed');
    expect(r.crossedMidnight).toBe(true);
  });
  it('converts UTC Tue 18-21 → GMT as Tue (no crossing, winter = UTC+0)', () => {
    const r = convertUTCWindow('Tue', [18, 21], 'Europe/London');
    expect(r.day).toBe('Tue');
    expect(r.crossedMidnight).toBe(false);
  });
  it('handles AM/PM boundary span (UTC 16-18 in US/Eastern = 11AM-1PM EST)', () => {
    // UTC 16-18 → EST (UTC-5) = 11 AM – 1 PM (spans noon, crosses AM→PM)
    const r = convertUTCWindow('Tue', [16, 18], 'America/New_York');
    expect(r.hourRangeFormatted).toMatch(/AM.*PM/i);
  });
  it('handles end-of-day hour_range[1]=24 without throwing', () => {
    expect(() => convertUTCWindow('Tue', [22, 24], 'UTC')).not.toThrow();
  });
});
