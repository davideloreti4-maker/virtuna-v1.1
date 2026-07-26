"use client";

/**
 * HeroProductWindow — the hero's "show" layer: the REAL platform surface at
 * full fidelity, framed as one large app window under the composer.
 *
 * Owner feedback trail (2026-07-27, handoff §3): three "show" concepts were
 * rejected — side-by-side panel ×2, static figure strip, wireframe-grade
 * mini-demo — and the shared diagnosis is that each was an ABSTRACTION of the
 * product. This is the correction: the window renders the shipped components
 * on the shipped fixtures — the thread with the real Test card
 * (`VideoTestCardRenderer`) and, beside it, the real drilled read rail
 * (`AmbientDetail`, `presentation="rail"`, the exact ≥xl /home mount) — so
 * what a visitor is shown IS what a signed-in user sees after a run.
 *
 * Successor to `ProductRender` (kept in-tree): same proven guided build-motion
 * — typing → thinking → reply → reading ring → the card assembles — extended
 * with one new beat: the read rail materialises AFTER the card lands (craft
 * first, then reception — the order the product itself produces them), then a
 * single BorderBeam pass marks completion. Plays ONCE on scroll into view.
 *
 * Honesty: fixture data, labeled — a "Sample read" tag lives in the window
 * chrome. The rail opens on the AUDIENCE tab: the card already shows craft;
 * the reception verdict is the surface the visitor can't guess from the card.
 *
 * The body is `inert`: the real card carries live buttons (Save / Simulate)
 * that must be neither tabbable nor readable as page UI — this is a shot of
 * the product, not the product's controls. An sr-only line in the parent
 * describes the scene instead.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { VideoTestCardRenderer } from "@/components/thread/video-test-card-block";
import { AmbientDetail } from "@/components/audience-lens/v2/AmbientDetail";
import { CREATOR_TEMPLATE } from "@/components/audience-lens/v2/detail-fixture";
import { NumberTicker } from "@/components/velora/number-ticker";
import { BorderBeam } from "@/components/velora/border-beam";
import { TEST_CARD_FIXTURE } from "./test-card-fixture";

const USER_MSG = "test this video for me";
const MAVEN_MSG = "On it — reading your video frame by frame.";
const CRAFT = TEST_CARD_FIXTURE.props.craftScore ?? 77;
const CIRC = 2 * Math.PI * 33; // ring radius 33 — matches the card's own ring geometry

type Phase =
  | "idle"
  | "typing"
  | "thinking"
  | "replying"
  | "reading"
  | "reveal"
  | "rail"
  | "done";
const AFTER_REPLY: Phase[] = ["replying", "reading", "reveal", "rail", "done"];
const WITH_CARD: Phase[] = ["reading", "reveal", "rail", "done"];
const WITH_RAIL: Phase[] = ["rail", "done"];

const REVEAL_EASE = [0.21, 0.47, 0.32, 0.98] as const;

function MavenAvatar() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-surface-elevated text-[12px] font-bold text-accent-text">
      M
    </span>
  );
}

export function HeroProductWindow({ skip = false }: { skip?: boolean }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  // -30%: the window peeks above the fold, and a -15% margin fired the one-shot
  // choreography while the visitor was still reading the headline — they'd
  // scroll down to an already-finished run. Waits for a real scroll instead.
  const inView = useInView(wrapRef, { once: true, margin: "0px 0px -30% 0px" });
  const reduced = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(0);
  const [mavenTyped, setMavenTyped] = useState(0);

  // Timer handles live in refs so the skip path (visitor focused the composer
  // mid-choreography) can cancel the run from outside the start effect.
  const timersRef = useRef<number[]>([]);
  const startedRef = useRef(false);

  const finish = () => {
    timersRef.current.forEach((t) => {
      window.clearTimeout(t);
      window.clearInterval(t);
    });
    timersRef.current = [];
    setTyped(USER_MSG.length);
    setMavenTyped(MAVEN_MSG.length);
    setPhase("done");
  };

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;

    // Reduced motion (or the visitor already started typing): no choreography —
    // land on the finished surface immediately.
    if (reduced || skip) {
      finish();
      return;
    }

    setPhase("typing");
    let ui = 0;
    const userTyper = window.setInterval(() => {
      ui += 1;
      setTyped(ui);
      if (ui >= USER_MSG.length) window.clearInterval(userTyper);
    }, 46);

    let mavenTyper = 0;
    timersRef.current = [
      userTyper,
      window.setTimeout(() => setPhase("thinking"), 1050),
      window.setTimeout(() => {
        setPhase("replying");
        let mi = 0;
        mavenTyper = window.setInterval(() => {
          mi += 1;
          setMavenTyped(mi);
          if (mi >= MAVEN_MSG.length) window.clearInterval(mavenTyper);
        }, 26);
        timersRef.current.push(mavenTyper);
      }, 1500),
      window.setTimeout(() => setPhase("reading"), 2650),
      window.setTimeout(() => setPhase("reveal"), 4200),
      window.setTimeout(() => setPhase("rail"), 5150),
      window.setTimeout(() => setPhase("done"), 5900),
    ];

    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced]);

  // The demo must never keep performing under a visitor who has started for
  // real — one-way jump to the finished shot.
  useEffect(() => {
    if (skip && startedRef.current && phase !== "done") finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  const cardOut = WITH_RAIL.includes(phase) || phase === "reveal";
  const showMaven = phase !== "idle" && phase !== "typing";
  const showReply = AFTER_REPLY.includes(phase);
  const showCard = WITH_CARD.includes(phase);
  const showRail = WITH_RAIL.includes(phase);

  return (
    <QueryClientProvider client={qc}>
      <p className="sr-only">
        A sample of the product: the Test card Maven returns for a video —
        craft {CRAFT}, with the working beats and the fixes — and beside it the
        simulated room&apos;s read: {CREATOR_TEMPLATE.verdict.value}{" "}
        {CREATOR_TEMPLATE.verdict.label}.
      </p>

      {/* Browser-window chrome (relative → hosts the BorderBeam) */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-[0_28px_70px_-30px_rgba(0,0,0,0.75)]">
        {/* top bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-[11px] text-foreground-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            maven.numenmachines.com
          </span>
          <span className="text-[11px] text-foreground-muted">Sample read</span>
        </div>

        {/* app body — the thread column + the drilled read rail, the real ≥xl layout.
            `inert`: a shot of the product; its controls must not be reachable. */}
        <div
          ref={wrapRef}
          inert
          className="flex h-[560px] bg-background lg:h-[640px]"
        >
          {/* thread pane */}
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
              {/* visitor turn — types in */}
              <div className="flex justify-end">
                <span className="max-w-[80%] rounded-2xl rounded-br-sm bg-surface-elevated px-3.5 py-2 text-[14px] text-foreground">
                  {typed >= USER_MSG.length ? (
                    USER_MSG
                  ) : (
                    <>
                      {USER_MSG.slice(0, typed)}
                      <span className="ml-px inline-block h-[1.05em] w-px translate-y-[0.15em] animate-pulse bg-foreground/70" />
                    </>
                  )}
                </span>
              </div>

              {/* Maven turn — avatar + label, then a streamed reply, then the card */}
              <AnimatePresence>
                {showMaven && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5"
                  >
                    <MavenAvatar />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex h-4 items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
                          Maven
                        </span>
                        {phase === "thinking" && (
                          <span className="flex gap-1">
                            {[0, 1, 2].map((d) => (
                              <motion.span
                                key={d}
                                className="h-1 w-1 rounded-full bg-foreground-muted"
                                animate={{ opacity: [0.25, 1, 0.25] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                              />
                            ))}
                          </span>
                        )}
                      </div>

                      {/* streamed reply bubble */}
                      {showReply && (
                        <motion.span
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-fit max-w-[92%] rounded-2xl rounded-tl-sm bg-surface-elevated px-3.5 py-2 text-[14px] leading-snug text-foreground-secondary"
                        >
                          {mavenTyped >= MAVEN_MSG.length ? (
                            MAVEN_MSG
                          ) : (
                            <>
                              {MAVEN_MSG.slice(0, mavenTyped)}
                              <span className="ml-px inline-block h-[1.05em] w-px translate-y-[0.15em] animate-pulse bg-foreground/60" />
                            </>
                          )}
                        </motion.span>
                      )}

                      {/* the REAL card — assembles top-down on reveal. */}
                      {showCard && (
                        <div className="relative mt-0.5">
                          <motion.div
                            className="select-none"
                            initial={false}
                            animate={
                              cardOut || reduced
                                ? { opacity: 1, filter: "blur(0px)", clipPath: "inset(0 0 0% 0 round 12px)" }
                                : { opacity: 0, filter: "blur(8px)", clipPath: "inset(0 0 100% 0 round 12px)" }
                            }
                            transition={{ duration: 0.9, ease: REVEAL_EASE }}
                          >
                            <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
                          </motion.div>

                          {/* Reading overlay — self-contained "Maven is reading" beat.
                              Owns its own ring geometry (never reads the card's layout). */}
                          <AnimatePresence>
                            {phase === "reading" && (
                              <motion.div
                                key="reading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
                                transition={{ duration: 0.4 }}
                                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.06] bg-surface-sunken"
                              >
                                <div className="relative h-[92px] w-[92px]">
                                  <svg width="92" height="92" viewBox="0 0 92 92" className="block -rotate-90">
                                    <circle cx="46" cy="46" r="33" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                                    <motion.circle
                                      cx="46"
                                      cy="46"
                                      r="33"
                                      fill="none"
                                      stroke="var(--color-positive)"
                                      strokeWidth="5"
                                      strokeLinecap="round"
                                      strokeDasharray={CIRC}
                                      initial={{ strokeDashoffset: CIRC }}
                                      animate={{ strokeDashoffset: CIRC * (1 - CRAFT / 100) }}
                                      transition={{ duration: 1.5, ease: REVEAL_EASE }}
                                    />
                                  </svg>
                                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-px">
                                    <NumberTicker
                                      value={CRAFT}
                                      delay={0.05}
                                      className="text-[30px] font-semibold leading-none text-foreground"
                                    />
                                    <span className="text-[8.5px] uppercase tracking-[0.05em] text-foreground-muted">
                                      Craft
                                    </span>
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[12px] text-foreground-muted">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                                  Reading your video, frame by frame
                                </div>
                                <motion.span
                                  aria-hidden
                                  className="pointer-events-none absolute inset-x-6 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent"
                                  initial={{ top: "14%", opacity: 0 }}
                                  animate={{ top: ["18%", "82%"], opacity: [0, 1, 0] }}
                                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* bottom fade — the thread continues below (the open loop) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
          </div>

          {/* read rail — the real drilled surface, the exact ≥xl mount. The pane
              (and its #181817 ground) is present from first paint so nothing
              shifts; the read itself materialises after the card lands. Hidden
              below lg — the sheet under the window carries the read there. */}
          <div className="relative hidden w-[400px] shrink-0 overflow-hidden bg-[#181817] lg:block">
            <motion.div
              className="h-full"
              initial={false}
              animate={
                showRail || reduced
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: 12 }
              }
              transition={{ duration: 0.7, ease: REVEAL_EASE }}
            >
              <AmbientDetail
                template={CREATOR_TEMPLATE}
                presentation="rail"
                initialTab="audience"
              />
            </motion.div>
          </div>
        </div>

        {/* coral border-beam — ignites once the surface is complete; liveness only */}
        {phase === "done" && !reduced && (
          <BorderBeam
            size={140}
            duration={7}
            colorFrom="transparent"
            colorTo="var(--color-accent)"
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
