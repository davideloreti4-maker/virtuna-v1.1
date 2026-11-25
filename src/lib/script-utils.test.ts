import { describe, it, expect } from 'vitest';
import { formatTime, scriptBrief, stripMarkdown } from './script-utils';

describe('formatTime', () => {
  it('formats 8000ms as "0:08"', () => expect(formatTime(8000)).toBe('0:08'));
  it('formats 72000ms as "1:12"', () => expect(formatTime(72000)).toBe('1:12'));
  it('formats 0 as "0:00"', () => expect(formatTime(0)).toBe('0:00'));
  it('floors fractional seconds', () => expect(formatTime(8999)).toBe('0:08'));
  it('clamps negative ms to "0:00"', () => expect(formatTime(-500)).toBe('0:00'));
});

describe('stripMarkdown', () => {
  it('strips ** and backticks', () => expect(stripMarkdown('**hello** `world`')).toBe('hello world'));
  it('strips __ underline tokens', () => expect(stripMarkdown('__bold__ text')).toBe('bold text'));
  it('trims edges', () => expect(stripMarkdown('   plain text   ')).toBe('plain text'));
  it('no-ops on plain prose', () => expect(stripMarkdown('A plain string.')).toBe('A plain string.'));
});

describe('scriptBrief', () => {
  const beats = [
    { label: 'Hook', content: 'I stopped editing my videos.' },
    { label: 'Payoff', content: 'And my views tripled.' },
  ];
  it('labels each beat and joins them with " / "', () =>
    expect(scriptBrief(beats)).toBe('[Hook] I stopped editing my videos. / [Payoff] And my views tripled.'));
  it('cuts the brief at 400 characters', () =>
    expect(scriptBrief([{ label: 'Hook', content: 'x'.repeat(500) }])).toBe(`[Hook] ${'x'.repeat(393)}`));
  it('an empty script is an empty brief', () => expect(scriptBrief([])).toBe(''));
});
