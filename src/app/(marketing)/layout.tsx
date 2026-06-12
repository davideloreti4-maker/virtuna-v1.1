import type { Metadata } from "next";

import { Nav } from "@/components/numen-landing/nav";
import { Footer } from "@/components/numen-landing/footer";

/**
 * MarketingLayout — the Numen landing route-group layout (D-01 / D-02 / D-09).
 *
 * No-html passthrough (RESEARCH Option B): the root `src/app/layout.tsx` owns the
 * only document-root and page-body landmarks. This layout renders a single
 * `.numen-surface` wrapper div — the ONE place the warm-neutral token scope
 * mounts — around exactly one Nav, one main region, and one Footer (a11y
 * single-landmark rule).
 *
 * The wrapper class is LOAD-BEARING: `@theme inline` resolves `bg-bg`/`text-text`
 * at the usage site, so every bridged token renders transparent without an
 * ancestor carrying `.numen-surface` (RESEARCH Pitfall 1). The root body stays
 * scope-free so the 7 sibling routes are untouched.
 */

export const metadata: Metadata = {
  title: "Numen — an honest verdict on your content, before you post",
  description:
    "Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="numen-surface min-h-screen bg-bg text-text">
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
