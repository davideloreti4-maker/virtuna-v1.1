import type { FlatPersonaReaction } from "@/components/board/audience/audience-derive";

/**
 * The landing's audience fixture — a snapshot of the SAME `ROOM_FOCUS` that
 * `/dev/cards` feeds the real `<AmbientRoom>` (registry-enum archetypes → the
 * named cast + verbatim quotes). Kept local so the offer route doesn't import
 * the dev page; the personas-only (non-grounded) shape means no gitignored
 * sample video is needed — the brain view runs as a labeled simulation over the
 * concept text and auto-plays.
 */
export const ROOM_CONCEPT = "Stop editing your videos. Do this instead.";
export const ROOM_FRACTION = "6/10 stop";

export const ROOM_PERSONAS: FlatPersonaReaction[] = [
  { archetype: "high_engager", verdict: "stop", quote: "Wait — do WHAT instead? I need the answer." },
  { archetype: "tough_crowd", verdict: "scroll", quote: "Every editor says this. Prove it in 3 seconds." },
  { archetype: "saver", verdict: "stop", quote: "Saving this before I forget it." },
  { archetype: "lurker", verdict: "stop", quote: "" },
  { archetype: "sharer", verdict: "stop", quote: "Sending this to my editor right now." },
  { archetype: "purposeful_viewer", verdict: "scroll", quote: "The hook promises more than the caption delivers." },
  { archetype: "loyalist", verdict: "stop", quote: "You never post filler — I'm staying." },
  { archetype: "niche_deep_buyer", verdict: "scroll", quote: "Nothing here tells me what it costs me." },
  { archetype: "niche_deep_scout", verdict: "stop", quote: "That's my exact problem, honestly." },
  { archetype: "cross_niche_curiosity", verdict: "scroll", quote: "Feels like last month's advice." },
];

export const ROOM_SIBLINGS = [
  { id: "h1", conceptText: "The edit nobody tells you about.", fraction: "9/10 stop" },
  { id: "h2", conceptText: "I deleted 40 hours of B-roll.", fraction: "7/10 stop" },
  { id: "h3", conceptText: ROOM_CONCEPT, fraction: ROOM_FRACTION },
  { id: "h4", conceptText: "Your cuts are why they leave.", fraction: "4/10 stop" },
  { id: "h5", conceptText: "Editing is a trap.", fraction: "2/10 stop" },
];
