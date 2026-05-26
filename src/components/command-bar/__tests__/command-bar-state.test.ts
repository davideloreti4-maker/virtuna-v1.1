import { describe, it, expect } from 'vitest';
import { placeholderFor, chipsFor, inputEnabledFor } from '../command-bar-state';

describe('placeholderFor', () => {
  it('idle', () => expect(placeholderFor('idle', null)).toBe('Paste URL, drop file, or describe…'));
  it('streaming with stage', () =>
    expect(placeholderFor('streaming', 'Reading the hook…')).toBe('Reading the hook…'));
  it('streaming without stage', () =>
    expect(placeholderFor('streaming', null)).toBe('Analyzing…'));
  it('complete', () =>
    expect(placeholderFor('complete', null)).toBe('Ask about your audience or generate variant…'));
});

describe('chipsFor', () => {
  it('idle empty', () => expect(chipsFor('idle')).toEqual([]));
  it('streaming stop', () =>
    expect(chipsFor('streaming')).toEqual([
      { id: 'stop', label: 'Stop analysis', enabled: true, destructive: true },
    ]));
  it('complete 4 disabled chips', () => {
    const chips = chipsFor('complete');
    expect(chips).toHaveLength(4);
    chips.forEach((c) => expect(c.enabled).toBe(false));
  });
  it('edit-input empty', () => expect(chipsFor('edit-input')).toEqual([]));
});

describe('inputEnabledFor', () => {
  it('enabled in idle + complete', () => {
    expect(inputEnabledFor('idle')).toBe(true);
    expect(inputEnabledFor('complete')).toBe(true);
  });
  it('disabled in streaming + edit-input', () => {
    expect(inputEnabledFor('streaming')).toBe(false);
    expect(inputEnabledFor('edit-input')).toBe(false);
  });
});
