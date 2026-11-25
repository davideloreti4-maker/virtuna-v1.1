import { describe, expect, it } from 'vitest';
import {
  EARN,
  PLACES,
  SIDE_NAV_ORDER,
  YOU,
  activePlace,
  backInHistory,
  backTarget,
  earnActive,
  shouldStartCollapsed,
  onPlaceScreen,
  youActive,
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
    ['/competitors/jay.makes', 'discover'],
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

describe('onPlaceScreen: one of the four places, which draws its own top row', () => {
  it('is true on the four places', () => {
    for (const pathname of ['/home', '/feed', '/library', '/audience']) {
      expect(onPlaceScreen(pathname, false)).toBe(true);
    }
  });

  it("is false on Discover's pushed pages: a video, a collection, the pull page (its chips live in the address)", () => {
    for (const pathname of ['/feed/video/v1', '/feed/collection/meal-prep', '/feed/discover']) {
      expect(onPlaceScreen(pathname, false)).toBe(false);
    }
  });

  it('is false inside a thread: a chat on /home is a pushed screen, with its band', () => {
    expect(onPlaceScreen('/home', true)).toBe(false);
  });

  it('a thread left open on Home does not change another place', () => {
    expect(onPlaceScreen('/library', true)).toBe(true);
  });

  it('is false on pushed screens and on screens outside the places', () => {
    for (const pathname of ['/audience/new', '/library/abc', '/settings', '/saved']) {
      expect(onPlaceScreen(pathname, false)).toBe(false);
    }
  });
});

describe('backTarget: where Back leads on a pushed screen', () => {
  it('goes up to the place the screen belongs to', () => {
    expect(backTarget('/audience/new')).toBe('/audience');
    expect(backTarget('/library/abc')).toBe('/library');
  });

  it('goes Home from everywhere else', () => {
    expect(backTarget('/calendar')).toBe('/home');
    expect(backTarget('/home')).toBe('/home');
  });

  it("goes up to Discover from its pushed pages (when there is no history to go back in)", () => {
    for (const pathname of ['/feed/video/v1', '/feed/collection/meal-prep', '/feed/discover']) {
      expect(backTarget(pathname)).toBe('/feed');
    }
  });
});

describe("backInHistory: Discover's pushed pages go back to the grid as it was left", () => {
  it.each(['/feed/video/v1', '/feed/video/0b6f3c1e-8f2a-4c55-9d3e-2a7b1c4d5e6f', '/feed/collection/meal-prep', '/feed/discover'])(
    '%s goes back in history',
    (pathname) => {
      expect(backInHistory(pathname)).toBe(true);
    },
  );

  it.each(['/feed', '/feed/video', '/feed/collection', '/feed/channels', '/feed/discovery', '/feed/videos/v1', '/library', '/simulation/a1', '/home'])(
    '%s does not',
    (pathname) => {
      expect(backInHistory(pathname)).toBe(false);
    },
  );
});

describe("backInHistory: a creator's page goes back to the Watchlist as it was left", () => {
  it.each(['/competitors/jay.makes', '/competitors/nia.cooks'])('%s goes back in history', (pathname) => {
    expect(backInHistory(pathname)).toBe(true);
  });

  it.each(['/competitors', '/competitors/', '/competitors/compare', '/competitors/jay.makes/videos'])(
    '%s does not',
    (pathname) => {
      expect(backInHistory(pathname)).toBe(false);
    },
  );

  it('with no history to go back in, Back goes up to Discover', () => {
    expect(backTarget('/competitors/jay.makes')).toBe('/feed');
  });
});

describe('backInHistory: You, Earn and Settings go back to where the menu opened them', () => {
  it.each(['/you', '/earn', '/settings'])('%s goes back in history', (pathname) => {
    expect(backInHistory(pathname)).toBe(true);
  });

  it.each(['/you/anything', '/earn/anything', '/settings/billing', '/young', '/earnings', '/settings-old'])(
    '%s does not (exactly those three)',
    (pathname) => {
      expect(backInHistory(pathname)).toBe(false);
    },
  );
});

describe('You: a sidebar row, not a place', () => {
  it('is named You, goes to /you, and is not one of the places', () => {
    expect(YOU).toMatchObject({ label: 'You', href: '/you' });
    expect(PLACES.map((p) => p.href)).not.toContain('/you');
  });

  it('is lit on /you and under it, nowhere else; no place is lit there', () => {
    expect(youActive('/you')).toBe(true);
    expect(youActive('/you/anything')).toBe(true);
    expect(youActive('/young')).toBe(false);
    expect(youActive('/home')).toBe(false);
    expect(activePlace('/you')).toBeNull();
  });

  it('is a pushed screen on a phone: not a place screen; Back goes back in history, Home when there is no entry', () => {
    expect(onPlaceScreen('/you', false)).toBe(false);
    expect(backInHistory('/you')).toBe(true);
    expect(backTarget('/you')).toBe('/home');
  });

  it('Back from Settings goes back in history; with no entry, to You (on a phone You leads into Settings)', () => {
    expect(backInHistory('/settings')).toBe(true);
    expect(backTarget('/settings')).toBe('/you');
    expect(backTarget('/settings/billing')).toBe('/you');
  });
});

describe('Earn (plan 2026-11-24-earn): a sidebar row under You, not a place', () => {
  it('is named Earn, goes to /earn, and is not one of the places', () => {
    expect(EARN).toMatchObject({ label: 'Earn', href: '/earn' });
    expect(PLACES.map((p) => p.href)).not.toContain('/earn');
  });

  it('is lit on /earn and under it, nowhere else; neither You nor a place is lit there', () => {
    expect(earnActive('/earn')).toBe(true);
    expect(earnActive('/earn/anything')).toBe(true);
    expect(earnActive('/earnings')).toBe(false);
    expect(earnActive('/you')).toBe(false);
    expect(youActive('/earn')).toBe(false);
    expect(activePlace('/earn')).toBeNull();
  });

  it('is a pushed screen on a phone: not a place screen; Back goes back in history, to You when there is no entry', () => {
    expect(onPlaceScreen('/earn', false)).toBe(false);
    expect(backInHistory('/earn')).toBe(true);
    expect(backTarget('/earn')).toBe('/you');
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
