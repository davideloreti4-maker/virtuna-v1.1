import { encode } from "uqr";

import { EARN_STRINGS } from "@/lib/earn/earn-words";

/**
 * The link's QR code (plan 2026-11-24-earn, step A), drawn as SVG squares from the matrix of the `uqr`
 * package (`encode(text)` → `{ size, data: boolean[][] }`, `true` = dark). Error correction "M" (a printed
 * or photographed card may be scuffed); uqr's own one-module border is turned off and the quiet zone the
 * standard asks for (four modules) is drawn here, as the plate, so the screen and the saved image
 * (`save-card.ts`, same matrix) place it the same way. One `<path>`, one run of dark modules per segment;
 * no markup string. The colours come from the caller (the share card's own, fixed in `save-card.ts`).
 */

export const QR_QUIET = 4;

export function qrMatrix(text: string): boolean[][] {
  return encode(text, { ecc: "M", border: 0 }).data;
}

/** The runs of dark modules in each row: `[x, y, length]`. */
export function qrRuns(matrix: readonly (readonly boolean[])[]): Array<[number, number, number]> {
  const runs: Array<[number, number, number]> = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      runs.push([start, y, x - start]);
    }
  });
  return runs;
}

export function QrCode({ text, ink, plate, className }: { text: string; ink: string; plate: string; className?: string }) {
  const matrix = qrMatrix(text);
  const box = matrix.length + QR_QUIET * 2;
  const d = qrRuns(matrix)
    .map(([x, y, n]) => `M${x} ${y}h${n}v1h-${n}z`)
    .join("");
  return (
    <svg
      role="img"
      aria-label={EARN_STRINGS.qrName}
      viewBox={`${-QR_QUIET} ${-QR_QUIET} ${box} ${box}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={-QR_QUIET} y={-QR_QUIET} width={box} height={box} fill={plate} />
      <path d={d} fill={ink} />
    </svg>
  );
}
