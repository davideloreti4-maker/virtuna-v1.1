"use client";

/**
 * ProductRender — the landing hero centerpiece: the REAL in-thread Test card,
 * rendered through the shipped `VideoTestCardRenderer`. Because it imports the
 * live component, a design change to the card updates the landing automatically
 * (the whole point of using the /dev/cards renderer here).
 *
 * Framed as a peek into the app: a mini thread that plays like a LIVE chat —
 * the visitor's message types in, Maven answers (avatar + a streamed reply),
 * then the card builds inside Maven's turn — all inside browser-window chrome.
 * Non-interactive (pointer-events off on the card) — the Save / Simulate
 * actions are the real card's, not the landing's CTAs. Providers: a throwaway
 * QueryClient (SaveAffordance mounts a react-query hook); nothing fires without
 * a click.
 *
 * ── The guided build-motion (the wow) ──────────────────────────────────────
 * When the hero scrolls into view it plays ONCE, ~5s:
 *   typing   → the visitor's bubble types "test this video for me"
 *   thinking → the Maven avatar + a thinking pulse resolve
 *   replying → Maven streams a one-line reply, like a real assistant
 *   reading  → a self-contained "reading" overlay: a craft ring DRAWS to 77 as
 *              a NumberTicker counts up (owns its own SVG — survives any card redesign)
 *   reveal   → the overlay lifts and the REAL card assembles top-down
 *   done     → a coral BorderBeam ignites on the window frame (liveness only)
 * All driven at THIS container level — the shipped card is never forked to
 * animate. `prefers-reduced-motion` jumps straight to the finished thread.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { VideoTestCardRenderer } from "@/components/thread/video-test-card-block";
import { NumberTicker } from "@/components/velora/number-ticker";
import { BorderBeam } from "@/components/velora/border-beam";
import { TEST_CARD_FIXTURE } from "./test-card-fixture";

const USER_MSG = "test this video for me";
const MAVEN_MSG = "On it — reading your video frame by frame.";
const CRAFT = TEST_CARD_FIXTURE.props.craftScore ?? 77;
const CIRC = 2 * Math.PI * 33; // ring radius 33 — matches the card's own ring geometry

type Phase = "idle" | "typing" | "thinking" | "replying" | "reading" | "reveal" | "done";
const AFTER_REPLY: Phase[] = ["replying", "reading", "reveal", "done"];
const WITH_CARD: Phase[] = ["reading", "reveal", "done"];

const REVEAL_EASE = [0.21, 0.47, 0.32, 0.98] as const;

function MavenAvatar() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-surface-elevated text-[12px] font-bold text-accent-text">
      M
    </span>
  );
}

export function ProductRender() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, margin: "0px 0px -15% 0px" });
  const reduced = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(0);
  const [mavenTyped, setMavenTyped] = useState(0);

  useEffect(() => {
    if (!inView) return;

    // Reduced motion: no choreography — land on the finished thread immediately.
    if (reduced) {
      setTyped(USER_MSG.length);
      setMavenTyped(MAVEN_MSG.length);
      setPhase("done");
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
    const timeouts = [
      window.setTimeout(() => setPhase("thinking"), 1050),
      window.setTimeout(() => {
        setPhase("replying");
        let mi = 0;
        mavenTyper = window.setInterval(() => {
          mi += 1;
          setMavenTyped(mi);
          if (mi >= MAVEN_MSG.length) window.clearInterval(mavenTyper);
        }, 26);
      }, 1500),
      window.setTimeout(() => setPhase("reading"), 2650),
      window.setTimeout(() => setPhase("reveal"), 4200),
      window.setTimeout(() => setPhase("done"), 5000),
    ];

    return () => {
      window.clearInterval(userTyper);
      if (mavenTyper) window.clearInterval(mavenTyper);
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, [inView, reduced]);

  const cardOut = phase === "reveal" || phase === "done";
  const showMaven = phase !== "idle" && phase !== "typing";
  const showReply = AFTER_REPLY.includes(phase);
  const showCard = WITH_CARD.includes(phase);

  return (
    <QueryClientProvider client={qc}>
      {/* Browser-window chrome (relative → hosts the BorderBeam) */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl">
        {/* top bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-[11px] text-foreground-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            maven.numenmachines.com
          </span>
        </div>

        {/* mini thread body — a live chat, capped with a soft fade */}
        <div ref={wrapRef} className="relative max-h-[600px] overflow-hidden bg-background">
          <div className="flex flex-col gap-4 px-4 py-5">
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

                    {/* the REAL card — showcase, non-interactive. Assembles top-down on reveal. */}
                    {showCard && (
                      <div className="relative mt-0.5">
                        <motion.div
                          className="pointer-events-none select-none"
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

          {/* bottom fade — the window continues below (the open loop) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* coral border-beam — ignites once the card has landed; liveness only */}
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
