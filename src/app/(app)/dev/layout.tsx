import type { ReactNode } from "react";
import { notFound } from "next/navigation";

/**
 * /dev/* — developer-only tooling (the /dev/cards visual gallery — "the cheapest visual gate in the
 * repo"). It was auth-gated by the (app) layout, but auth is not dev-only: any signed-in user could
 * open /dev/cards in production, despite its "dev" header (P3, ambient-room-v2).
 *
 * This layout 404s the whole /dev tree in REAL production (VERCEL_ENV === 'production') while keeping
 * it usable on preview deploys + local dev, where the team actually reviews cards (VERCEL_ENV is
 * 'preview' / undefined there). Tighten to `NODE_ENV !== 'development'` if it should be local-only.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return children;
}
