import { describe, expect, it } from 'vitest';
import {
  PLACES,
  SIDE_NAV_ORDER,
  activePlace,
  backTarget,
  shouldStartCollapsed,
  tabBarVisible,
} from '../nav-config';

describe('the place list', () => {
  it('is Home, Discover, Library, Audience, in that order', () => {
    expect(PLACES.map((p) => p.label)).toEqual(['Home', 'Discover', 'Library', 'Audience']);
  });

  it('sends Discover to the hub at /feed (/discover only redirects there)', () => {
    expect(PLACES.find((p) => p.id === 'discover')?.href).toBe('/feed');
  });
});

describe('activePlace: which place is lit', () => {
  it.each([
    ['/home', 'home'],
    ['/feed', 'discover'],
    ['/feed/discover', 'discover'],
    ['/competitors', 'discover'],
    ['/discover', 'discover'],
    ['/library', 'library'],
    ['/saved', 'library'],
    ['/audience', 'audience'],
    ['/audience/new', 'audience'],
    ['/analytics', 'audience'],
    ['/grow', 'audience'],
  ] as const)('%s lights %s', (pathname, place) => {
    expect(activePlace(pathname)).toBe(place);
  });

  it('lights nothing on a screen outside the four places', () => {
    expect(activePlace('/settings')).toBeNull();
    expect(activePlace('/calendar')).toBeNull();
  });

  it('matches whole path segments, not prefixes of a word', () => {
    expect(activePlace('/feedback')).toBeNull();
    expect(activePlace('/homework')).toBeNull();
  });
});

describe('tabBarVisible: the phone tab bar', () => {
  it('shows on the four places', () => {
    for (const pathname of ['/home', '/feed', '/feed/discover', '/library', '/audience']) {
      expect(tabBarVisible(pathname, false)).toBe(true);
    }
  });

  it('hides inside a thread, where the message field is docked (never both)', () => {
    expect(tabBarVisible('/home', true)).toBe(false);
  });

  it('a thread left open on Home does not hide the bar on another place', () => {
    expect(tabBarVisible('/library', true)).toBe(true);
  });

  it('hides on pushed screens and on screens outside the places', () => {
    for (const pathname of ['/audience/new', '/library/abc', '/settings', '/saved']) {
      expect(tabBarVisible(pathname, false)).toBe(false);
    }
  });
});

describe('backTarget: where Back leads on a screen without the tab bar', () => {
  it('goes up to the place the screen belongs to', () => {
    expect(backTarget('/audience/new')).toBe('/audience');
    expect(backTarget('/library/abc')).toBe('/library');
  });

  it('goes Home from everywhere else', () => {
    expect(backTarget('/settings')).toBe('/home');
    expect(backTarget('/home')).toBe('/home');
  });
});

describe('shouldStartCollapsed: the desktop sidebar on a narrow window', () => {
  it('starts as the rail below 1100px when the creator has not chosen', () => {
    expect(shouldStartCollapsed(1099, false)).toBe(true);
    expect(shouldStartCollapsed(1100, false)).toBe(false);
  });

  it('never overrides a stored choice', () => {
    expect(shouldStartCollapsed(900, true)).toBe(false);
  });
});

describe('SIDE_NAV_ORDER: the desktop sidebar order', () => {
  it('is Home, Discover, Audience, Library, and names every place once', () => {
    expect(SIDE_NAV_ORDER).toEqual(['home', 'discover', 'audience', 'library']);
    expect([...SIDE_NAV_ORDER].sort()).toEqual(PLACES.map((p) => p.id).sort());
  });
});
