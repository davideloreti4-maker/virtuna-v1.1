"use client";

import type { Headline } from "@/lib/result/types";

/** An arc on a circle, clockwise from `a0` to `a1` degrees (0° points right). The mock's `arcP`. */
function arcPath(m: number, r: number, a0: number, a1: number): string {
  const at = (a: number) => [m + r * Math.cos((a * Math.PI) / 180), m + r * Math.sin((a * Math.PI) / 180)] as const;
  const [x0, y0] = at(a0);
  const [x1, y1] = at(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Inter's ascent and its content area per em: where the baseline of a line box sits. The text is
 * drawn in the SVG (type sizes outside the role scale live only there), placed where the mock's
 * HTML lines put it.
 */
const ASCENT = 0.96875;
const CONTENT = 1.2109;
/** The mock's text lines are 21 tall. */
const LINE = 21;

/**
 * The gauge (the mock's `gauge()` in the hero, `simP0` / `simD`): a 270° arc from 135°, round caps,
 * the track in `--color-track` and the value in ink; inside it the number with a small "%" and,
 * under it, the label. 148 in the phone hero (stroke 13), 180 on desktop (stroke 14). The box is
 * 0.88 of the size tall: the arc's open bottom needs no room. No "usual" line and no tick (slice B).
 */
export function Gauge({ headline, size }: { headline: Headline; size: number }) {
  const { value, label } = headline;
  const stroke = size >= 160 ? 14 : 13;
  const m = size / 2;
  const r = m - stroke / 2 - 10;
  const d = arcPath(m, r, 135, 405);
  const height = Math.round(size * 0.88);

  // The number's line starts 30% down the box; the label's line 1 (phone) or 4 (desktop) under it.
  const top = 0.3 * height;
  const numberSize = Math.round(size * (value >= 100 ? 0.25 : 0.31));
  const percentSize = Math.round(size * (value >= 100 ? 0.12 : 0.14));
  const numberBase = top + (1 - CONTENT) * numberSize * 0.5 + ASCENT * numberSize;
  const small = size < 160;
  const labelSize = small ? 11 : 12.5;
  const labelTop = top + numberSize + (small ? 1 : 4);
  const labelBase = labelTop + (LINE - CONTENT * labelSize) / 2 + ASCENT * labelSize;
  const fill = Math.max(0, Math.min(100, value));

  return (
    <div
      data-result="gauge"
      data-value={value}
      role="img"
      aria-label={`${value}% ${label}`}
      className="relative shrink-0"
      style={{ width: size, height }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block overflow-visible" aria-hidden>
        <path data-part="track" d={d} fill="none" stroke="var(--color-track)" strokeWidth={stroke} strokeLinecap="round" />
        {fill > 0 && (
          <path
            data-part="value"
            d={d}
            pathLength={100}
            fill="none"
            stroke="var(--color-foreground)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fill} 100`}
          />
        )}
        <text x={m} y={numberBase.toFixed(2)} textAnchor="middle" className="tabular-nums">
          <tspan fontSize={numberSize} fontWeight={700} letterSpacing="-0.055em" fill="var(--color-foreground)">
            {value}
          </tspan>
          <tspan dx={1} fontSize={percentSize} fontWeight={560} letterSpacing="-0.02em" fill="var(--color-foreground-muted)">
            %
          </tspan>
        </text>
        <text
          x={m}
          y={labelBase.toFixed(2)}
          textAnchor="middle"
          fontSize={labelSize}
          fontWeight={430}
          fill="var(--color-foreground-secondary)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
