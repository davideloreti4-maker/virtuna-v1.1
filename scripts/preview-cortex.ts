/**
 * preview-cortex — DEV TOOL ONLY (never imported by the app).
 *
 * Rasterizes `src/lib/brain/cortex-mesh.ts` to a PNG with the same lighting model the WebGL shader
 * uses, so the anatomy (fold frequency, sulcal depth, the sylvian fissure, the temporal lobe) can be
 * tuned in ~1s instead of a dev-server + Playwright round trip.
 *
 *   npx tsx scripts/preview-cortex.ts [out.png]
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { cortexMesh, parcelTextures, surfaceValues } from '../src/lib/brain/cortex-mesh';
import { ACTIVATION_SPAN, ACTIVATION_THRESHOLD, predictedBold } from '../src/lib/brain/cortex-sim';

const OUT = process.argv[2] ?? '/tmp/cortex.png';
const W = 900;
const H = 700;

const SEED = 20260713;
const mesh = cortexMesh(SEED);
console.log(`vertices ${mesh.vertexCount} · faces ${mesh.indices.length / 3} · parcels ${mesh.parcelCount}`);

// The real response, at a real scan time — so the preview shows the MAP, not just the anatomy.
const T = Number(process.env.T ?? 6);
const bold = predictedBold(
  { mode: 'simulated', stopRatio: 0.6, durationS: 15, seedKey: 'preview' },
  T,
);
const values = surfaceValues(mesh, parcelTextures(mesh, SEED), bold, T);

// ── The camera: a 3/4 lateral view of the left hemisphere.
// A true LATERAL profile — the classic figure. Only a hint of yaw, so it reads as a solid without
// tipping into a top-down view (which is what killed the first pass).
const YAW = Number(process.env.YAW ?? 0.22);
const PITCH = Number(process.env.PITCH ?? 0.06);
const DIST = 3.3;
const FOV = 0.52;

const cy = Math.cos(YAW), sy = Math.sin(YAW);
const cp = Math.cos(PITCH), sp = Math.sin(PITCH);

function view(x: number, y: number, z: number): [number, number, number] {
  // yaw about Y, then pitch about X, then push away along -Z
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  return [x1, y2, z2 - DIST];
}

const project = (v: [number, number, number]): [number, number, number] => {
  const f = 1 / FOV;
  const w = -v[2];
  return [W / 2 + (v[0] * f * H) / w, H / 2 - (v[1] * f * H) / w, w];
};

// ── The lighting model — mirrored in the shader.
const LIGHT = ((): [number, number, number] => {
  const l: [number, number, number] = [-0.45, 0.72, 0.85];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n];
})();
const GYRUS: [number, number, number] = [0xec, 0xe7, 0xde]; // cream — the brand's own
const SULCUS: [number, number, number] = [0x3a, 0x38, 0x35];
const BG: [number, number, number] = [0x26, 0x26, 0x24];

const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = BG[0];
  buf[i * 3 + 1] = BG[1];
  buf[i * 3 + 2] = BG[2];
}
const zbuf = new Float32Array(W * H).fill(Infinity);

const { positions, normals, curv, indices } = mesh;

// Pre-transform.
const vp: [number, number, number][] = [];
const vn: [number, number, number][] = [];
for (let i = 0; i < mesh.vertexCount; i++) {
  vp.push(view(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!));
  // Normals rotate with the camera (no translation).
  const nx = normals[i * 3]!, ny = normals[i * 3 + 1]!, nz = normals[i * 3 + 2]!;
  const x1 = nx * cy + nz * sy;
  const z1 = -nx * sy + nz * cy;
  vn.push([x1, ny * cp - z1 * sp, ny * sp + z1 * cp]);
}

// The diverging map: engaged cortex → sage, the default-mode system → coral.
const TASK_LOW: [number, number, number] = [0xa9, 0xc6, 0xa0];
const TASK_HIGH: [number, number, number] = [0x3f, 0x7a, 0x4a];
const DMN_LOW: [number, number, number] = [0xe6, 0xa9, 0x9d];
const DMN_HIGH: [number, number, number] = [0xc4, 0x42, 0x36];
const mix3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const shade = (
  n: [number, number, number],
  c: number,
  vz: [number, number, number],
  val: number,
): [number, number, number] => {
  const lam = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  // Sulci are darker BOTH because the tissue is shadowed (ambient occlusion) and because a folded
  // surface turns away from the light. The AO term is what sells the depth.
  const ao = 0.3 + 0.7 * c;
  const amb = 0.32;
  let base = mix3(SULCUS, GYRUS, c);
  const k = (amb + 0.9 * lam) * ao;

  // The activation, thresholded and lit — it lies ON the folds, it does not replace them.
  const a = Math.abs(val);
  if (a > ACTIVATION_THRESHOLD) {
    const s = Math.min(1, (a - ACTIVATION_THRESHOLD) / ACTIVATION_SPAN);
    const hot = val > 0 ? mix3(TASK_LOW, TASK_HIGH, s) : mix3(DMN_LOW, DMN_HIGH, s);
    base = mix3(base, hot, 0.35 + 0.65 * s);
  }

  // A cool rim keeps the silhouette off the background.
  const vlen = Math.hypot(...vz) || 1;
  const ndv = Math.abs((n[0] * vz[0] + n[1] * vz[1] + n[2] * vz[2]) / vlen);
  const rim = Math.pow(1 - ndv, 3) * 0.3;
  return [
    Math.min(255, base[0] * k + 255 * rim),
    Math.min(255, base[1] * k + 255 * rim),
    Math.min(255, base[2] * k + 255 * rim),
  ];
};

for (let f = 0; f < indices.length; f += 3) {
  const ia = indices[f]!, ib = indices[f + 1]!, ic = indices[f + 2]!;
  const pa = project(vp[ia]!), pb = project(vp[ib]!), pc = project(vp[ic]!);
  // Backface cull (screen-space winding).
  const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);
  if (area >= 0) continue;

  const minX = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(pa[0], pb[0], pc[0])));
  const minY = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(pa[1], pb[1], pc[1])));

  const ca = shade(vn[ia]!, curv[ia]!, vp[ia]!, values[ia]!);
  const cb = shade(vn[ib]!, curv[ib]!, vp[ib]!, values[ib]!);
  const cc2 = shade(vn[ic]!, curv[ic]!, vp[ic]!, values[ic]!);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((pb[0] - pa[0]) * (py - pa[1]) - (px - pa[0]) * (pb[1] - pa[1])) / area;
      const w1 = ((pc[0] - pb[0]) * (py - pb[1]) - (px - pb[0]) * (pc[1] - pb[1])) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      // barycentric: w1→a, w2→b, w0→c  (from the edge functions above)
      const z = w1 * pa[2] + w2 * pb[2] + w0 * pc[2];
      const o = y * W + x;
      if (z >= zbuf[o]!) continue;
      zbuf[o] = z;
      buf[o * 3] = w1 * ca[0] + w2 * cb[0] + w0 * cc2[0];
      buf[o * 3 + 1] = w1 * ca[1] + w2 * cb[1] + w0 * cc2[1];
      buf[o * 3 + 2] = w1 * ca[2] + w2 * cb[2] + w0 * cc2[2];
    }
  }
}

// ── Minimal PNG encoder (no deps).
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (b: Buffer) => {
  let c = -1;
  for (const byte of b) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2; // truecolour
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
}
writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log('→', OUT);
