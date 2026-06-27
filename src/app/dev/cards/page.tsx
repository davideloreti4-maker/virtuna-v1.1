'use client';

/**
 * DEV-ONLY throwaway preview harness (lane/polish). Renders account-read variants for the
 * visual pass. NOT shipped — delete src/app/dev/cards before any PR.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountReadBlockRenderer } from '@/components/thread/account-read-block';
import type { AccountReadBlock } from '@/lib/tools/blocks';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const full: AccountReadBlock = {
  type: 'account-read',
  props: {
    handle: 'yourhandle',
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
            Account Read — thin fallback
          </p>
          <AccountReadBlockRenderer block={thin} />
        </div>
      </div>
    </QueryClientProvider>
  );
}
