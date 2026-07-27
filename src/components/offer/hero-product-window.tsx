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
 * Successor to `ProductRender` (kept in-tree): the guided build-motion, restaged 2026-07-27
 * to begin where the product begins — the visitor's line types INTO the docked composer,
 * sends, and the turn rises into the thread; then thinking → reply → reading ring → the card
 * assembles → the read rail materialises (craft first, then reception — the order the product
 * itself produces them) → a single BorderBeam pass marks completion.
 *
 * Plays ONCE, ARMED ON INTERSECTION. It used to start on mount, reaching `done` at 5900ms
 * while the window sat below a headline and a live composer — so in practice it performed to
 * an empty viewport and every real visitor met a finished, static shot and reported the page
 * as having no demo. Now that the fold sells the outcome and the window is the page's second
 * surface, on-mount would be strictly worse. It starts when it is actually on screen.
 *
 * Honesty: fixture data, labeled — a "Sample read" tag lives in the window
 * chrome. The rail opens on the AUDIENCE tab: the card already shows craft;
 * the reception verdict is the surface the visitor can't guess from the card.
 *
 * The body is `inert` and STAYS inert (owner call 2026-07-27: "make the demo not interactive,
 * and the composer not real — a probe to give the user a feeling of the platform"). The real
 * card carries live buttons (Save / Simulate) and the docked composer carries a real submit;
 * none of them may be tabbable or readable as page UI. This is a shot of the product, not the
 * product's controls. An sr-only line in the parent describes the scene instead.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { EmbeddedComposer } from "@/components/app/home/embedded-composer";
import { VideoTestCardRenderer } from "@/components/thread/video-test-card-block";
import { ThreadAssistantTurn, ThreadUserTurn } from "@/components/thread/thread-shell";
import { AmbientDetail } from "@/components/audience-lens/v2/AmbientDetail";
import { NumberTicker } from "@/components/velora/number-ticker";
import { BorderBeam } from "@/components/velora/border-beam";
import { TEST_CARD_FIXTURE } from "./test-card-fixture";
import { FEATURED_ROOM_TEMPLATE } from "./featured-room-template";

/** The room's read of the SAME clip the card reads — see `featured-room-template.ts` for why
 *  the shared v2 fixture is retargeted rather than mutated. */
const WINDOW_TEMPLATE = FEATURED_ROOM_TEMPLATE;

const USER_MSG = "test this video for me";
const MAVEN_MSG = "On it — reading your video frame by frame.";
const CRAFT = TEST_CARD_FIXTURE.props.craftScore ?? 77;
const CIRC = 2 * Math.PI * 33; // ring radius 33 — matches the card's own ring geometry

type Phase =
  | "idle"
  | "typing"
  | "sending"
  | "thinking"
  | "replying"
  | "reading"
  | "reveal"
  | "rail"
  | "done";
/** The visitor's turn is in the THREAD from `thinking` on — before that it is still in the
 *  composer being typed, which is the whole point of the restaged opening. */
const AFTER_SEND: Phase[] = ["thinking", "replying", "reading", "reveal", "rail", "done"];
const AFTER_REPLY: Phase[] = ["replying", "reading", "reveal", "rail", "done"];
const WITH_CARD: Phase[] = ["reading", "reveal", "rail", "done"];
const WITH_RAIL: Phase[] = ["rail", "done"];

const REVEAL_EASE = [0.21, 0.47, 0.32, 0.98] as const;

export function HeroProductWindow() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  );

  const reduced = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(0);
  const [mavenTyped, setMavenTyped] = useState(0);

  /**
   * Which of the read's two pages the rail is showing. The probe is non-interactive, so the
   * only way to tell a visitor the room has TWO pages — the brain and the audience — is to
   * visit them. After the read lands it holds on the audience, crosses to the brain, and
   * returns; the tab header moves with it, which is what reads as "these are clickable".
   * Remounting via `key` rather than adding a controlled prop keeps `AmbientDetail` — shared
   * with /ambient-v2, pricing-template and shot-stages — untouched.
   */
  const [railTab, setRailTab] = useState<"audience" | "brain">("audience");

  const timersRef = useRef<number[]>([]);
  const startedRef = useRef(false);

  /**
   * ARMED ON INTERSECTION, not on mount. Until 2026-07-27 the run began the moment the page
   * did and reached `done` at 5900ms, while the window sat below a headline and a composer —
   * so on any real visit the choreography played to an empty viewport and the visitor met a
   * finished, static shot. It is now the page's second surface, further down, which would make
   * that worse. Firing when the window is actually on screen is the whole point of a demo.
   */
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "0px 0px -25% 0px" });

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
    // Reduced motion: land on the finished surface immediately, without waiting to be seen.
    // One-shot by `startedRef`, and it cannot be a lazy initial state — `useReducedMotion`
    // resolves after first render. Same exemption `use-test-run-stages.ts` takes.
    if (reduced) {
      if (startedRef.current) return;
      startedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      finish();
      return;
    }
    if (!inView || startedRef.current) return;
    startedRef.current = true;

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
      // The send beat: the field goes busy, then the turn leaves the composer for the thread.
      window.setTimeout(() => setPhase("sending"), 1150),
      window.setTimeout(() => setPhase("thinking"), 1450),
      window.setTimeout(() => {
        setPhase("replying");
        let mi = 0;
        mavenTyper = window.setInterval(() => {
          mi += 1;
          setMavenTyped(mi);
          if (mi >= MAVEN_MSG.length) window.clearInterval(mavenTyper);
        }, 26);
        timersRef.current.push(mavenTyper);
      }, 1900),
      window.setTimeout(() => setPhase("reading"), 3050),
      window.setTimeout(() => setPhase("reveal"), 4600),
      window.setTimeout(() => setPhase("rail"), 5550),
      window.setTimeout(() => setPhase("done"), 6300),
      // Visit the other page, then come back. Rests on the audience for the same reason the
      // rail opens there: craft is already on the card, the reception verdict is the surface
      // a visitor cannot guess from it.
      window.setTimeout(() => setRailTab("brain"), 10_000),
      window.setTimeout(() => setRailTab("audience"), 15_500),
    ];

    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
    };
  }, [reduced, inView]);

  const cardOut = WITH_RAIL.includes(phase) || phase === "reveal";
  const sent = AFTER_SEND.includes(phase);
  const showMaven = sent;
  const showReply = AFTER_REPLY.includes(phase);
  const showCard = WITH_CARD.includes(phase);
  const showRail = WITH_RAIL.includes(phase);

  // What the composer in the shot is holding. It types the visitor's line, then empties on
  // send exactly as the real one does. The nonce re-seeds on every character, which is how
  // `EmbeddedComposer` accepts pushed text — so this is the real field, really filling.
  const composerText = sent ? "" : USER_MSG.slice(0, typed);

  return (
    <QueryClientProvider client={qc}>
      <p className="sr-only">
        A sample of the product: the Test card Maven returns for a video —
        craft {CRAFT}, with the working beats and the fixes — and beside it the
        simulated room&apos;s read: {WINDOW_TEMPLATE.verdict.value}{" "}
        {WINDOW_TEMPLATE.verdict.label}.
      </p>

      <div ref={rootRef} className="relative">
        {/* Composed light — a warm bloom ANCHORED to the shot (the page's other
            blooms are loose atmosphere; a premium app-shot sits in its own
            light). Matte-safe: a blurred radial behind the frame, no glass, no
            element glow — same family as the hero atmosphere layers. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-24 -top-28 h-[460px] opacity-[0.16] blur-[110px]"
          style={{
            background:
              "radial-gradient(55% 60% at 50% 30%, #FF6363, rgba(255,178,122,0.4) 55%, transparent 75%)",
          }}
        />

        {/* Browser-window chrome (relative → hosts the BorderBeam). The inset
            top hairline catches the bloom like an edge-lit frame. */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_44px_96px_-32px_rgba(0,0,0,0.85)]">
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
        {/* Taller than it was: the docked composer takes ~120px off the thread pane, and at the
            old 640 the card was cut through the middle of its filmstrip labels — a clip that
            read as broken rather than as "the thread continues below". */}
        {/* Mobile height is capped so the WHOLE surface fits a phone viewport with its chrome:
            at 680 the window outgrew the screen and a visitor mid-sequence was looking at an
            empty band of thread with a composer under it. Desktop is taller because the docked
            composer takes ~120px off the pane, and at 640 the card was cut through its own
            filmstrip labels — a clip that read as broken rather than as "continues below". */}
        <div inert className="relative flex h-[600px] bg-background lg:h-[720px]">
          {/* thread pane — a column, because the real thread docks its composer at the foot */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* The real thread's own column rhythm — max-w-760, gap-5, px-4 py-6 (ThreadShell). */}
            <div className="relative mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 overflow-hidden px-4 py-6">
              {/* visitor turn — the REAL `ThreadUserTurn`, rising out of the composer once sent */}
              <AnimatePresence>
                {sent && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.42, ease: REVEAL_EASE }}
                  >
                    <ThreadUserTurn text={USER_MSG} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Maven turn — the REAL `ThreadAssistantTurn`: a quiet label and the content, with
                  NO avatar and NO bubble. The window carried an invented coral "M" disc and wrapped
                  the reply in a chat bubble; the platform has neither, and the owner reads the
                  difference instantly. Using the shipped components means it cannot drift again. */}
              <AnimatePresence>
                {showMaven && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <ThreadAssistantTurn>
                      {phase === "thinking" && (
                        <span className="flex h-4 items-center gap-1">
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

                      {/* streamed reply — plain text at the thread's own size, not a bubble */}
                      {showReply && (
                        <motion.p
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[15px] leading-relaxed text-foreground-secondary"
                        >
                          {mavenTyped >= MAVEN_MSG.length ? (
                            MAVEN_MSG
                          ) : (
                            <>
                              {MAVEN_MSG.slice(0, mavenTyped)}
                              <span className="ml-px inline-block h-[1.05em] w-px translate-y-[0.15em] animate-pulse bg-foreground/60" />
                            </>
                          )}
                        </motion.p>
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
                                /* Pinned to the TOP of the card area, not centred in it. The
                                   card is ~1400px tall at phone width, so `inset-0` +
                                   `justify-center` put the ring far below the fold of the
                                   window: mobile showed ~500px of empty box for the whole
                                   reading beat. Capped height keeps the ring where the card
                                   actually is on screen, on both breakpoints. */
                                className="absolute inset-x-0 top-0 z-10 flex h-[340px] max-h-full flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.06] bg-surface-sunken lg:h-[460px]"
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
                    </ThreadAssistantTurn>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* bottom fade — the thread continues below (the open loop) */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
            </div>

            {/* The composer, docked — the real `EmbeddedComposer`, because a thread without one
                is not the platform, and the window's whole claim is that it IS the platform.
                It is part of the SHOT: the `inert` body makes it unfocusable and unsubmittable
                (which also neutralises the component's own focus-on-seed effect), so `onLaunch`
                and `onVerbChange` can never fire. The choreography drives its text through the
                same `seed` channel a tapped card uses in the real app. */}
            <div className="mx-auto w-full max-w-[760px] shrink-0 px-4 pb-4">
              {/* Shorter than the /home default: the composer's 72px min-height field plus p-4
                  ate ~120px of a pane that has a tall card to show. Trimmed through the
                  descendant variant rather than a `compact` prop, so the shared component stays
                  untouched and the surface keeps the real one's shape. */}
              <EmbeddedComposer
                verb="Test"
                onVerbChange={() => {}}
                onLaunch={() => {}}
                seed={{ text: composerText, nonce: sent ? -1 : typed }}
                busy={phase === "sending"}
                className="gap-2.5 p-3 [&_textarea]:min-h-[40px]"
              />
            </div>
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
                key={railTab}
                template={WINDOW_TEMPLATE}
                presentation="rail"
                initialTab={railTab}
              />
            </motion.div>
          </div>

          {/* MOBILE read — the drill the real app performs on a phone.
              Below lg the rail pane is hidden, which used to mean a phone visitor saw the
              thread and NONE of the read: the wrong half of the product, on the surface most
              of the traffic arrives from. Squeezing the two-pane desktop layout would be the
              wrong fix — on a phone the product itself drills into the read as a SHEET, so
              playing that drill is *more* 1:1 than a shrunken rail, and because the probe is
              non-interactive we can run it on a timer.

              The container is explicitly bounded (`top-…`/`bottom-0`) and a flex column:
              `presentation="sheet"` renders `flex-1` and inherits its ground from the host, and
              an unbounded-height AmbientDetail wrapper is the known trap that once rendered
              2,182px instead of 800. */}
          <AnimatePresence>
            {showRail && (
              <motion.div
                key="mobile-read"
                // Near-full, like the real drill. A part-height sheet was tried so the card
                // stayed visible above it, and measured worse: at any phone-sized height the
                // audience read clips at its own heading, so the payoff sentence — the single
                // most valuable line in the pane — is what gets cut. The card is seen during
                // the sequence; the read is the RESTING state for the same reason the desktop
                // rail opens on the audience tab: craft is already on the card, the reception
                // verdict is the surface a visitor cannot guess from it.
                className="absolute inset-x-0 bottom-0 top-16 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-border bg-[#181817] shadow-[0_-24px_48px_-24px_rgba(0,0,0,0.9)] lg:hidden"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.62, ease: REVEAL_EASE }}
              >
                <AmbientDetail
                  key={railTab}
                  template={WINDOW_TEMPLATE}
                  presentation="sheet"
                  initialTab={railTab}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
      </div>
    </QueryClientProvider>
  );
}
