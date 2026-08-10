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

/** A demo video at rest: the APP, dimmed under player chrome — rail, panels,
 *  a vertical video tile — with a scrub bar over the bottom. Dense enough to
 *  carry a hero-scale frame; the centre stays clear for the play button. */
export function PlayerSketch() {
  return (
    <div className="flex h-full w-full flex-col gap-3 p-5">
      {/* the app, at rest under the player */}
      <div className="flex min-h-0 flex-1 gap-3">
        {/* rail */}
        <div className="hidden w-[16%] flex-col gap-2 rounded-lg border border-[color:var(--lp-line)] p-3 sm:flex">
          <Line w="60%" o={0.1} />
          <div className="mt-1.5 flex flex-col gap-1.5">
            <Line w="85%" />
            <Line w="70%" />
            <Line w="78%" />
            <Line w="62%" />
          </div>
          <div className="mt-auto flex flex-col gap-1.5">
            <Line w="72%" o={0.05} />
            <Line w="48%" o={0.05} />
          </div>
        </div>
        {/* the creator's vertical video, docked in the workspace */}
        <div className="flex w-[18%] items-stretch">
          <div
            className="w-full rounded-lg border border-[color:var(--lp-line)]"
            style={{ background: "rgba(236,231,222,0.05)" }}
          />
        </div>
        {/* reaction panels */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <Line w="22%" o={0.1} />
            <div className="flex gap-1.5">
              <Line w="34px" o={0.06} h={14} />
              <Line w="34px" o={0.06} h={14} />
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-lg border border-[color:var(--lp-line)] p-2.5"
                style={{ background: `rgba(236,231,222,${i % 2 ? 0.02 : 0.035})` }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ background: "rgba(236,231,222,0.1)" }}
                  />
                  <Line w="32%" o={0.08} h={5} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Line w="72%" o={0.09} h={5} />
                  <Line w="55%" o={0.07} h={5} />
                  <Line w="38%" o={0.05} h={5} />
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
