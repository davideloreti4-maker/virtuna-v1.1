/**
 * ConstellationMark — connected-node SIM motif (sketch-faithful).
 *
 * One lit node carries the liveness signal via --color-accent; all other nodes
 * are neutral cream. Used in the audience presence peek band.
 */

export interface ConstellationMarkProps {
  /** SVG width (height scales from viewBox aspect). */
  width?: number;
  /** Which node index is lit (0-based, default 3 = top-right in sketch layout). */
  litNodeIndex?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

const NODES = [
  { cx: 8, cy: 28, r: 1.8, dim: true },
  { cx: 20, cy: 14, r: 2.4, dim: false },
  { cx: 34, cy: 22, r: 2, dim: false },
  { cx: 48, cy: 9, r: 3, dim: false, lit: true },
  { cx: 46, cy: 32, r: 1.8, dim: true },
  { cx: 58, cy: 20, r: 2.2, dim: false },
] as const;

const LINES = [
  [8, 28, 20, 14],
  [20, 14, 34, 22],
  [34, 22, 48, 9],
  [34, 22, 46, 32],
  [48, 9, 58, 20],
] as const;

export function ConstellationMark({
  width = 64,
  litNodeIndex = 3,
  className,
  'aria-hidden': ariaHidden = true,
}: ConstellationMarkProps) {
  const height = (width * 40) / 64;

  return (
    <svg
      viewBox="0 0 64 40"
      width={width}
      height={height}
      className={className}
      aria-hidden={ariaHidden}
      role="img"
      aria-label="Audience constellation"
    >
      {LINES.map(([x1, y1, x2, y2], i) => (
        <line
          key={`line-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      ))}
      {NODES.map((node, i) => {
        const isLit = i === litNodeIndex;
        if (isLit) {
          return (
            <g key={`node-${i}`}>
              <circle
                cx={node.cx}
                cy={node.cy}
                r={6.5}
                fill="var(--color-accent)"
                opacity={0.18}
              />
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.r}
                fill="var(--color-accent)"
              />
            </g>
          );
        }
        return (
          <circle
            key={`node-${i}`}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="var(--color-cream-secondary)"
            opacity={node.dim ? 0.45 : 1}
          />
        );
      })}
    </svg>
  );
}
