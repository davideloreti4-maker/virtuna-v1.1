/**
 * render-with-client.tsx — RTL render under a fresh React Query provider.
 *
 * Composer (and anything mounting it: Home, HomePageLayout) calls
 * useQueryClient() to invalidate the sidebar thread list on send, so every
 * render must sit under a QueryClientProvider. One fresh client per render
 * keeps tests isolated (no cross-test cache); retries are off so a mocked
 * fetch failure surfaces immediately instead of retry-looping.
 *
 * ToastProvider mirrors production: the (app) layout wraps AppShell in it,
 * and Composer's funnel-return inlet calls useToast() (which throws without
 * the provider) — so the helper provides both, exactly like the real shell.
 *
 * The returned rerender re-wraps with the SAME client — a rerendered tree is
 * the same instance, not a new isolation boundary.
 */

import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/toast";

export function renderWithClient(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (node: ReactElement) => (
    <QueryClientProvider client={qc}>
      <ToastProvider>{node}</ToastProvider>
    </QueryClientProvider>
  );
  const result = render(wrap(ui));
  return {
    ...result,
    rerender: (next: ReactElement) => result.rerender(wrap(next)),
  };
}
