"use client";

/**
 * The offer page's below-hero motion vocabulary.
 *
 * The hero has a real choreography (typing → thinking → reading → reveal). Below
 * it, every section used to share ONE primitive (`BlurFade`, same 16px rise, same
 * stagger) — so the page's motion died at the fold and the whole arc read as one
 * flat scroll. These primitives give each beat its own gesture while keeping a
 * single easing + timing language, so it reads as one page rather than a demo reel.
 *
 *   Reveal   — the base enter. Four gestures: `rise` (the default),
 *              `wipe` (a clip-path unmask, for media), `settle` (scale-down
 *              into place, for cards), `lift` (a longer, heavier rise for
 *              headings). One shared spring-ish ease; never bouncy.
 *   Stagger  — a parent that walks its children in on a shared cadence, so
 *              lists/grids arrive as a sequence instead of all at once.
 *   Parallax — scroll-linked vertical drift for a framed asset, so media has
 *              depth against the copy beside it.
 *   CountUp   — a number that animates only when it's actually seen.
 *
 * Reduced motion is honored everywhere: the reveal still HAPPENS (content must
 * never stay hidden), it just resolves instantly, and Parallax flattens to 0.
 * `initial` is kept identical on server and client — branching it on a media
 * query mismatches on hydration.
 */

import { useRef, useSyncExternalStore } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type TargetAndTransition,
  type Transition,
} from "motion/react";
import { NumberTicker } from "@/components/velora/number-ticker";
import { cn } from "@/lib/utils";

/** One easing for the whole page — a firm decelerate, no overshoot. */
export const OFFER_EASE = [0.22, 0.61, 0.24, 1] as const;

/** A store that never emits — see `CountUp`. Module-level so it stays stable. */
const NO_SUBSCRIBE = () => () => {};

type Gesture = "rise" | "wipe" | "settle" | "lift";

const HIDDEN: Record<Gesture, TargetAndTransition> = {
  rise: { opacity: 0, y: 18, filter: "blur(5px)" },
  wipe: {
    opacity: 0,
    y: 22,
    filter: "blur(6px)",
    clipPath: "inset(14% 0% 0% 0% round 16px)",
  },
  settle: { opacity: 0, y: 10, scale: 0.985 },
  lift: { opacity: 0, y: 30, filter: "blur(7px)" },
};

const SHOWN: Record<Gesture, TargetAndTransition> = {
  rise: { opacity: 1, y: 0, filter: "blur(0px)" },
  wipe: { opacity: 1, y: 0, filter: "blur(0px)", clipPath: "inset(0% 0% 0% 0% round 16px)" },
  settle: { opacity: 1, y: 0, scale: 1 },
  lift: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const DURATION: Record<Gesture, number> = {
  rise: 0.6,
  wipe: 0.95,
  settle: 0.55,
  lift: 0.8,
};

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  gesture?: Gesture;
  /** Seconds of head start — use sparingly; prefer <Stagger> for sequences. */
  delay?: number;
  /** Override the gesture's natural duration. */
  duration?: number;
  /** Render as a flex child without introducing a block wrapper. */
  asFlex?: boolean;
}

export function Reveal({
  children,
  className,
  gesture = "rise",
  delay = 0,
  duration,
  asFlex = false,
}: RevealProps) {
  const reduced = useReducedMotion();
  const transition: Transition = reduced
    ? { duration: 0 }
    : { delay, duration: duration ?? DURATION[gesture], ease: OFFER_EASE };

  return (
    <motion.div
      data-slot="offer-reveal"
      className={cn(asFlex && "flex", className)}
      initial={HIDDEN[gesture]}
      whileInView={SHOWN[gesture]}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds between children. */
  step?: number;
  /** Seconds before the first child. */
  delay?: number;
  gesture?: Gesture;
  as?: "div" | "ul" | "dl";
}

/**
 * Stagger — walks its children in on one cadence. Children must be wrapped in
 * `<StaggerItem>`; anything else renders unanimated (useful for dividers).
 */
export function Stagger({
  children,
  className,
  step = 0.08,
  delay = 0.04,
  as = "div",
}: StaggerProps) {
  const reduced = useReducedMotion();
  const Comp = motion[as];

  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      variants={{
        hidden: {},
        shown: {
          transition: reduced
            ? { staggerChildren: 0, delayChildren: 0 }
            : { staggerChildren: step, delayChildren: delay },
        },
      }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  gesture = "rise",
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  gesture?: Gesture;
  as?: "div" | "li";
}) {
  const reduced = useReducedMotion();
  const Comp = motion[as];

  return (
    <Comp
      className={className}
      variants={{
        hidden: HIDDEN[gesture],
        shown: {
          ...SHOWN[gesture],
          transition: reduced ? { duration: 0 } : { duration: DURATION[gesture], ease: OFFER_EASE },
        },
      }}
    >
      {children}
    </Comp>
  );
}

/**
 * Parallax — scroll-linked vertical drift, spring-smoothed so it never feels
 * mechanical. `distance` is the total travel across the element's whole pass
 * through the viewport; keep it small (16–40px) — this is depth, not a gimmick.
 * Flattens to zero under reduced motion.
 */
export function Parallax({
  children,
  className,
  distance = 28,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y: reduced ? 0 : y }}>{children}</motion.div>
    </div>
  );
}

/**
 * CountUp — a number that reads correctly BEFORE it animates.
 *
 * `NumberTicker` already waits for the viewport, but it renders `startValue` (0)
 * into the server markup, so "a verdict in ~90s" ships as "~0s" until JS runs and
 * the element is scrolled to. On a paid-traffic page that's a claim rendered
 * wrong. This renders the real number server-side, then hands over to the ticker
 * after mount — animated for everyone who can see it, correct for everyone else
 * (no-JS, slow JS, crawlers, reduced motion).
 */
export function CountUp({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  // The canonical "am I hydrated" read: a store that never changes, whose server
  // snapshot is false and client snapshot is true. A useState+useEffect mount
  // flag does the same job but trips react-hooks/set-state-in-effect.
  const hydrated = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return (
      <span className={cn("inline-block tabular-nums", className)}>
        {value.toLocaleString("en-US")}
      </span>
    );
  }
  return <NumberTicker value={value} className={className} />;
}
