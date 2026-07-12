/**
 * render-with-client.tsx — RTL render under a fresh React Query provider.
 *
 * Composer (and anything mounting it: Home, HomePageLayout) calls
 * useQueryClient() to invalidate the sidebar thread list on send, so every
 * render must sit under a QueryClientProvider. One fresh client per render
 * keeps tests isolated (no cross-test cache); retries are off so a mocked
 * fetch failure surfaces immediately instead of retry-looping.
 *
 * The returned rerender re-wraps with the SAME client — a rerendered tree is
 * the same instance, not a new isolation boundary.
 */

import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function renderWithClient(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (node: ReactElement) => (
    <QueryClientProvider client={qc}>{node}</QueryClientProvider>
  );
  const result = render(wrap(ui));
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(wrap(next)),
  };
}
