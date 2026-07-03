/**
 * Ambient-tone palette — the audience-reaction signal (loved / bounced / neutral).
 *
 * This is the moat's visual language, NOT chrome: a muted sage for loved, the brand
 * terracotta for bounced (a sanctioned liveness use — the room reacting), muted cream
 * for neutral. Values match the signed-off v3 prototype exactly. Kept out of the
 * generic score-zone tokens on purpose — these dots mean "your people reacted".
 */

import type { Tone } from "@/lib/room-contract/types";

/** Solid dot fill per tone (inline style — exact prototype hex). */
export const toneDot: Record<Tone, string> = {
  loved: "#8ea68a", // muted sage — a win with your people
  bounced: "var(--color-accent)", // terracotta — the room pushed back
  neutral: "rgba(255,255,255,0.42)",
};

/** Softer fill for split bars / avatars. */
export const toneBar: Record<Tone, string> = {
  loved: "#8ea68a",
  bounced: "var(--color-accent)",
  neutral: "#8a857b",
};

/** Human label for a tone (used in the calendar legend + Room split). */
export const toneLabel: Record<Tone, string> = {
  loved: "predicted win",
  bounced: "risky",
  neutral: "neutral",
};
