# Phase 1: Foundation + Cross-Cutting Gates — Patterns

**Phase:** 1
**Mapped:** 2026-05-19
**Total files:** 14 created (9 code/script/spec + 5 docs) + 7 modified + 16 deleted (14 components + 2 routes)

---

## TL;DR

- **Five files are pure greenfield (no analog).** `landing.css`, `lenis-provider.tsx`, `landing-motion-provider.tsx`, `MotionWrapper.tsx`, `web-vitals-reporter.tsx`, `check-landing-scope.ts`, `capture-references.spec.ts`, `CRAFT-RUBRIC.md`, `SECTION-BRIEF-TEMPLATE.md`, and the two design-md / taste-skill fetches. RESEARCH.md §1, §2, §3, §4, §5, §7, §8, §11, §12, §13, §14 contain copy-pasteable specs — they ARE the analog.
- **Two existing files contain landmines that MUST be cleaned up, not extended naively:**
  - `src/app/(marketing)/layout.tsx` has a duplicate `<html>/<body>` block (lines 22-28) — must be deleted, not extended. Pitfall A in RESEARCH.md.
  - `verification/playwright.config.ts` uses `1440x900` desktop viewport — must change to `1280x900` to match Linear/Raycast reference snapshots.
- **One analog is canonical for backdrop-filter pattern:** `src/components/primitives/GlassPanel.tsx` (lines 40-57) is the locked pattern for inline `style={{ backdropFilter, WebkitBackdropFilter }}`. Phase 1 documents the rule in CRAFT-RUBRIC.md; future phases (HERO-01 sticky nav, BENTO glass cards) consume this directly.
- **One existing pattern MUST NOT be reused by landing components.** `src/components/motion/fade-in.tsx` (and siblings) import `motion` directly from `motion/react`. FOUND-05 + RESEARCH §3 explicitly forbid landing components from doing this — they must use `m.*` from `motion/react-m` inside the `LazyMotion strict` boundary. Landmine: looks like a perfect analog, would break strict mode at runtime.
- **`sentry.client.config.ts` does NOT exist** in this codebase. Sentry client config lives at `src/instrumentation-client.ts` (verified: 9 lines, sets DSN + tracesSampleRate: 0). Phase 1's "verify Sentry web vitals auto-capture" task targets THIS file, not the non-existent `sentry.client.config.ts`. The reporter at `src/components/landing/web-vitals-reporter.tsx` is the active deliverable.
- **`scripts/` directory exists** with `analyze-dataset.ts`, `benchmark.ts`, etc. The existing `analyze` script in `package.json` must be RENAMED to `analyze:dataset` to free the `analyze` namespace for `@next/bundle-analyzer` (RESEARCH §6).
- **`verification/scripts/` directory exists** with sibling specs (`responsive-check.spec.ts`, `token-verification.ts`). New `capture-references.spec.ts` lives here.

---

## File-to-Analog Map

### NEW Files

#### `src/app/(marketing)/landing.css`

- **Role:** config (CSS token layer)
- **Closest analog:** `src/app/globals.css` (lines 1-50) for `@theme` block pattern
- **Why:** Same project uses Tailwind v4 `@theme` for global tokens. `landing.css` is structurally similar but uses `@layer landing { :root { ... } }` instead of `@theme` (so tokens stay scoped, NOT compiled into Tailwind utility classes).
- **Code excerpt (analog — `globals.css` pattern to AVOID for landing scope):**
  ```css
  /* src/app/globals.css — lines 1-22 — THIS IS THE GLOBAL PATTERN; landing.css must NOT mutate this file */
  @import "tailwindcss";
  @import "tw-animate-css";

  @custom-variant dark (&:is(.dark *));

  @theme {
    /* PRIMITIVE TOKENS (Layer 1) */
    --color-coral-500: oklch(0.72 0.16 40);  /* Base #FF7F50 */
    /* Gray scale — note hex values for L<0.15 per Tailwind v4 oklch landmine */
    --color-gray-950: #07080a;
    /* ... */
  }
  ```
- **Code excerpt (target — from RESEARCH §1, copy verbatim):**
  ```css
  /* src/app/(marketing)/landing.css */
  @layer theme, base, components, utilities, landing;

  @layer landing {
    :root {
      --landing-text-display-xl: clamp(2.5rem, 1.4rem + 4.5vw, 5.5rem);
      --landing-ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
      --landing-dur-enter: 0.7s;
      --landing-gradient-hero-glow: radial-gradient(
        ellipse 80% 50% at 50% -10%,
        rgba(255, 127, 80, 0.12) 0%,
        transparent 70%
      );
      /* HEX ONLY for L<0.15 — Tailwind v4 oklch landmine */
      --landing-surface-base: #07080a;
      --landing-surface-elevated: #0d0d0f;
      --landing-border-hairline: rgba(255, 255, 255, 0.06);
    }
  }
  ```
- **Adapt:** Copy the full token list verbatim from RESEARCH §1 lines 158-220. Do NOT mutate `globals.css`. Do NOT add `@theme` — these tokens must stay as raw custom properties (not compiled into Tailwind utilities) so they remain scoped to the landing layer.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/app/globals.css` (lines 1-50 for the `@theme` reference + hex-for-darks proof) + RESEARCH.md §1 (lines 158-271) + `/Users/davideloreti/virtuna-landing-linear-clone/CLAUDE.md` (Known Technical Issues — Tailwind v4 oklch + Lightning CSS landmines).

---

#### `src/components/landing/lenis-provider.tsx`

- **Role:** provider (client-only React component wrapping ReactLenis)
- **Closest analog:** NONE in src/components/landing/ (the existing files there will all be DELETED). Closest structural analog: `src/components/motion/fade-in.tsx` (uses `useReducedMotion` + `"use client"` directive) BUT this analog uses full `motion` import — DO NOT copy the import path.
- **Why:** Both files are leaf client components that use `useReducedMotion` style logic for accessibility. The analog shows the project's existing reduced-motion pattern.
- **Code excerpt (analog — `fade-in.tsx` lines 1-14, reduced-motion shape):**
  ```tsx
  // src/components/motion/fade-in.tsx — REDUCED-MOTION ANALOG ONLY
  "use client";

  import { motion, useReducedMotion } from "motion/react"; // ← DO NOT COPY this import path

  export function FadeIn({ children, className, ... }) {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) {
      return <div className={className}>{children}</div>;
    }
    // ...
  }
  ```
- **Code excerpt (analog — `src/hooks/usePrefersReducedMotion.ts` lines 12-29, native MediaQueryList pattern):**
  ```ts
  // src/hooks/usePrefersReducedMotion.ts
  'use client'
  import { useState, useEffect } from 'react'

  const QUERY = '(prefers-reduced-motion: no-preference)'

  export function usePrefersReducedMotion(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(true)

    useEffect(() => {
      const mediaQueryList = window.matchMedia(QUERY)
      setPrefersReducedMotion(!mediaQueryList.matches)
      const listener = (event: MediaQueryListEvent) => {
        setPrefersReducedMotion(!event.matches)
      }
      mediaQueryList.addEventListener('change', listener)
      return () => mediaQueryList.removeEventListener('change', listener)
    }, [])

    return prefersReducedMotion
  }
  ```
- **Code excerpt (target — from RESEARCH §2, copy verbatim):**
  ```tsx
  // src/components/landing/lenis-provider.tsx
  "use client";

  import { ReactLenis } from "lenis/react";
  import { useEffect, useState } from "react";

  export function LenisProvider({ children }: { children: React.ReactNode }) {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }, []);

    return (
      <ReactLenis
        root
        options={{
          lerp: 0.08,
          duration: prefersReducedMotion ? 0 : 1.2,
          smoothWheel: !prefersReducedMotion,
          syncTouch: false,
          autoRaf: true,
        }}
      >
        {children}
      </ReactLenis>
    );
  }
  ```
- **Adapt:** Inline the `prefers-reduced-motion` detection (do NOT import `usePrefersReducedMotion` hook — it queries `no-preference` and inverts the boolean; the RESEARCH-spec query is `reduce` (positive form) which is more natural for the ReactLenis options. Inlining matches RESEARCH spec exactly and avoids a dependency on a hook that may be re-purposed for `(app)/` routes.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/hooks/usePrefersReducedMotion.ts` (full file, 29 lines) + `/Users/davideloreti/virtuna-landing-linear-clone/src/components/motion/fade-in.tsx` (lines 1-14, reduced-motion shape only) + RESEARCH.md §2 (lines 273-381).

---

#### `src/components/landing/landing-motion-provider.tsx`

- **Role:** provider (LazyMotion wrapper)
- **Closest analog:** NONE — landing component motion architecture is a new convention introduced this milestone. RESEARCH §3 is the spec.
- **Why:** Existing `src/components/motion/*.tsx` files import `motion` directly (no LazyMotion); they live in dashboard scope. Landing breaks new ground with `LazyMotion strict`.
- **Code excerpt (target — from RESEARCH §3, copy verbatim):**
  ```tsx
  // src/components/landing/landing-motion-provider.tsx
  "use client";

  import { LazyMotion, domAnimation } from "motion/react";

  /**
   * Wraps landing routes with LazyMotion + domAnimation features.
   * Reduces initial motion library bundle from ~34 KB gzipped to ~4.6 KB.
   *
   * `strict` enabled: throws at runtime if any landing component imports `motion.*`
   * instead of `m.*` from `motion/react-m`.
   */
  export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
    return (
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    );
  }
  ```
- **Adapt:** Copy verbatim. No customization needed. Strict mode is the linting mechanism (per RESEARCH §3) — keep it on.
- **Read first:** RESEARCH.md §3 (lines 386-459) + `/Users/davideloreti/virtuna-landing-linear-clone/src/components/motion/index.ts` (to confirm landing must NOT import from this barrel).

---

#### `src/components/MotionWrapper.tsx`

- **Role:** component (leaf "use client" wrapper for animated bits)
- **Closest analog:** `src/components/motion/fade-in-up.tsx` and `src/components/motion/stagger-reveal.tsx` (leaf wrapper shape with viewport entry animation) — these import `motion` directly. The convention RESEARCH establishes is identical in shape but uses `m.*` import path.
- **Why:** Existing leaf wrappers like `FadeIn` and `FadeInUp` are exactly the pattern FOUND-10 documents — section is RSC, animated leaf is "use client". The landing wrapper inherits the shape but flips the import to `m.*`.
- **Code excerpt (analog — `src/components/motion/fade-in.tsx` lines 28-63, leaf wrapper shape):**
  ```tsx
  // src/components/motion/fade-in.tsx — LANDMINE: uses `motion` direct, NOT m.*
  export function FadeIn({ children, className, delay = 0, ... }) {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) {
      return <div className={className}>{children}</div>;
    }
    return (
      <motion.div
        className={className}
        initial="hidden"
        whileInView="visible"
        viewport={{ once, margin: "-100px" }}
        variants={{ ... }}
      >
        {children}
      </motion.div>
    );
  }
  ```
- **Code excerpt (target — from RESEARCH §4, hero-animated-headline example, copy structure):**
  ```tsx
  // src/components/MotionWrapper.tsx (per FOUND-10)
  "use client";

  import * as m from "motion/react-m";
  import type { ReactNode, ComponentProps } from "react";

  /**
   * Thin "use client" wrapper around animated landing leaves.
   * Wrap only the smallest piece that needs motion — NEVER wrap whole sections (AS-15).
   */
  export function MotionWrapper({
    children,
    ...motionProps
  }: { children: ReactNode } & ComponentProps<typeof m.div>) {
    return <m.div {...motionProps}>{children}</m.div>;
  }
  ```
- **Adapt:** This file is a thin documentation-example wrapper. Phase 2+ will create more specific leaves (HeroAnimatedHeadline, HeroCtaGroup). The file's primary purpose in Phase 1 is to PROVE the `m.*` import path works under `LazyMotion strict` (the build step would error otherwise). Keep tiny — its job is to be the canonical example referenced from CRAFT-RUBRIC.md.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/components/motion/fade-in.tsx` (full file, lines 1-63) + `/Users/davideloreti/virtuna-landing-linear-clone/src/components/motion/stagger-reveal.tsx` (shape reference) + RESEARCH.md §4 (lines 462-545).

---

#### `src/components/landing/web-vitals-reporter.tsx`

- **Role:** reporter (client component using `useReportWebVitals`)
- **Closest analog:** NONE — first usage of `next/web-vitals` in this codebase. Closest behavioral analog: `src/instrumentation-client.ts` (existing Sentry client init).
- **Why:** Both files are client-side reporters — one is the existing Sentry init, the new one is the dev-console + Sentry-tag complement for landing route.
- **Code excerpt (analog — `src/instrumentation-client.ts`, full file, 9 lines):**
  ```ts
  // src/instrumentation-client.ts — CURRENT Sentry init (verify INP auto-capture)
  import * as Sentry from "@sentry/nextjs";

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,   // ← Note: 0 in client; Phase 1 task documents this in CRAFT-RUBRIC.md (Pitfall C)
  });

  export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
  ```
- **Code excerpt (target — from RESEARCH §7, copy verbatim):**
  ```tsx
  // src/components/landing/web-vitals-reporter.tsx
  "use client";

  import { useReportWebVitals } from "next/web-vitals";
  import { usePathname } from "next/navigation";
  import { useEffect } from "react";
  import * as Sentry from "@sentry/nextjs";

  export function WebVitalsReporter() {
    const pathname = usePathname();
    const isLandingRoute = pathname === "/" || pathname?.startsWith("/(marketing)");

    useEffect(() => {
      if (isLandingRoute) {
        Sentry.setTag("route", "landing");
      }
    }, [isLandingRoute]);

    useReportWebVitals((metric) => {
      if (!isLandingRoute) return;

      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(
          `[web-vital:${metric.name}]`,
          Math.round(metric.value),
          metric.rating ?? "—",
          `(id: ${metric.id})`
        );
      }
      // Prod: Sentry browserTracingIntegration captures automatically.
    });

    return null;
  }
  ```
- **Adapt:** Copy verbatim. The pathname guard is defensive — even though the component is mounted only inside `(marketing)/layout.tsx`, the guard hedges against future moves to root layout (per RESEARCH §7).
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/instrumentation-client.ts` (full file) + RESEARCH.md §7 (lines 769-841). **Note for executor:** `sentry.client.config.ts` is mentioned in CONTEXT integration points but does NOT exist in this codebase — DO NOT create it. Sentry client init lives in `src/instrumentation-client.ts` (Next.js 16 / Sentry 10.x convention).

---

#### `scripts/check-landing-scope.ts`

- **Role:** guard (grep-based CI scope check)
- **Closest analog:** `verification/scripts/regression-audit.ts` (existing Node script that walks the codebase and reports violations) + `verification/scripts/hardcoded-values-scan.ts` (filesystem walker + regex pattern matcher with violation reporting). Both live in `verification/scripts/`, not `scripts/`; the landing-scope guard lives at `scripts/` because RESEARCH §8 places it there (for `prebuild` invocation from `package.json` root).
- **Why:** Same filesystem-walking + regex pattern + exit code on violation — directly transferable shape.
- **Code excerpt (target — from RESEARCH §8, copy verbatim):**
  ```typescript
  #!/usr/bin/env node
  // scripts/check-landing-scope.ts
  import { readdirSync, readFileSync, statSync } from "node:fs";
  import { join, relative, resolve } from "node:path";

  const PROJECT_ROOT = resolve(__dirname, "..");
  const SRC_DIR = join(PROJECT_ROOT, "src");
  const ALLOWED_PREFIX = "src/app/(marketing)/";
  const PATTERN = /import\s+["'][^"']*landing\.css["']/;

  const ext = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css"];
  const violations: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) { walk(full); continue; }
      if (!ext.some((e) => entry.endsWith(e))) continue;
      const content = readFileSync(full, "utf8");
      if (!PATTERN.test(content)) continue;
      const rel = relative(PROJECT_ROOT, full).replace(/\\/g, "/");
      if (!rel.startsWith(ALLOWED_PREFIX)) {
        violations.push(rel);
      }
    }
  }

  walk(SRC_DIR);

  if (violations.length > 0) {
    console.error("ERROR: landing.css imported outside src/app/(marketing)/:");
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log("OK: landing.css scope check passed.");
  process.exit(0);
  ```
- **Adapt:** Copy verbatim. Add `tsx` runner wiring in `package.json` scripts as `"check:landing-scope": "tsx scripts/check-landing-scope.ts"` + add `"prebuild": "pnpm run check:landing-scope"` (RESEARCH §8). Verify no existing `prebuild` script in `package.json` first (RESEARCH Assumption A6 — verified empty as of 2026-05-19).
- **Read first:** RESEARCH.md §8 (lines 843-936) + `/Users/davideloreti/virtuna-landing-linear-clone/verification/scripts/hardcoded-values-scan.ts` (existing filesystem-walker pattern in this codebase, for style consistency).

---

#### `verification/scripts/capture-references.spec.ts`

- **Role:** spec (Playwright reference snapshot capture)
- **Closest analog:** `verification/scripts/visual-comparison.spec.ts` (uses `@playwright/test`, configures viewports, captures screenshots with `page.screenshot()`)
- **Why:** Same `@playwright/test` framework, same screenshot mechanism, same output directory pattern. Different target (external sites: linear.app, raycast.com) and different output (verification/reference/, not verification/reports/screenshots/).
- **Code excerpt (analog — `visual-comparison.spec.ts` lines 218-250, screenshot capture loop):**
  ```typescript
  // verification/scripts/visual-comparison.spec.ts — line 218+
  test.describe('Visual Comparison Screenshots', () => {
    for (const pageConfig of PAGES) {
      test(`Capture ${pageConfig.name}`, async ({ page }) => {
        ensureDirs();
        await page.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);

        const screenshotPath = path.join(VIRTUNA_SCREENSHOTS_DIR, pageConfig.filename);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        // ...
      });
    }
  });
  ```
- **Code excerpt (target — from RESEARCH §5, copy verbatim):**
  ```typescript
  // verification/scripts/capture-references.spec.ts
  import { test } from '@playwright/test';
  import path from 'path';

  const REFERENCE_DIR = path.resolve(__dirname, '../reference');

  const TARGETS = [
    { url: 'https://linear.app',          viewport: { width: 1280, height: 900 }, out: 'linear-desktop-1280.png' },
    { url: 'https://linear.app',          viewport: { width: 768,  height: 1024 }, out: 'linear-tablet-768.png' },
    { url: 'https://linear.app',          viewport: { width: 375,  height: 812 },  out: 'linear-mobile-375.png' },
    { url: 'https://linear.app/features', viewport: { width: 1280, height: 900 }, out: 'linear-bento.png' },
    { url: 'https://linear.app/pricing',  viewport: { width: 1280, height: 900 }, out: 'linear-pricing.png' },
    { url: 'https://raycast.com',         viewport: { width: 1280, height: 900 }, out: 'raycast-desktop-1280.png' },
    { url: 'https://raycast.com',         viewport: { width: 768,  height: 1024 }, out: 'raycast-tablet-768.png' },
    { url: 'https://raycast.com',         viewport: { width: 375,  height: 812 },  out: 'raycast-mobile-375.png' },
    { url: 'https://raycast.com',         viewport: { width: 1280, height: 900 }, out: 'raycast-feature-section.png', selector: '[data-section="features"]' },
  ];

  for (const target of TARGETS) {
    test(`Capture ${target.out}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: target.viewport, colorScheme: 'dark' });
      const page = await context.newPage();
      await page.goto(target.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);
      const outPath = path.join(REFERENCE_DIR, target.out);
      if (target.selector) {
        await page.locator(target.selector).first().screenshot({ path: outPath });
      } else {
        await page.screenshot({ path: outPath, fullPage: false });
      }
      await context.close();
    });
  }
  ```
- **Adapt:** Copy verbatim from RESEARCH §5. Wire `"capture:refs": "playwright test verification/scripts/capture-references.spec.ts --config=verification/playwright.config.ts --project=desktop"` in `package.json`. NOTE: external sites may show Cloudflare challenges — RESEARCH §5 lines 663-664 document the manual fallback (capture in Chrome at viewport, save into `verification/reference/`).
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/verification/scripts/visual-comparison.spec.ts` (full file for `@playwright/test` import + browser context + screenshot pattern) + RESEARCH.md §5 (lines 547-664) + §13 (lines 1284-1318).

---

#### `.planning/CRAFT-RUBRIC.md`

- **Role:** doc (per-phase rubric + anti-slop blacklist + landmines)
- **Closest analog:** `.planning/research/anti-slop-design-playbook.md` (already contains AS-01..AS-15 source content; RUBRIC embeds these). Existing in same `.planning/` directory.
- **Why:** RUBRIC re-uses AS-01..AS-15 verbatim from playbook (D-08). The playbook is the source of truth; RUBRIC adds the per-phase 6-dimension scoring + bundle budget + locked repo landmines.
- **Code excerpt (target — from RESEARCH §11, copy full skeleton):**
  ```markdown
  # Virtuna Landing — Craft Rubric

  **Purpose:** Per-phase gate. A phase fails its visual gate if 2 or more dimensions score FAIL (5/6 must PASS to ship).
  **Consumed by:** gsd-ui-checker agent (machine-parseable scoring), Davide (human visual review).
  **Locked:** 2026-05-19.

  ---

  ## 6 Dimensions — each scored PASS / FAIL with one-sentence justification

  ### 1. Typography Precision
  **Pass criteria:**
  - Headings use `var(--landing-text-display-*)` tokens, NOT inline Tailwind classes
  - `letter-spacing` is explicit: `-0.03em` display, `-0.02em` headlines, `0` body
  - `line-height` is explicit per scale tier (display = 1.05, body = 1.65)
  - Optical sizing active (`font-optical-sizing: auto` in globals.css)

  **Fail signals:**
  - `text-7xl` directly in markup without landing token
  - Heading line-height is browser default (`1.2` for h1)

  ### 2. Spacing Rhythm / ### 3. Motion Choreography / ### 4. Contrast / ### 5. Mobile Bar / ### 6. Anti-Slop Discipline
  [... 6-dimension structure as shown in RESEARCH §11 ...]

  ## AS-01..AS-15 Anti-Slop Blacklist
  | ID | Forbidden | Refined alternative |
  |----|-----------|---------------------|
  | AS-01 | Purple / rainbow / "AI-orb" radial gradients | Coral #FF7F50 only |
  | AS-15 | Section-level Framer Motion wrappers | Leaf-level m.* wrappers |

  ## Bundle Budget
  | Surface | Budget | Baseline | Status |
  | Hero critical path | < 200 KB gzipped | TBD-Phase1 | TBD |

  ## Locked Repo Landmines (NON-NEGOTIABLE)
  ### 1. Backdrop-filter via inline style + Safari prefix
  ### 2. Dark tokens (L < 0.15) in hex, never oklch
  ### 3. Dev server cache reset protocol
  ```
- **Adapt:** Copy the full skeleton from RESEARCH §11 (lines 1054-1192). Verbatim-copy AS-01..AS-15 from `/Users/davideloreti/virtuna-landing-linear-clone/.planning/research/anti-slop-design-playbook.md` (Davide's source-of-truth). Insert Phase 1's `analyze` baseline once measured (D-26).
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/.planning/research/anti-slop-design-playbook.md` (full file — AS-01..AS-15 source) + RESEARCH.md §11 (lines 1049-1192) + RESEARCH.md §10 (locked landmines) + RESEARCH.md §1 lines 240-258 (oklch hex-for-darks rule).

---

#### `.planning/SECTION-BRIEF-TEMPLATE.md`

- **Role:** template (7-subsection markdown template for per-phase briefs)
- **Closest analog:** `.planning/phases/01-foundation-cross-cutting-gates/01-CONTEXT.md` (markdown structure with structured sections + parseable headers). Also `.planning/research/anti-slop-design-playbook.md`.
- **Why:** Same project's markdown structure for parseable agent inputs — both use `## N. Section name` headers as machine-readable tokens.
- **Code excerpt (target — from RESEARCH §12, copy full skeleton):**
  ```markdown
  # Section Brief — [Section Name]

  **Phase:** [N — phase name]
  **Owner:** Davide (narrative) + Claude (execution)
  **Created:** [YYYY-MM-DD]
  **Status:** Draft / Approved / Locked

  ---

  ## 1. Purpose in Virtuna's narrative
  [ONE paragraph — must be derivable from Virtuna's narrative alone without reference to linear.app]

  ## 2. Audience served
  [Creator / Investor / Partner — what THIS audience needs]

  ## 3. Content — original Virtuna copy
  - **Eyebrow / pre-headline:** [exact text]
  - **H1 / section headline:** [exact text]
  - **CTAs:** [exact button text + destination]

  ## 4. Interaction goals
  - **Default state / Hover / Active / Scroll behavior / Reduced-motion fallback**

  ## 5. Success criteria
  - [ ] Visible at 375 / 768 / 1280 (no horizontal overflow)
  - [ ] Section copy delivered from this brief — no agent ad-libbing

  ## 6. Anti-slop list for THIS section
  - **AS-XX** — specific guard for this section

  ## 7. Reference anchors
  - **linear.app:** [URL path + anchored craft observation]
  - **raycast.com:** [URL path + anchored craft observation]
  - **DESIGN.md citation:** [path + line range]

  *Brief written before any markup. Approved by Davide before Phase N execution begins.*
  ```
- **Adapt:** Copy the full skeleton from RESEARCH §12 (lines 1199-1262) verbatim. The 7 `## N.` headers are parseable tokens — keep the numeric prefix.
- **Read first:** RESEARCH.md §12 (lines 1195-1281) + `/Users/davideloreti/virtuna-landing-linear-clone/.planning/PROJECT.md` (Virtuna narrative source) + `/Users/davideloreti/virtuna-landing-linear-clone/.planning/REQUIREMENTS.md` (audience definitions).

---

#### `.planning/reference/design-md/linear.md` + `.planning/reference/design-md/raycast.md`

- **Role:** doc (external design DSL — fetched, not authored)
- **Closest analog:** NONE — these are fetched from VoltAgent/awesome-design-md. No local authoring required.
- **Why:** D-12 + RESEARCH §13.B specify direct curl from GitHub raw.
- **Code excerpt (target — from RESEARCH §13.B, copy commands verbatim):**
  ```bash
  mkdir -p .planning/reference/design-md
  curl -s -o .planning/reference/design-md/linear.md  \
    https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/linear.app/DESIGN.md
  curl -s -o .planning/reference/design-md/raycast.md \
    https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/raycast/DESIGN.md
  ```
- **Adapt:** Use curl exactly as specified. Note path quirks (RESEARCH §13.B): `design-md/linear.app/` has `.app` suffix; `design-md/raycast/` does NOT have `.com` suffix.
- **Read first:** RESEARCH.md §13.B (lines 1301-1318). Verify HTTP 200 on both URLs before commit. If 404 at execution time, manually download from GitHub web UI (low risk per Assumption A3).

---

#### `.claude/skills/taste-virtuna/SKILL.md`

- **Role:** doc (Claude Skill SKILL.md install)
- **Closest analog:** Other `.claude/skills/*/SKILL.md` files in this project — none currently exist locally in this worktree. Source upstream: `github.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md`.
- **Why:** Skill format is standardized (frontmatter `name`, `description`, `allowed-tools`). Manual fallback shown in RESEARCH §14.
- **Code excerpt (target — from RESEARCH §14, copy structure):**
  ```markdown
  ---
  name: taste-virtuna
  description: Anti-slop frontend design guard for Virtuna's Linear Landing Clone milestone. 3-parameter equalizer + AS-01..AS-15 anti-slop blacklist + coral-only palette enforcement.
  allowed-tools: Read, Grep, Glob
  ---

  # Taste Skill — Virtuna Variant

  ## Equalizer parameters (locked for landing milestone)
  - **DESIGN_VARIANCE: 8/10** — favor creative asymmetry
  - **MOTION_INTENSITY: 6/10** — moderate motion
  - **VISUAL_DENSITY: 4/10** — airy, breathing space

  ## Hard rules
  Inherits all AS-01..AS-15 anti-slop blacklist from .planning/CRAFT-RUBRIC.md.
  Adds:
  - BANNED: any color outside the coral scale + grayscale + accent foreground
  - REQUIRED: optical sizing active (font-optical-sizing: auto)
  - REQUIRED: backdrop-filter via inline style only (Safari prefix included)

  ## Used by
  - gsd-ui-checker (per-phase gate)
  - gsd-ui-researcher (Phase 2-7 starts)
  ```
- **Adapt:** Try `npx skills add` first (RESEARCH §14 line 1338-1340), then `mv .claude/skills/design-taste-frontend .claude/skills/taste-virtuna`. If `npx skills` not available, use the manual curl fallback (line 1344-1347) + the Virtuna-tuned frontmatter+equalizer block above.
- **Read first:** RESEARCH.md §14 (lines 1322-1392) + `.planning/CRAFT-RUBRIC.md` once written (this Phase 1 deliverable references it).

---

#### `verification/reference/linear-*.png` + `raycast-*.png` + `verification/baselines/dashboard-*.png`

- **Role:** asset (PNG snapshots — produced by Playwright)
- **Closest analog:** `verification/reports/screenshots/virtuna/*.png` (existing Playwright screenshot output dir).
- **Why:** Same Playwright capture pipeline, same PNG output.
- **Adapt:** Run `pnpm run capture:refs` (Linear/Raycast snapshots) and a one-shot manual `playwright test` on the current `main` baseline (dashboard regression) — both produce 9 + 3 PNG files into the target dirs. Per D-07, refresh is manual and only on visible-difference basis.
- **Read first:** RESEARCH.md §13.A (lines 1284-1298) + the `capture-references.spec.ts` (sibling new file) + RESEARCH.md §5 (`dashboard-baseline-1280.png` capture, line 588-590).

---

### MODIFIED Files

#### `src/app/(marketing)/layout.tsx`

- **Current state:** 28 lines — imports `Inter`, `Header`, declares its own `<html className={inter.variable}><body className="min-h-screen bg-background font-sans antialiased">{Header + children}</body></html>` block. **BUG: duplicates `<html>/<body>` from root layout (Pitfall A).**
- **Target state:** Imports `globals.css` + `landing.css` + `lenis/dist/lenis.css`. Wraps children in `<LenisProvider><LandingMotionProvider>...</LandingMotionProvider></LenisProvider>` + renders `<Header />` and `<WebVitalsReporter />`. NO `<html>`, NO `<body>`, NO local `Inter` import.
- **Diff strategy:** rewrite (most of the file changes; surgical edit risks leaving the duplicate `<html>`)
- **Code excerpt (current, full file):**
  ```tsx
  // src/app/(marketing)/layout.tsx — CURRENT (28 lines)
  import type { Metadata } from "next";
  import { Inter } from "next/font/google";
  import { Header } from "@/components/layout/header";
  import "../globals.css";

  const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
  });

  export const metadata: Metadata = {
    title: "Artificial Societies | Human Behavior, Simulated",
    description: "AI personas that replicate real-world attitudes...",
  };

  export default function MarketingLayout({
    children,
  }: Readonly<{ children: React.ReactNode }>) {
    return (
      <html lang="en" className={`${inter.variable}`}>      {/* ← DUPLICATE from root layout */}
        <body className="min-h-screen bg-background font-sans antialiased">  {/* ← DUPLICATE */}
          <Header />
          {children}
        </body>
      </html>
    );
  }
  ```
- **Code excerpt (target — from RESEARCH §2/§3 integration, copy verbatim):**
  ```tsx
  // src/app/(marketing)/layout.tsx — TARGET
  import "../globals.css";
  import "./landing.css";
  import "lenis/dist/lenis.css";

  import { Header } from "@/components/layout/header";
  import { LenisProvider } from "@/components/landing/lenis-provider";
  import { LandingMotionProvider } from "@/components/landing/landing-motion-provider";
  import { WebVitalsReporter } from "@/components/landing/web-vitals-reporter";

  export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
      <LenisProvider>
        <LandingMotionProvider>
          <Header />
          {children}
          <WebVitalsReporter />
        </LandingMotionProvider>
      </LenisProvider>
    );
  }
  ```
- **Adapt:**
  1. Delete the `Inter` import + initialization (it lives in root layout — `src/app/layout.tsx` lines 6-10).
  2. Delete the existing `metadata` (it was for "Artificial Societies" — wrong product). Phase 1 page.tsx now declares its own metadata (per RESEARCH Example 7); marketing layout no longer needs route-level metadata.
  3. Delete `<html>/<body>` (root layout's responsibility).
  4. Add 3 CSS imports in EXACT order: globals.css → landing.css → lenis/dist/lenis.css (RESEARCH §1 line 232-238 explains the order matters).
  5. Add 3 provider/component imports (LenisProvider, LandingMotionProvider, WebVitalsReporter).
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/app/(marketing)/layout.tsx` (current, 28 lines) + `/Users/davideloreti/virtuna-landing-linear-clone/src/app/layout.tsx` (lines 1-50 — root layout proves `<html>/<body>` already declared) + RESEARCH.md §2 lines 333-360 + RESEARCH.md "Pitfall A" lines 1618-1624.

---

#### `src/app/(marketing)/page.tsx`

- **Current state:** 21 lines — imports 7 section components from `@/components/landing` + `Footer`, renders them in a `<main>`. All imports point to files being deleted in this phase.
- **Target state:** ~20 lines — empty `<main>` with 7 `<section data-section="...">` placeholders + page-level metadata. NO imports from `@/components/landing` (directory is being deleted).
- **Diff strategy:** REPLACE entirely
- **Code excerpt (current, full file):**
  ```tsx
  // src/app/(marketing)/page.tsx — CURRENT (will be entirely replaced)
  import {
    HeroSection, BackersSection, FeaturesSection, StatsSection,
    CaseStudySection, PartnershipSection, FAQSection,
  } from "@/components/landing";    // ← @/components/landing being deleted in same commit
  import { Footer } from "@/components/layout/footer";

  export default function HomePage() {
    return (
      <>
        <main>
          <HeroSection />
          <BackersSection />
          <FeaturesSection />
          <StatsSection />
          <CaseStudySection />
          <PartnershipSection />
          <FAQSection />
        </main>
        <Footer />
      </>
    );
  }
  ```
- **Code excerpt (target — from RESEARCH §16 Example 7, copy verbatim):**
  ```tsx
  // src/app/(marketing)/page.tsx — TARGET (Phase 1 day-1)
  import type { Metadata } from "next";

  export const metadata: Metadata = {
    title: "Virtuna | AI Content Intelligence for TikTok Creators",
    description:
      "Know what will go viral before you post. AI-powered predictions, trend intelligence, and audience insights for TikTok creators.",
  };

  export default function LandingPage() {
    return (
      <main>
        <section data-section="hero">{/* Phase 2 — Nav + Hero */}</section>
        <section data-section="bento">{/* Phase 3 — Feature Bento */}</section>
        <section data-section="how-it-works">{/* Phase 4 — How It Works */}</section>
        <section data-section="behavioral-moat">{/* Phase 5 — Behavioral Science Moat */}</section>
        <section data-section="social-proof">{/* Phase 6 — Stat Counters */}</section>
        <section data-section="pricing" id="pricing">{/* Phase 7 — Pricing */}</section>
        <section data-section="footer">{/* Phase 7 — Footer */}</section>
      </main>
    );
  }
  ```
- **Adapt:** Copy verbatim. The `id="pricing"` on the pricing section is CRITICAL — it's the anchor target for the `/pricing → /#pricing` redirect (D-23, RESEARCH §6). Without the `id`, the fragment-scroll fails silently.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/app/(marketing)/page.tsx` (current, 21 lines) + RESEARCH.md §16 Example 7 (lines 1715-1741) + CONTEXT.md D-20/D-21.

---

#### `src/app/layout.tsx`

- **Current state:** 51 lines — root layout with Inter font (no `axes`), full metadata block, `<html className={inter.variable}><body>` structure, `DevClickToComponent`.
- **Target state:** Add `axes: ["opsz"]` to the `Inter()` call. No structural changes.
- **Diff strategy:** inline-edit (one-line addition)
- **Code excerpt (current — lines 6-10):**
  ```tsx
  // src/app/layout.tsx — CURRENT
  const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
  });
  ```
- **Code excerpt (target — from RESEARCH §9, add one line):**
  ```tsx
  // src/app/layout.tsx — TARGET
  const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
    axes: ["opsz"],   // ← ADD THIS — unlocks optical sizing axis (FOUND-06)
  });
  ```
- **Adapt:** Single-line addition to the `Inter()` config object. No other changes. Verify `font-optical-sizing: auto` is in `globals.css` html/body block (RESEARCH §9 lines 962-973 — currently exists at globals.css lines 286-296 per RESEARCH §9). If missing, add it.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/app/layout.tsx` (full file, 51 lines) + `/Users/davideloreti/virtuna-landing-linear-clone/src/app/globals.css` lines 286-296 (verify `font-optical-sizing: auto` is present) + RESEARCH.md §9 (lines 940-989).

---

#### `next.config.ts`

- **Current state:** 24 lines — `withSentryConfig(nextConfig, { ... })` with `transpilePackages: ['three']`, `images.remotePatterns` (picsum, fastly.picsum). NO `images.formats`, NO `redirects`, NO `withBundleAnalyzer`.
- **Target state:** Add `images.formats: ['image/avif', 'image/webp']`, add `async redirects()` for `/pricing → /#pricing`, wrap entire export in `withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })`.
- **Diff strategy:** extend (preserve transpilePackages + remotePatterns + Sentry wrap)
- **Code excerpt (current, full file):**
  ```typescript
  // next.config.ts — CURRENT (24 lines)
  import type { NextConfig } from "next";
  import { withSentryConfig } from "@sentry/nextjs";

  const nextConfig: NextConfig = {
    transpilePackages: ['three'],
    images: {
      remotePatterns: [
        { protocol: 'https', hostname: 'picsum.photos' },
        { protocol: 'https', hostname: 'fastly.picsum.photos' },
      ],
    },
  };

  export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
  });
  ```
- **Code excerpt (target — from RESEARCH §6, copy verbatim):**
  ```typescript
  // next.config.ts — TARGET
  import type { NextConfig } from "next";
  import { withSentryConfig } from "@sentry/nextjs";
  import withBundleAnalyzer from "@next/bundle-analyzer";

  const nextConfig: NextConfig = {
    transpilePackages: ['three'],
    images: {
      formats: ['image/avif', 'image/webp'],         // FOUND-07
      remotePatterns: [
        { protocol: 'https', hostname: 'picsum.photos' },
        { protocol: 'https', hostname: 'fastly.picsum.photos' },
      ],
    },
    async redirects() {                              // D-23
      return [
        { source: '/pricing', destination: '/#pricing', permanent: true },
      ];
    },
  };

  const withAnalyzer = withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  });

  // Compose order: BundleAnalyzer (outer) → Sentry (middle) → nextConfig (inner)
  export default withAnalyzer(
    withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
    })
  );
  ```
- **Adapt:** Preserve `transpilePackages: ['three']` and existing `remotePatterns` block. Add `formats` inside `images`. Add `async redirects()`. Add the `withAnalyzer` composition. Composition order matters (RESEARCH §6 line 760-763) — BundleAnalyzer wraps the Sentry-instrumented config.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/next.config.ts` (current, 24 lines) + RESEARCH.md §6 (lines 668-764).

---

#### `src/instrumentation-client.ts` (NOT `sentry.client.config.ts` — that file does NOT exist)

- **Current state:** 9 lines — basic `Sentry.init({ dsn, environment, tracesSampleRate: 0 })` + router transition export.
- **Target state:** NO CHANGE for Phase 1. Verify (don't modify) that web vitals auto-capture works via `browserTracingIntegration` (Sentry 10.x default per RESEARCH §7 line 770-772). RESEARCH §7 + Pitfall C document that `tracesSampleRate: 0` will NOT show web vitals — but raising it is OUT of Phase 1 scope unless Davide requests it.
- **Diff strategy:** verify-only (no edit). The active deliverable is the WebVitalsReporter component, which dev-console-logs and adds the `route: "landing"` Sentry tag.
- **Code excerpt (current, full file):**
  ```ts
  // src/instrumentation-client.ts — CURRENT (9 lines, verify-only)
  import * as Sentry from "@sentry/nextjs";

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,   // ← Pitfall C: web vitals from pageload transactions sample at this rate
  });

  export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
  ```
- **Adapt:** Verify (don't modify). Document in CRAFT-RUBRIC.md "Pitfall C" — if web vitals don't appear in Sentry dashboard after Phase 1 ships, the fix is to set `tracesSampleRate: 1.0` here (NOT in `sentry.server.config.ts` — that's edge/server). Out of Phase 1 scope unless Davide flags.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/src/instrumentation-client.ts` (full file, 9 lines) + `/Users/davideloreti/virtuna-landing-linear-clone/sentry.server.config.ts` + RESEARCH.md §7 (lines 769-841) + RESEARCH.md "Pitfall C" lines 1632-1640.

---

#### `verification/scripts/visual-comparison.spec.ts`

- **Current state:** 494 lines — captures Homepage + showcase routes at 1440x900, uses positional selectors (`main > *:first-child`), compares against Phase 39 Raycast baseline screenshots (a now-archived extraction set).
- **Target state:** Homepage entry uses `section[data-section="<name>"]` selectors for all 7 sections + adds a `referenceBaselines` field comparing hero/bento/pricing against `verification/reference/linear-*.png`. Adds a new `Dashboard regression` entry comparing `/app/dashboard` body against `verification/reference/dashboard-baseline-1280.png` (FOUND-13 token-leakage check).
- **Diff strategy:** extend (preserve Playwright framework, diff/report machinery; replace the PAGES array Homepage entry + add Dashboard entry)
- **Code excerpt (current — Homepage entry, lines 66-96):**
  ```typescript
  // CURRENT — positional selectors (fragile)
  {
    name: 'Homepage',
    url: '/',
    filename: 'homepage.png',
    raycastBaseline: '02-homepage-hero.png',
    sections: [
      { name: 'Hero Section',     selector: 'main > *:first-child', filename: 'homepage-hero.png', raycastBaseline: '02-homepage-hero.png' },
      { name: 'Features Section', selector: 'main > *:nth-child(3)', filename: 'homepage-features.png', raycastBaseline: '04-section-3.png' },
      { name: 'Stats Section',    selector: 'main > *:nth-child(4)', filename: 'homepage-stats.png' },
      { name: 'Footer',           selector: 'footer', filename: 'homepage-footer.png' },
    ],
  },
  ```
- **Code excerpt (target — from RESEARCH §5, copy verbatim):**
  ```typescript
  // TARGET — data-section selectors + reference comparison
  {
    name: 'Landing — Full Page',
    url: '/',
    filename: 'landing-full.png',
    sections: [
      { name: 'Nav',             selector: 'nav',                                     filename: 'landing-nav.png' },
      { name: 'Hero',            selector: 'section[data-section="hero"]',            filename: 'landing-hero.png' },
      { name: 'Bento',           selector: 'section[data-section="bento"]',           filename: 'landing-bento.png' },
      { name: 'How It Works',    selector: 'section[data-section="how-it-works"]',    filename: 'landing-how-it-works.png' },
      { name: 'Behavioral Moat', selector: 'section[data-section="behavioral-moat"]', filename: 'landing-behavioral-moat.png' },
      { name: 'Social Proof',    selector: 'section[data-section="social-proof"]',    filename: 'landing-social-proof.png' },
      { name: 'Pricing',         selector: 'section[data-section="pricing"]',         filename: 'landing-pricing.png' },
      { name: 'Footer',          selector: 'section[data-section="footer"]',          filename: 'landing-footer.png' },
    ],
    referenceBaselines: [
      { selector: 'section[data-section="hero"]',    referenceFile: 'verification/reference/linear-desktop-1280.png', diffName: 'hero-vs-linear.png' },
      { selector: 'section[data-section="bento"]',   referenceFile: 'verification/reference/linear-bento.png',        diffName: 'bento-vs-linear.png' },
      { selector: 'section[data-section="pricing"]', referenceFile: 'verification/reference/linear-pricing.png',      diffName: 'pricing-vs-linear.png' },
    ],
  },
  // NEW — dashboard regression entry (D-05a, FOUND-13)
  {
    name: 'Dashboard regression — token leakage check',
    url: '/app/dashboard',
    filename: 'dashboard-regression.png',
    referenceBaselines: [
      { selector: 'body', referenceFile: 'verification/reference/dashboard-baseline-1280.png', diffName: 'dashboard-vs-baseline.png' },
    ],
  },
  ```
- **Adapt:**
  1. Replace the Homepage entry's `sections[]` and `raycastBaseline` with the `data-section` selectors + new `referenceBaselines` field.
  2. Add the Dashboard regression entry.
  3. Extend the `PageCapture` interface (line 23-29) and `SectionCapture` interface to add `referenceBaselines?: ReferenceComparison[]` and a matching `ReferenceComparison` interface.
  4. Extend the capture loop (line 224+) to also iterate `referenceBaselines` and call `generateDiff()` per reference (the existing `generateDiff` function at lines 144-184 works as-is — just pass the reference path as `raycastPath`).
  5. Preserve the existing diff/report generator (lines 322-440) — the reports just gain more entries.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/verification/scripts/visual-comparison.spec.ts` (full file, 494 lines) + RESEARCH.md §5 (lines 547-664) + RESEARCH.md §16 line 1489-1502 (Phase Requirements → Test Map).

---

#### `verification/playwright.config.ts`

- **Current state:** 43 lines — 3 viewports (desktop 1440x900, tablet 768x1024, mobile 375x812), `colorScheme: 'dark'`, `reducedMotion: 'reduce'` globally.
- **Target state:** Change desktop viewport from `1440x900` to `1280x900` (RESEARCH §5 line 605). Other viewports unchanged.
- **Diff strategy:** inline-edit (one width value change)
- **Code excerpt (current — lines 17-25):**
  ```typescript
  // verification/playwright.config.ts — CURRENT
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },   // ← CHANGE: 1440 → 1280
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },
    // tablet + mobile unchanged
  ],
  ```
- **Code excerpt (target — single-value change):**
  ```typescript
  // verification/playwright.config.ts — TARGET
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 900 },   // ← was 1440 — now matches Linear/Raycast reference snapshot width
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },
    // tablet + mobile unchanged (768/1024, 375/812)
  ],
  ```
- **Adapt:** Change `1440` → `1280` on the desktop project's viewport. NO other changes. Note that the `visual-comparison.spec.ts` report generator references "Viewport: 1440x900 (desktop)" in markdown output (line 339) — also update that string to match.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/verification/playwright.config.ts` (full file, 43 lines) + RESEARCH.md §5 line 596-605.

---

#### `package.json`

- **Current state:** Existing scripts include `dev`, `build`, `start`, `lint`, `extraction:*`, `e2e:*`, `test`, `analyze` (= `npx tsx scripts/analyze-dataset.ts`), `benchmark`. Existing deps: `@sentry/nextjs ^10.39.0`, `motion ^12.29.2`, `framer-motion ^12.29.3`, `next 16.1.5`, `react 19.2.3`. NO `lenis`, NO `@next/bundle-analyzer`.
- **Target state:** Add 2 deps (`lenis@1.3.23`, `-D @next/bundle-analyzer@16.2.6`). Rename existing `analyze` → `analyze:dataset`. Add 4 new scripts: `analyze`, `capture:refs`, `check:landing-scope`, `prebuild`.
- **Diff strategy:** inline-edit (JSON edits — 2 dep additions, 1 script rename, 4 new scripts)
- **Code excerpt (current — relevant scripts):**
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "extraction": "npx tsx extraction/scripts/capture-all-session.ts",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "analyze": "npx tsx scripts/analyze-dataset.ts",       // ← RENAME to analyze:dataset
    "benchmark": "npx tsx scripts/benchmark.ts"
  }
  ```
- **Code excerpt (target — script additions from RESEARCH §6 + §5 + §8):**
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "prebuild": "pnpm run check:landing-scope",                                  // ← NEW (RESEARCH §8 line 905-907)
    "start": "next start",
    "lint": "eslint",
    "extraction": "npx tsx extraction/scripts/capture-all-session.ts",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "analyze": "ANALYZE=true pnpm build",                                        // ← REPLACED (was analyze-dataset.ts)
    "analyze:dataset": "npx tsx scripts/analyze-dataset.ts",                     // ← RENAMED from old `analyze`
    "analyze:server": "BUNDLE_ANALYZE=server ANALYZE=true pnpm build",           // ← NEW
    "analyze:browser": "BUNDLE_ANALYZE=browser ANALYZE=true pnpm build",         // ← NEW
    "capture:refs": "playwright test verification/scripts/capture-references.spec.ts --config=verification/playwright.config.ts --project=desktop",  // ← NEW (RESEARCH §5 line 661)
    "check:landing-scope": "tsx scripts/check-landing-scope.ts",                 // ← NEW (RESEARCH §8 line 905)
    "benchmark": "npx tsx scripts/benchmark.ts"
  }
  ```
- **Adapt:**
  1. `pnpm add lenis@1.3.23` (RESEARCH §Stack Confirmation line 141).
  2. `pnpm add -D @next/bundle-analyzer@16.2.6` (RESEARCH §Stack Confirmation line 142).
  3. Rename `"analyze"` → `"analyze:dataset"` (RESEARCH §6 line 759 — verify no other code references `pnpm run analyze` first; RESEARCH says only `eslint.config.mjs` references the `scripts/` directory, low collision risk).
  4. Add new `analyze` (bundle-analyzer), `analyze:server`, `analyze:browser`, `capture:refs`, `check:landing-scope`, `prebuild` scripts.
- **Read first:** `/Users/davideloreti/virtuna-landing-linear-clone/package.json` (full file) + RESEARCH.md §6 (lines 751-760, scripts) + §5 (line 659-661, capture:refs) + §8 (lines 901-907, check:landing-scope + prebuild) + §15 line 1429-1463 (install steps).

---

### DELETED Files

| File / Directory | Why | Consumer Check | Safe? |
|------------------|-----|----------------|-------|
| `src/components/landing/backers-section.tsx` | FOUND-01 + D-22 | Only consumed by `(marketing)/page.tsx` (REPLACED in same commit) | YES |
| `src/components/landing/case-study-section.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/comparison-chart.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/cta-section.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/faq-section.tsx` | FOUND-01 + D-22 | Used by `(marketing)/page.tsx` AND `(marketing)/pricing/page.tsx` (BOTH replaced/deleted) | YES |
| `src/components/landing/feature-card.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/features-section.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/hero-section.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/index.ts` | FOUND-01 + D-22 (barrel — must go with siblings) | Re-exports above | YES |
| `src/components/landing/partnership-section.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/persona-card.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/social-proof-section.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/stats-section.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/components/landing/testimonial-quote.tsx` | FOUND-01 + D-22 | Only by `(marketing)/page.tsx` | YES |
| `src/app/(marketing)/pricing/` (entire directory) | D-23 — replaced by Phase 7 pricing SECTION + `/pricing → /#pricing` redirect | Only `(marketing)/pricing/page.tsx` was a consumer of `FAQSection`; both deleted | YES |

**Verification command** (per RESEARCH §15 lines 1417-1421):
```bash
grep -rE "from ['\"]@/components/landing" src/ --include="*.tsx" --include="*.ts"
# Expected output (both consumers deleted in same commit):
#   src/app/(marketing)/page.tsx:        } from "@/components/landing";
#   src/app/(marketing)/pricing/page.tsx: import { FAQSection } from "@/components/landing";
```

**Atomic single-commit strategy** (RESEARCH §15 lines 1429-1452):
```bash
git rm -r src/components/landing/
git rm -r 'src/app/(marketing)/pricing/'
git add src/app/\(marketing\)/page.tsx       # new empty scaffold
git add next.config.ts                       # redirect for /pricing → /#pricing
git commit -m "refactor(phase-1): delete legacy landing artifacts, scaffold v2 baseline"
```

**Post-deletion verification:**
```bash
pnpm install            # ensure deps resolve (lenis + bundle-analyzer in lockfile)
pnpm tsc --noEmit        # MUST pass with 0 errors
pnpm build               # MUST succeed
```

---

## Pattern Landmines

These look like good analogs but contain traps that would break Phase 1:

### Landmine 1: `src/components/motion/*.tsx` imports `motion` direct — DO NOT copy import path

**Files affected:** `fade-in.tsx`, `fade-in-up.tsx`, `slide-up.tsx`, `stagger-reveal.tsx`, `hover-scale.tsx`

**Why it's a trap:** They all do `import { motion, useReducedMotion } from "motion/react"` — perfect-looking shape for new landing components. But landing must use `import * as m from "motion/react-m"` because Phase 1 introduces `LazyMotion strict` wrapping (RESEARCH §3 line 426-428 — strict mode throws at runtime if `motion.*` is used).

**Rule:** Landing components copy the SHAPE (use client + reduced-motion guard + viewport entry animation), NOT the import. The `src/components/motion/*` files stay untouched (out of landing scope per RESEARCH §3 lines 446-454).

**Detection at gate:** Phase 1's CRAFT-RUBRIC.md rule 6 + LazyMotion strict throws at runtime — `pnpm build` fails (which is the linting mechanism per RESEARCH §3 line 456-458).

### Landmine 2: `src/app/(marketing)/layout.tsx` has duplicate `<html>/<body>` — DO NOT preserve

**Why it's a trap:** The current file looks structurally complete (Inter font, metadata, `<html>/<body>`). Naive extension might preserve all 28 lines and just add provider imports. That keeps the duplicate `<html>/<body>` bug intact — both layouts emit them, browsers de-duplicate silently in dev, prod hydration errors surface.

**Rule:** Phase 1 REWRITES this file (not extends). Delete Inter import, delete metadata, delete `<html>/<body>`. Wrap children in providers. (RESEARCH "Pitfall A" lines 1618-1624; RESEARCH §2 line 360.)

### Landmine 3: `sentry.client.config.ts` does NOT exist — CONTEXT.md typo

**Why it's a trap:** CONTEXT.md integration points say "Sentry config (`sentry.client.config.ts`) — extend with web vitals reporter scoped to landing route". An executor might create that file.

**Rule:** Sentry client config in Next.js 16 / @sentry/nextjs 10.x lives at `src/instrumentation-client.ts` (verified 2026-05-19, 9 lines). Do NOT create `sentry.client.config.ts`. The active landing-route reporter is `src/components/landing/web-vitals-reporter.tsx` (new file); `src/instrumentation-client.ts` is verify-only (RESEARCH §7 lines 769-777 — auto-capture happens; no manual edit needed in Phase 1).

### Landmine 4: `globals.css` mutation forbidden — landing.css is separate file

**Why it's a trap:** `globals.css` has a clean `@theme { ... }` block with all the existing coral + gray tokens. Adding `--landing-*` tokens there would seem natural and would work in dev. It would break the cascade isolation guarantee (D-17/D-18).

**Rule:** `landing.css` is a SEPARATE file at `src/app/(marketing)/landing.css`, imported only from `(marketing)/layout.tsx`. `globals.css` is NEVER mutated (FOUND-03 locked). The `scripts/check-landing-scope.ts` guard catches `landing.css` imports outside `(marketing)/`; no automated guard catches `globals.css` mutations, but D-18 makes it an explicit rule.

### Landmine 5: `tracesSampleRate: 0` in `src/instrumentation-client.ts` — web vitals invisible in Sentry prod

**Why it's a trap:** RESEARCH §7 line 770-772 says Sentry auto-captures web vitals via `browserTracingIntegration`. True — but only on transactions that are sampled. `tracesSampleRate: 0` (current value) means ZERO transactions sampled → ZERO web vitals in Sentry. The WebVitalsReporter dev-console-logs will work; prod Sentry visibility won't.

**Rule:** Phase 1 documents this in CRAFT-RUBRIC.md "Pitfall C" — out of scope to fix unless Davide flags. If web vitals not visible after Phase 1 deploys, fix is `tracesSampleRate: 1.0` (or a sampled value > 0) in `src/instrumentation-client.ts`. RESEARCH lines 1632-1640 document the exact location and fix.

### Landmine 6: Existing `analyze` script in `package.json` — name collision

**Why it's a trap:** RESEARCH §6 line 759 mentions `"existing analyze script already exists"` and recommends renaming. Existing: `"analyze": "npx tsx scripts/analyze-dataset.ts"`. Adding the bundle-analyzer's `"analyze": "ANALYZE=true pnpm build"` without renaming overwrites it silently. Other docs/CI may reference the old script (RESEARCH Assumption A7 — verified low risk but worth grep-checking).

**Rule:** Rename existing `analyze` to `analyze:dataset` FIRST, then add the bundle-analyzer `analyze`. Grep for `pnpm run analyze` and `npm run analyze` in the repo before renaming to confirm no consumers break.

---

## PATTERN MAPPING COMPLETE

**Phase:** 1 - Foundation + Cross-Cutting Gates
**Files classified:** 37 total (14 created + 7 modified + 16 deleted)
**Analogs found:** 9 with real codebase analogs / 14 created (others are pure greenfield with RESEARCH §N as the spec)

### Coverage
- Files with exact / structural codebase analog: 9
  - landing.css ← globals.css (@theme reference pattern)
  - lenis-provider.tsx ← usePrefersReducedMotion.ts + fade-in.tsx (reduced-motion + use client shape)
  - MotionWrapper.tsx ← motion/fade-in.tsx (leaf wrapper shape, NOT import path)
  - web-vitals-reporter.tsx ← instrumentation-client.ts (Sentry reporter shape)
  - check-landing-scope.ts ← verification/scripts/hardcoded-values-scan.ts (filesystem walker pattern)
  - capture-references.spec.ts ← verification/scripts/visual-comparison.spec.ts (Playwright spec shape)
  - SECTION-BRIEF-TEMPLATE.md ← CONTEXT.md (parseable markdown structure)
  - CRAFT-RUBRIC.md ← anti-slop-design-playbook.md (AS-01..AS-15 source)
  - All MODIFIED files ← their own current state
- Files with no analog (RESEARCH §N is the spec): 5
  - landing-motion-provider.tsx (RESEARCH §3 — no prior LazyMotion usage)
  - .planning/reference/design-md/{linear,raycast}.md (curl from external)
  - .claude/skills/taste-virtuna/SKILL.md (curl from external)
  - verification/reference/*.png (Playwright-generated)
  - verification/baselines/dashboard-*.png (Playwright-generated)

### Key Patterns Identified
- **All landing client components use `"use client"` + `m.*` from `motion/react-m`** — NOT `motion` from `motion/react`. Inverse pattern from existing `src/components/motion/*`.
- **All landing CSS lives in `landing.css` under `@layer landing`** — never mutates `globals.css` `@theme`. Hex-for-darks rule (L<0.15) applies (Tailwind v4 oklch landmine).
- **All landing-route layout integration in `src/app/(marketing)/layout.tsx`** — duplicate `<html>/<body>` MUST be deleted in this phase (Pitfall A). Providers wrap children: `LenisProvider → LandingMotionProvider → {Header + children + WebVitalsReporter}`.
- **All Playwright specs reference `data-section="<name>"`** — not positional selectors. Set in `(marketing)/page.tsx` placeholders; consumed by `visual-comparison.spec.ts` + future ui-checker.
- **Single-commit deletion** for legacy artifacts (14 files + pricing directory) — atomic safety guarantee per RESEARCH §15.

### File Created
`/Users/davideloreti/virtuna-landing-linear-clone/.planning/phases/01-foundation-cross-cutting-gates/01-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog files + RESEARCH.md sections + concrete copy-pasteable excerpts in each Phase 1 plan task. Six landmines explicitly flagged so executors don't fall into them.
