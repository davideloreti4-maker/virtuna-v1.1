import { cn } from "@/lib/utils";

/**
 * RetentionCurve — the page's signature element.
 *
 * Maven's whole claim is that it can name the exact second an audience leaves.
 * The retention curve is the instrument that says so, and it is the one object
 * in this product's world that belongs to no other landing page. On the page it
 * appears as the receipts' before/after sparklines and as the final CTA's
 * backdrop reprise. The full-size RetentionCurve below is currently UNMOUNTED —
 * it drew full-bleed under the hero headline until the owner cut that band
 * (2026-08-10, "doesn't add value"); it stays exported for a return with real
 * per-video data.
 *
 * ── Geometry ───────────────────────────────────────────────────────────────
 * The path is a sequence of named cubic segments so the DROP can be redrawn on
 * top in accent without duplicating hand-tuned control points:
 *
 *   P0 (0,24) ─S1→ P1 (250,34) ─S2→ P2 (344,52) ─S3→ P3 (414,96)
 *              ─S4→ P4 (512,127) ─S5→ P5 (860,153) ─S6→ P6 (1200,162)
 *
 * P2 is the moment of departure: the last frame before the fall. The accent
 * overlay covers S3+S4 — the fall itself — and the marker pins P2.
 *
 * ── Why the stroke stretches but the dot does not ──────────────────────────
 * The curve is full-bleed and must hold a usable height at 390px as well as
 * 1440px, so the SVG runs `preserveAspectRatio="none"` and stretches its
 * geometry to the container. That would turn a circular marker into an ellipse
 * and squash any SVG text, so the marker, the guide line and the labels are
 * plain HTML positioned in PERCENTAGES of the same viewBox (344/1200 across,
 * 52/180 down). `vector-effect: non-scaling-stroke` keeps the line weight
 * honest under the same stretch.
 */

/** The curve, as segments. Concatenated for the base path; sliced for the drop. */
const P0 = "M 0 24";
const S1 = "C 90 26, 170 29, 250 34";
const S2 = "C 288 37, 318 42, 344 52";
const S3 = "C 372 63, 392 82, 414 96";
const S4 = "C 440 112, 470 121, 512 127";
const S5 = "C 610 141, 720 148, 860 153";
const S6 = "C 990 158, 1090 160, 1200 162";

const FULL_PATH = [P0, S1, S2, S3, S4, S5, S6].join(" ");
/** The fall only — S3 and S4, starting from P2. Drawn over the base in accent. */
const DROP_PATH = ["M 344 52", S3, S4].join(" ");
/** The base path closed to the floor, for the area fill. */
const AREA_PATH = `${FULL_PATH} L 1200 180 L 0 180 Z`;

/** Rough arc length, used to seed the draw-on animation's dash offset. */
const DRAW_LENGTH = 1320;

/** P2, as a fraction of the viewBox — where the HTML marker pins itself. */
const MARK_X = `${(344 / 1200) * 100}%`;
const MARK_Y = `${(52 / 180) * 100}%`;

interface RetentionCurveProps {
  /** The timestamp of the drop, e.g. "2.4s". Rendered in mono, cream. */
  timestamp?: string;
  /** What happened there, e.g. "61% gone". Rendered in mono, muted. */
  note?: string;
  /** Axis end labels. */
  from?: string;
  to?: string;
  className?: string;
}

export function RetentionCurve({
  timestamp = "2.4s",
  note = "61% gone",
  from = "0:00",
  to = "0:30",
  className,
}: RetentionCurveProps) {
  return (
    <div
      className={cn("relative w-full", className)}
      style={{ height: "clamp(140px, 15vw, 210px)" }}
    >
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 180"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lp-curve-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ece7de" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#ece7de" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Body under the line — gives the curve mass without a second colour. */}
        <path d={AREA_PATH} fill="url(#lp-curve-area)" className="lp-curve-fill" />

        {/* The curve itself, drawn once on load. */}
        <path
          d={FULL_PATH}
          fill="none"
          stroke="#ece7de"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="lp-curve-path"
          style={{ ["--lp-draw-length" as string]: DRAW_LENGTH }}
        />

        {/* The fall, in accent — one of the four sanctioned accent jobs. */}
        <path
          d={DROP_PATH}
          fill="none"
          stroke="var(--lp-accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="lp-curve-path"
          style={{ ["--lp-draw-length" as string]: DRAW_LENGTH }}
        />
      </svg>

      {/* Floor rule — the axis the curve is measured against. */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-[color:var(--lp-line)]" />

      {/* Guide dropping from the moment of departure to the axis. */}
      <div
        aria-hidden
        className="lp-curve-mark absolute w-px"
        style={{
          left: MARK_X,
          top: MARK_Y,
          bottom: 0,
          background:
            "linear-gradient(to bottom, rgba(255,99,99,0.5), rgba(255,99,99,0))",
        }}
      />

      {/* The marker. Kept as HTML so the dot stays round under the SVG's
          non-uniform scale. Dot and label are positioned SEPARATELY: centring a
          combined flex row on the point drags the label leftward across the
          guide line, so the two overprint. The dot centres on P2; the label
          hangs to its right, clear of the guide. */}
      <span
        aria-hidden
        className="lp-curve-mark absolute block h-[7px] w-[7px] rounded-full bg-[color:var(--lp-accent)]"
        style={{
          left: MARK_X,
          top: MARK_Y,
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 0 4px rgba(255,99,99,0.16)",
        }}
      />
      <div
        className="lp-curve-mark absolute flex items-baseline gap-2 whitespace-nowrap"
        style={{ left: MARK_X, top: MARK_Y, transform: "translate(16px, -50%)" }}
      >
        <span className="lp-mono text-[13px] font-medium text-[color:var(--lp-fg)]">
          {timestamp}
        </span>
        <span className="lp-mono text-[11px] text-[color:var(--lp-fg-3)]">{note}</span>
      </div>

      {/* Axis ends. Small, mono, and the only other type on the instrument. */}
      <div className="lp-curve-mark pointer-events-none absolute inset-x-0 bottom-0 flex justify-between pb-2">
        <span className="lp-mono text-[10px] tracking-[0.08em] text-[color:var(--lp-fg-3)]">
          {from}
        </span>
        <span className="lp-mono text-[10px] tracking-[0.08em] text-[color:var(--lp-fg-3)]">
          {to}
        </span>
      </div>
    </div>
  );
}

/**
 * Sparkline — the curve's third and smallest appearance, for the result
 * receipts. Same instrument, no instrumentation: no marker, no axis, no labels,
 * because at 64px wide the reading is the SHAPE (held vs collapsed), and any
 * annotation at that size is noise. `tone="held"` is the after, `"dropped"` the
 * before.
 */
export function Sparkline({
  tone = "dropped",
  className,
}: {
  tone?: "held" | "dropped";
  className?: string;
}) {
  const path =
    tone === "held"
      ? "M 0 26 C 24 28, 48 31, 72 35 C 96 39, 120 44, 144 52"
      : "M 0 22 C 18 24, 30 27, 42 33 C 54 41, 62 56, 76 62 C 96 70, 120 73, 144 76";

  return (
    <svg
      aria-hidden
      viewBox="0 0 144 84"
      preserveAspectRatio="none"
      className={cn("h-full w-full", className)}
    >
      <path
        d={path}
        fill="none"
        stroke={tone === "held" ? "#ece7de" : "#8a857c"}
        strokeOpacity={tone === "held" ? 0.75 : 0.55}
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * SparklinePair — both cuts of the same video in ONE panel: the first cut
 * collapsing (muted), the posted cut holding (cream), drawn over each other so
 * the gap between them IS the story. Replaces the receipts' side-by-side boxes,
 * which spent two borders saying what one overlay says better. Same shapes as
 * Sparkline, rescaled to a wide panel.
 */
export function SparklinePair({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 288 84"
      preserveAspectRatio="none"
      className={cn("h-full w-full", className)}
    >
      <path
        d="M 0 20 C 28 22, 48 25, 66 34 C 84 44, 94 60, 112 67 C 152 76, 220 79, 288 80"
        fill="none"
        stroke="#8a857c"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M 0 18 C 48 20, 100 23, 152 27 C 204 31, 252 35, 288 40"
        fill="none"
        stroke="#ece7de"
        strokeOpacity="0.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
