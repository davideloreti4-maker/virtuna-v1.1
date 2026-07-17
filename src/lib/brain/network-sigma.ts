/**
 * network-sigma — Sapient's "RAW NETWORK ACTIVATION · 7 NETWORKS, Z-SCORED" section, honest.
 *
 * At the playhead second, each of the seven networks is expressed as a Z-SCORE against the CLIP'S OWN
 * baseline: how far this second's predicted BOLD sits from that network's mean over the whole clip, in
 * standard deviations. Sapient's exact framing — "how far this second sits from the clip's own
 * baseline". This is honest because the baseline is the clip itself: no benchmark, no outside corpus.
 *
 * ⚠️ GROUNDED ONLY. In simulated (text) mode the drive is a fixed envelope and the BOLD barely moves,
 * so its standard deviation is ~0 and z-scoring divides real structure out of nearly-flat noise —
 * manufacturing σ where there is none (the same trap `buildTrace` documents). The caller must gate on
 * `drive.mode === 'grounded'`; `networkSigmas` additionally returns [] if the series is too flat to
 * z-score honestly.
 */

import { NETWORK_IDS, predictedBold, type DriveInput, type NetworkId } from './cortex-sim';

/** Our Yeo id → Sapient's display name, in Sapient's row order. */
const ROWS: { net: NetworkId; label: string }[] = [
  { net: 'visual', label: 'Visual' },
  { net: 'somatomotor', label: 'Somatomotor' },
  { net: 'dorsal_attention', label: 'Dorsal Attention' },
  { net: 'salience', label: 'Ventral Attention' },
  { net: 'limbic', label: 'Limbic' },
  { net: 'control', label: 'Frontoparietal' },
  { net: 'default', label: 'Default Mode' },
];

export type SigmaBand = 'clearly below' | 'slightly below' | 'about normal' | 'slightly above' | 'clearly above';

export interface NetworkSigma {
  net: NetworkId;
  label: string;
  /** z-score at the playhead second, vs this network's own mean/σ over the clip */
  z: number;
  band: SigmaBand;
}

function bandOf(z: number): SigmaBand {
  const a = Math.abs(z);
  if (a < 0.15) return 'about normal';
  if (z < 0) return a < 0.6 ? 'slightly below' : 'clearly below';
  return a < 0.6 ? 'slightly above' : 'clearly above';
}

/** The clip is flat below this pooled σ — z-scoring it would manufacture signal, so we decline. */
const MIN_POOLED_STD = 0.02;

/**
 * Per-network z-scores at scan-time `tSec`, against the clip's own baseline. Pure and deterministic.
 * Returns [] when not grounded or when the clip is too flat to z-score honestly.
 */
export function networkSigmas(drive: DriveInput, durationS: number, tSec: number, samples = 48): NetworkSigma[] {
  if (drive.mode !== 'grounded') return [];
  const duration = durationS > 0 ? durationS : 1;

  // Sample each network across the whole clip → per-network series.
  const series = Object.fromEntries(NETWORK_IDS.map((n) => [n, [] as number[]])) as Record<NetworkId, number[]>;
  for (let i = 0; i < samples; i++) {
    const t = (i / Math.max(1, samples - 1)) * duration;
    const b = predictedBold(drive, t);
    for (const n of NETWORK_IDS) series[n].push(b[n]);
  }

  const at = predictedBold(drive, Math.max(0, Math.min(duration, tSec)));
  let pooled = 0;
  const out = ROWS.map(({ net, label }) => {
    const s = series[net];
    const mean = s.reduce((a, b) => a + b, 0) / s.length;
    const variance = s.reduce((a, b) => a + (b - mean) * (b - mean), 0) / s.length;
    const std = Math.sqrt(variance);
    pooled = Math.max(pooled, std);
    const z = std > 1e-6 ? (at[net] - mean) / std : 0;
    return { net, label, z: Math.round(z * 100) / 100, band: bandOf(std > 1e-6 ? (at[net] - mean) / std : 0) };
  });

  // If NOTHING in the clip moves, there is no honest baseline to z-score against.
  if (pooled < MIN_POOLED_STD) return [];
  return out;
}

/** How a network reads when it is the standout, above vs below its own baseline. Descriptive, modeled. */
const READS: Record<NetworkId, { above: string; below: string }> = {
  visual: { above: 'the visuals are pulling hardest here', below: 'the visuals are doing the least work here' },
  somatomotor: { above: 'the voice and motion are landing', below: 'the voice and motion have gone quiet' },
  dorsal_attention: { above: 'focus is locked in', below: "the viewer's focus is drifting" },
  salience: { above: 'something just pricked their attention', below: 'nothing is catching them here' },
  limbic: { above: 'it is landing emotionally', below: 'it is leaving them cold' },
  control: { above: 'they are working to follow it', below: 'they have stopped working to follow it' },
  default: { above: 'the memory and self-relevance network is up — it reads as personally about the viewer', below: 'they are fully in it, not mind-wandering' },
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * The "WHY THIS SECOND" line — names the standout network (largest |z|) and, if there is a second
 * clearly-notable one, contrasts it. Optionally quotes the line playing at this second. Modeled, and
 * says nothing a z-score does not support.
 */
export function whyThisSecond(sigmas: NetworkSigma[], tSec: number, transcript?: string): string {
  if (sigmas.length === 0) return '';
  const sorted = [...sigmas].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const lead = sorted[0]!;
  const leadRead = lead.z >= 0 ? READS[lead.net].above : READS[lead.net].below;
  const quote = transcript ? ` as the clip says '${transcript.trim().slice(0, 60)}${transcript.trim().length > 60 ? '…' : ''}'` : '';
  let line = `At ${mmss(tSec)}, ${lead.label} is the standout at ${lead.z >= 0 ? '+' : ''}${lead.z.toFixed(2)}σ — ${leadRead}${quote}.`;
  const second = sorted.find((s) => s.net !== lead.net && Math.abs(s.z) >= 0.3);
  if (second) {
    const secRead = second.z >= 0 ? READS[second.net].above : READS[second.net].below;
    line += ` Meanwhile ${second.label} sits ${second.z >= 0 ? '+' : ''}${second.z.toFixed(2)}σ — ${secRead}.`;
  }
  return line;
}
