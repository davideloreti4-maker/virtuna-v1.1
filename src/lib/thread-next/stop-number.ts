/**
 * stop-number.ts — the ONE number a text simulation shows: "would stop to watch"
 * (spec §3 rule 4; plan's global constraint "Numbers").
 *
 * It is `Math.round(seal.population.stopPct)` and nothing else: never `seal.pct`, `fraction`,
 * `band`, `rank`, `scrollQuote` or a projected score. A seal with no usable population (written
 * before populations existed, a General run that sealed `population: null`, a sealed wire seal an
 * anonymous visitor receives, anything malformed) has no number, so its row reads as not simulated.
 *
 * Takes `unknown`: it receives wire seals (`WireSimSeal`, `src/lib/onboarding/verdict-seal.ts`).
 *
 * Pure: no React.
 */

export function stopNumberOf(seal: unknown): number | null {
  if (!seal || typeof seal !== "object" || Array.isArray(seal)) return null;
  const s = seal as { sealed?: unknown; population?: unknown };
  if (s.sealed === true) return null;
  const p = s.population;
  if (!p || typeof p !== "object") return null;
  const pct = (p as { stopPct?: unknown }).stopPct;
  if (typeof pct !== "number" || !Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return Math.round(pct);
}
