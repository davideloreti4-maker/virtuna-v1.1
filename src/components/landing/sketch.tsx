/**
 * Sketches — faux-UI skeletons drawn inside placeholder frames.
 *
 * The empty Slot was honest but hollow: a dot grid with a glyph carries no
 * product presence, and a page whose biggest surfaces are voids cannot read as
 * premium. A sketch is the placeholder's second layer: hairline blocks laid
 * out like the real screen the asset will show — a rail, a header, a curve, a
 * grid of personas — at 4–8% white. From reading distance it reads as a
 * product behind glass; up close it is obviously scaffolding, which is the
 * honest register for "screenshot pending".
 *
 * Rules: hairlines and white-alpha fills ONLY. No text, no accent — a sketch
 * that says anything competes with the page; a sketch with coral in it spends
 * accent budget on ambience.
 */

/** A skeleton text line. */
function Line({ w, h = 6, o = 0.08 }: { w: string; h?: number; o?: number }) {
  return (
    <div
      className="rounded-full"
      style={{ width: w, height: h, background: `rgba(236,231,222,${o})` }}
    />
  );
}

/** The verdict screen: left rail, readout header, a retention curve, findings. */
export function VerdictSketch() {
  return (
    <div className="flex h-full w-full gap-3 p-4">
      {/* rail */}
      <div className="hidden w-[22%] flex-col gap-2.5 rounded-lg border border-[color:var(--lp-line)] p-3 sm:flex">
        <Line w="55%" o={0.12} />
        <div className="mt-2 flex flex-col gap-2">
          <Line w="80%" />
          <Line w="65%" />
          <Line w="72%" />
          <Line w="58%" />
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <Line w="70%" o={0.05} />
          <Line w="50%" o={0.05} />
        </div>
      </div>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <Line w="26%" o={0.12} />
          <div className="flex gap-2">
            <Line w="40px" o={0.06} />
            <Line w="40px" o={0.06} />
          </div>
        </div>

        {/* the curve region */}
        <div className="relative flex-1 rounded-lg border border-[color:var(--lp-line)]">
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 300 100"
            preserveAspectRatio="none"
          >
            <path
              d="M 0 18 C 60 22, 80 26, 95 34 C 112 44, 120 62, 140 70 C 175 82, 240 86, 300 88"
              fill="none"
              stroke="#ece7de"
              strokeOpacity="0.22"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div
            className="absolute bottom-0 left-[31%] top-[30%] w-px"
            style={{ background: "rgba(236,231,222,0.14)" }}
          />
        </div>

        {/* findings rows */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Line w="36px" o={0.12} />
            <Line w="52%" />
          </div>
          <div className="flex items-center gap-2.5">
            <Line w="36px" o={0.12} />
            <Line w="40%" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The composer: an input bar over a row of waiting drafts. The extra layer —
 *  three vertical thumbs with progress ticks — is what makes it read as "drop
 *  a draft in HERE" rather than an empty search box. */
export function ComposerSketch() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-6">
      <div className="flex h-11 w-[86%] items-center gap-3 rounded-lg border border-[color:var(--lp-line)] px-4"
        style={{ background: "rgba(236,231,222,0.03)" }}
      >
        <Line w="38%" o={0.1} />
        <div className="ml-auto h-6 w-6 rounded-md border border-[color:var(--lp-line)]"
          style={{ background: "rgba(236,231,222,0.08)" }}
        />
      </div>
      <div className="flex gap-2">
        <Line w="52px" o={0.05} h={18} />
        <Line w="64px" o={0.05} h={18} />
        <Line w="46px" o={0.05} h={18} />
      </div>
      {/* the queue: drafts already dropped in, one mid-upload */}
      <div className="flex w-[86%] items-center justify-center gap-3">
        {[0.05, 0.08, 0.04].map((o, i) => (
          <div
            key={i}
            className="flex h-14 w-10 flex-col justify-end rounded-md border border-[color:var(--lp-line)] p-1.5"
            style={{ background: `rgba(236,231,222,${o})` }}
          >
            <Line w={i === 1 ? "70%" : "100%"} h={3} o={i === 1 ? 0.18 : 0.07} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The room: a grid of persona dots — a few RINGED mid-reaction — over a live
 *  attention meter. The ring is the sketch grammar for "this one just
 *  reacted"; the meter is the second-by-second scoring, forming. */
export function RoomSketch() {
  // Deterministic variation — no Math.random in render.
  const dots = Array.from({ length: 24 }, (_, i) => (i * 7) % 5);
  const ringed = new Set([3, 9, 14, 20]);
  return (
    <div className="flex h-full w-full flex-col justify-center gap-5 p-6">
      <div className="grid grid-cols-8 gap-2.5">
        {dots.map((v, i) => (
          <div
            key={i}
            className="aspect-square rounded-full"
            style={{
              background: `rgba(236,231,222,${0.05 + v * 0.02})`,
              ...(ringed.has(i)
                ? { boxShadow: "0 0 0 1px rgba(236,231,222,0.22)" }
                : {}),
            }}
          />
        ))}
      </div>
      {/* the reading, forming second by second */}
      <div className="flex w-full flex-col gap-2">
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "rgba(236,231,222,0.06)" }}>
          <div className="h-full w-[58%] rounded-full" style={{ background: "rgba(236,231,222,0.28)" }} />
        </div>
        <div className="flex items-center justify-between">
          <Line w="26%" o={0.1} h={5} />
          <Line w="14%" o={0.06} h={5} />
        </div>
      </div>
    </div>
  );
}

/** A demo video at rest: the VERDICT SCREEN dimmed under player chrome,
 *  CROPPED IN — no app chrome, no nav rail. Two objects only: the creator's
 *  vertical video as a real media tile (poster mark, captions, its own
 *  scrub), and the read itself — a wide curve panel with the drop pinned,
 *  over a row of finding cards. The references never show whole app windows
 *  in a hero; they crop to the part that makes the argument. The centre
 *  stays clear for the play button. */
export function PlayerSketch() {
  return (
    <div className="flex h-full w-full flex-col gap-3 p-5">
      {/* the app, at rest under the player */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* the creator's vertical video — a media object, not a slab: handle
            line, poster mark, caption lines low like a short at rest, and its
            own scrub */}
        <div
          className="hidden w-[19%] flex-col rounded-lg border border-[color:var(--lp-line)] p-3 sm:flex"
          style={{ background: "rgba(236,231,222,0.04)" }}
        >
          <div className="flex items-center justify-between">
            <Line w="34%" h={4} o={0.1} />
            <Line w="14px" h={4} o={0.06} />
          </div>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="my-auto h-8 w-8 self-center"
            fill="none"
            stroke="rgba(236,231,222,0.14)"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M10.2 8.8 15.4 12l-5.2 3.2z" />
          </svg>
          <div className="flex flex-col gap-1.5">
            <Line w="82%" h={4} o={0.08} />
            <Line w="58%" h={4} o={0.06} />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <div className="relative h-[3px] w-full rounded-full" style={{ background: "rgba(236,231,222,0.09)" }}>
              <div className="h-full w-[38%] rounded-full" style={{ background: "rgba(236,231,222,0.3)" }} />
            </div>
            <div className="flex justify-between">
              <Line w="18px" h={3} o={0.07} />
              <Line w="18px" h={3} o={0.07} />
            </div>
          </div>
        </div>

        {/* main: the read — curve panel over finding cards. No header pills
            on the right: the hero's floating score tile lands exactly there,
            and hairlines under a float read as a collision. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-center">
            <Line w="18%" o={0.1} />
          </div>

          {/* the retention read, drawn in the product's own hand — a mini
              curve with the drop pinned. Cream alpha only: sketches carry no
              accent, and this is scaffolding for the demo video. */}
          <div className="relative min-h-0 flex-[1.4] rounded-lg border border-[color:var(--lp-line)]">
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 300 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 0 22 C 60 25, 90 28, 118 36 C 146 47, 158 66, 182 74 C 220 84, 262 87, 300 89"
                fill="none"
                stroke="#ece7de"
                strokeOpacity="0.22"
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div
              className="absolute bottom-0 left-[39%] top-[36%] w-px"
              style={{ background: "rgba(236,231,222,0.16)" }}
            />
            <span
              className="absolute left-[39%] top-[36%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "rgba(236,231,222,0.4)" }}
            />
            <div className="absolute inset-x-3 bottom-2 flex justify-between">
              <Line w="16px" h={3} o={0.08} />
              <Line w="16px" h={3} o={0.08} />
            </div>
          </div>

          {/* findings — three cards, the first one lit as "current". The
              middle meter keeps the cards from hollowing out at hero scale. */}
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-lg border border-[color:var(--lp-line)] p-2.5"
                style={{ background: `rgba(236,231,222,${i === 0 ? 0.04 : 0.02})` }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: "rgba(236,231,222,0.1)" }}
                  />
                  <Line w="42%" o={0.08} h={4} />
                </div>
                <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: "rgba(236,231,222,0.05)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${[64, 42, 78][i]}%`, background: "rgba(236,231,222,0.16)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Line w="80%" o={0.08} h={4} />
                  <Line w="55%" o={0.05} h={4} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* player chrome */}
      <div className="flex flex-col gap-2">
        {/* played to 62% — keeps the handle clear of the caption chip that the
            Slot pins at bottom-left */}
        <div className="relative h-1 w-full rounded-full bg-[rgba(236,231,222,0.08)]">
          <div className="h-full w-[62%] rounded-full bg-[rgba(236,231,222,0.35)]" />
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[rgba(236,231,222,0.6)]"
            style={{ left: "62%" }}
          />
        </div>
        <div className="flex justify-between">
          <Line w="26px" o={0.1} h={5} />
          <Line w="26px" o={0.1} h={5} />
        </div>
      </div>
    </div>
  );
}

/** The verdict summary: a score tile beside FINDING rows — each one a
 *  timestamp stub, a reason line, a fix chip — separated by hairlines. The
 *  structure mirrors the step's promise: the drop moment, the reason, the
 *  fix. */
export function ScoreSketch() {
  return (
    <div className="flex h-full w-full items-center gap-5 p-6">
      <div
        className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-[color:var(--lp-line)]"
        style={{ background: "rgba(236,231,222,0.05)" }}
      >
        <Line w="34px" h={12} o={0.16} />
        <Line w="24px" h={4} o={0.07} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {[
          { stamp: "26px", reason: "58%", chip: "30px" },
          { stamp: "26px", reason: "44%", chip: "22px" },
          { stamp: "26px", reason: "52%", chip: "26px" },
        ].map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 border-t border-[color:var(--lp-line)] py-2.5 first:border-t-0"
          >
            <Line w={row.stamp} o={0.14} h={5} />
            <Line w={row.reason} o={0.08} h={5} />
            <div className="ml-auto">
              <Line w={row.chip} o={0.05} h={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
