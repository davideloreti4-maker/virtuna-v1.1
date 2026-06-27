'use client';

/**
 * DEV-ONLY throwaway preview harness (lane/polish). Renders account-read variants for the
 * visual pass. NOT shipped — delete src/app/dev/cards before any PR.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountReadBlockRenderer } from '@/components/thread/account-read-block';
import type { AccountReadBlock } from '@/lib/tools/blocks';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const COVERS = [820000, 412000, 305000, 188000, 96000, 54000, 31000, 12000].map((views, i) => ({
  coverUrl: `https://picsum.photos/seed/numen${i}/180/320`,
  views,
  caption: `Analyzed post ${i + 1}`,
  videoUrl: `https://www.tiktok.com/@yourhandle/video/${1000 + i}`,
}));

const full: AccountReadBlock = {
  type: 'account-read',
  props: {
    handle: 'yourhandle',
    profile: {
      handle: 'yourhandle',
      displayName: 'Your Creator Name',
      avatarUrl: 'https://picsum.photos/seed/numen-avatar/96/96',
      verified: true,
      followerCount: 142_000,
      videoCount: 318,
    },
    analyzedVideos: COVERS,
    patterns: {
      working: ['Contrarian openers', 'Receipts / data posts', 'Short payoffs'],
      fix: ['Tighten setup beats', 'Move the turn earlier', 'Stop burying the CTA'],
      recurringHooks: ['"Nobody talks about…"', '"I tried X for 30 days"', 'Direct myth-bust openers'],
      formatMix: [
        { label: 'Talking-head', count: 47, pct: 47 },
        { label: 'B-roll VO', count: 30, pct: 30 },
        { label: 'Text-on-screen', count: 23, pct: 23 },
      ],
      dropPoints: ['~40% drop at the 3s mark on slow openers', 'Second drop when the payoff lands late (>20s)'],
    },
    trackRecord: { withinPct: 78, lastN: 12 },
  },
};

// Degradation: empty avatar + cover-less tiles → placeholder initial + views-only tiles.
const noMedia: AccountReadBlock = {
  type: 'account-read',
  props: {
    handle: 'plaincreator',
    profile: { handle: 'plaincreator', displayName: '', avatarUrl: '', verified: false, followerCount: 9300, videoCount: 24 },
    analyzedVideos: [410000, 88000, 22000, 9000].map((views, i) => ({
      views,
      caption: `Post ${i + 1}`,
      videoUrl: '',
    })),
    patterns: full.props.patterns,
    trackRecord: null,
  },
};

const thin: AccountReadBlock = {
  type: 'account-read',
  props: { handle: 'newcreator', fallback: 'thin' },
};

export default function DevAccountCards() {
  return (
    <QueryClientProvider client={qc}>
      <div style={{ minHeight: '100vh', background: '#262624', padding: '48px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <p style={{ color: '#8a857c', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Account Read — success
          </p>
          <AccountReadBlockRenderer block={full} />
          <p style={{ color: '#8a857c', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Account Read — no media (placeholder degradation)
          </p>
          <AccountReadBlockRenderer block={noMedia} />
          <p style={{ color: '#8a857c', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Account Read — thin fallback
          </p>
          <AccountReadBlockRenderer block={thin} />
        </div>
      </div>
    </QueryClientProvider>
  );
}
