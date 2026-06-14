/**
 * AntiViralityHeader — the "Don't post yet" gate banner for the Reading
 * namespace (READ-03, D-04). This is the ONE friction-free board-React reuse in
 * the phase: the board component is already flat-warm-compatible (token gradient
 * `var(--color-accent)`→`var(--color-warning)`, no glow), self-manages its
 * localStorage dismissal, reads `counterfactuals?.suggestions` for the fix count
 * + `COPY.AV_HEADER(n)`, and returns `null` when `!result.anti_virality_gated`.
 *
 * Re-exported verbatim — NOT forked or restyled. The container (02-05) wires
 * `<AntiViralityHeader result={data} analysisId={id} />` ABOVE the gauge (D-04);
 * the banner does NOT hide the score (the score stays visible, subordinated).
 *
 * A bare re-export needs no `'use client'` directive — the board component
 * already declares its own.
 */
export { AntiViralityHeader } from '@/components/board/verdict/AntiViralityHeader';
