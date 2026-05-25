"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/app/(marketing)/motionTokens";
import { WordRotate } from "@/components/ui/word-rotate";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { CredibilityHook } from "@/app/(marketing)/_components/CredibilityHook";

export interface HeroBookendProps {
  /** Plan 03 sets `true` on the Final CTA instance to use min-h-[60vh] vs 100dvh (D-08 height difference) */
  reducedHeight?: boolean;
  /**
   * Controls which element renders the visual H1.
   *  - "h1" (default): renders <h1> — used by HeroSection.
   *  - "p":            renders <p role="heading" aria-level={2}> with IDENTICAL visual styling and
   *                    WordRotate behavior — used by FinalCtaSection to satisfy the single-H1
   *                    accessibility-tree contract (UI-SPEC § Accessibility Contract).
   *
   * The element switches; nothing else changes. Same className, same style, same aria-label,
   * same children (badge + WordRotate span + trailing copy). Coral, sub-headline, CTA pair,
   * and Spotlight are untouched.
   */
  headingAs?: "h1" | "p";
  /**
   * Gates the above-fold CredibilityHook (HERO-10) render.
   *  - true (default): used by HeroSection — credibility bar appears after CTA pair.
   *  - false:          used by FinalCtaSection — Final CTA must NOT duplicate the
   *                    credibility bar that already shipped in the Hero (03-VERIFICATION
   *                    Gap 2 regression fix). UI-SPEC § Component Anatomy explicitly
   *                    notes the hook lives in the Hero only.
   */
  showCredibilityHook?: boolean;
  className?: string;
}

/**
 * HeroBookend — shared inner layout used verbatim by both HeroSection and FinalCtaSection (D-08).
 *
 * Contains: Spotlight + AnimatedShinyText badge + H1 with fused WordRotate + sub-headline +
 * CredibilityHook (HERO-10) + dual CTA pair (ShimmerButton + ghost link).
 *
 * Motion gating (MOTION-01, MOTION-02, MOTION-03):
 * - useReducedMotion() gates: WordRotate → static "creators", BorderBeam → null,
 *   AnimatedShinyText → static text, Spotlight animation → suppressed via CSS.
 * - IntersectionObserver gates WordRotate cycling (pauses when section leaves viewport).
 *
 * WordRotate pause/resume API recon (Task 1 per plan output spec):
 * - Checked: controlled `index`/`activeIndex` prop → NOT present
 * - Checked: `paused`/`isPaused` prop → NOT present
 * - Checked: ref handle with `pause()`/`resume()` methods → NOT present
 * - Checked: `keepIndex` or similar resume-on-mount API → NOT present
 * - Result: NONE of the above exist in the installed primitive (word-rotate.tsx v1 — only
 *   `words`, `duration`, `motionProps`, `className` props). "Resume from current word"
 *   UI-SPEC clause is DEGRADED to "re-mount on re-enter" (remount-on-reenter fallback).
 *   TODO: Upgrade when Magic UI WordRotate adds a controlled index or paused prop.
 *
 * WordRotate renders `motion.span` internally — no nested heading elements.
 */
export function HeroBookend({
  reducedHeight = false,
  headingAs = "h1",
  showCredibilityHook = true,
  className,
}: HeroBookendProps) {
  const prefersReduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setInView(e.isIntersecting);
      },
      { threshold: motionTokens.viewportThresholds.hero, rootMargin: "0px" }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const HeadingTag = headingAs === "p" ? "p" : "h1";
  const headingProps =
    headingAs === "p"
      ? { role: "heading" as const, "aria-level": 2 }
      : {};

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full flex items-center justify-center px-6",
        reducedHeight ? "min-h-[60vh] py-16" : "min-h-[100dvh] py-12",
        className
      )}
    >
      {/* Ambient coral glow — centered radial gradient from top edge (HERO-04) */}
      {!prefersReduced && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 75% 50% at 50% -5%, rgba(255,127,80,0.22) 0%, transparent 65%)",
          }}
        />
      )}

      {/* Inner content stack: badge → H1 (HeadingTag) → sub → gap → CTA pair */}
      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center text-center gap-4">

        {/* AnimatedShinyText badge — "✦ Behavioral prediction engine" (D-01: behavioral framing, not model-type framing) */}
        <div
          className="inline-flex items-center rounded-full border border-white/[0.08] px-4 py-2"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          {prefersReduced ? (
            <span
              className="text-sm font-normal text-foreground-secondary"
              style={{ letterSpacing: "0.08em" }}
            >
              ✦ Behavioral prediction engine
            </span>
          ) : (
            <AnimatedShinyText
              className="text-sm font-normal text-foreground-secondary"
              style={{ letterSpacing: "0.08em" }}
            >
              ✦ Behavioral prediction engine
            </AnimatedShinyText>
          )}
        </div>

        {/* Visual H1 with fused WordRotate — parameterized by headingAs prop */}
        {/* headingAs="h1" → renders <h1>; headingAs="p" → renders <p role="heading" aria-level={2}> */}
        {/* aria-label provides full static sentence for screen readers (HERO-11) */}
        {/* WordRotate <span> has aria-live="off" so word changes are not announced */}
        <HeadingTag
          {...headingProps}
          className="font-bold leading-[1.05] tracking-[-0.04em] text-center"
          style={{ fontSize: "clamp(40px, 5.5vw, 64px)" }}
          aria-label="Predict viral for creators, brands, and founders — before you post."
        >
          Predict viral for{" "}
          <span
            className="text-[#FF7F50]"
            aria-live="off"
            aria-atomic="true"
          >
            {inView && !prefersReduced ? (
              <WordRotate
                words={["creators", "brands", "founders"]}
                duration={2500}
                motionProps={{
                  initial: { opacity: 0, y: -50 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: 50 },
                  transition: {
                    duration: 0.4,
                    ease: motionTokens.easings.outQuart,
                  },
                }}
              />
            ) : (
              <span>creators</span>
            )}
          </span>{" "}
          before you post.
        </HeadingTag>

        {/* Sub-headline — gap-4 (16px) from H1 via parent gap-4 */}
        <p
          className="text-base md:text-xl text-foreground-secondary leading-[1.5] max-w-2xl mx-auto mt-2"
          style={{ letterSpacing: "0.2px" }}
        >
          Stop guessing what&apos;ll hit. Score, refine, ship — in 30 seconds.
        </p>

        {/* Dual CTA pair (HERO-03, HERO-06, HERO-07, MOTION-01) */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 w-full sm:w-auto">

          {/* Primary CTA — ShimmerButton with onClick scroll (no <a> wrapper — avoids button-in-anchor invalid nesting) */}
          {/* coral single-stop alpha border + shimmer (MOTION-03) */}
          <ShimmerButton
            onClick={() => {
              document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="relative w-full sm:w-auto h-14 px-6 text-base font-bold overflow-hidden"
            style={{
              border: "1px solid rgba(255, 127, 80, 0.25)",
              color: "#f9f9f9",
              borderRadius: "8px",
            }}
            shimmerColor="rgba(255, 127, 80, 0.25)"
            background="rgba(255, 127, 80, 0.08)"
            borderRadius="8px"
          >
            <span className="relative z-10">Score your first TikTok</span>
          </ShimmerButton>

          {/* Secondary CTA — ghost link */}
          <a
            href="#pricing"
            className="group flex items-center justify-center min-h-[44px] text-sm text-foreground-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:rounded-[4px] w-full sm:w-auto"
            style={{
              outlineColor: "#FF7F50",
              transition: "color 150ms ease-out",
            }}
          >
            See pricing
            <ChevronRight
              className="ml-1 w-4 h-4 transition-transform motion-reduce:transform-none group-hover:translate-x-[2px]"
            />
          </a>
        </div>

        {/* HERO-10: Above-fold credibility hook — renders AFTER CTA pair per HERO-11 / UI-SPEC § Screen Reader Order. */}
        {/* Gated on showCredibilityHook (default true) so FinalCtaSection can suppress to avoid duplication. */}
        {showCredibilityHook && <CredibilityHook />}
      </div>
    </div>
  );
}
