/**
 * hue-probe — hue-bucket a specimen's pixels. The SAME probe was run on the reference's canvas to
 * derive CORTEX_RAMP, so the two outputs are directly comparable.
 *
 *   node hue-probe.mjs <png> [<png> ...]
 */
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.cwd() + '/node_modules/sharp');

const rgb2hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, (mx + mn) / 2];
};

for (const file of process.argv.slice(2)) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const buckets = new Map();
  let tot = 0, sumSat = 0, sumLum = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx < 40) continue;                 // the well / background
      const sat = mx ? (mx - mn) / mx : 0;
      if (sat < 0.30) continue;              // near-grey chrome
      const [hue] = rgb2hsl(r, g, b);
      const k = Math.round(hue / 15) * 15;
      if (!buckets.has(k)) buckets.set(k, [0, 0, 0, 0]);
      const e = buckets.get(k);
      e[0] += r; e[1] += g; e[2] += b; e[3]++;
      tot++; sumSat += sat; sumLum += (mx + mn) / 2 / 255;
    }
  }
  console.log(`\n── ${file.split('/').pop()}`);
  if (!tot) { console.log('  no saturated pixels — the specimen is achromatic'); continue; }
  let warm = 0, cool = 0;
  for (const [k, [, , , n]] of buckets) (k <= 90 || k >= 330 ? (warm += n) : (cool += n));
  for (const k of [...buckets.keys()].sort((a, b) => a - b)) {
    const [r, g, b, n] = buckets.get(k);
    const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
    console.log(
      `  ${String(k).padStart(3)}deg ${(100 * n / tot).toFixed(1).padStart(5)}%  ` +
      `#${hex(r)}${hex(g)}${hex(b)}  ${'#'.repeat(Math.round(50 * n / tot))}`,
    );
  }
  console.log(
    `  ── ${tot} px · warm ${(100 * warm / tot).toFixed(0)}% / cool ${(100 * cool / tot).toFixed(0)}%` +
    ` · mean saturation ${(sumSat / tot).toFixed(2)} · mean luminance ${(sumLum / tot).toFixed(2)}`,
  );
}
