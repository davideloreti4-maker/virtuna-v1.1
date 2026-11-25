import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevAudience, type DevAudienceState } from "./dev-audience";

/**
 * /dev/audience — the new Audience (spec 2026-11-25-audience) in each state, on made-up
 * fixtures and local state, inside the real shell. Nothing here sends anything. Dev-only: the /dev layout
 * 404s it in production, and with the flag off it does not exist.
 *
 *   /dev/audience?state=own|other|described|few|bare|not-default|group|menu|switcher|none|loading|failed
 *                      |read-again|reading|reading-thin|reading-failed
 *                      |new|new-describe|building|slow|thin|build-failed
 *
 * - own (default): @nia.tests, the creator's own account, the default: every block
 * - other: @leo.makes, another creator (no figures, no read videos: the route keeps none for one)
 * - described: "Busy parents who meal-prep", a description cut at three lines and More
 * - few: two posts read: no "Usual views", no multiples · bare: an older read, the groups only
 * - not-default: pushed (as /audience/[id]), not the default: "Use for new chats" above the main button
 * - group: own, with the third group's sheet open · menu: own, with More open
 * - switcher: own, with the pill's switcher open (a pick and New audience only close it)
 * - read-again: own, with Read again's question open (confirming only closes it)
 * - reading, reading-thin, reading-failed: own, read again: running in place of the page (the title
 *   alone in the header), too little to read (the groups kept), and failed; Close goes back to the page
 * - none: no audience yet · loading · failed
 * - new, new-describe: /audience/new's form on your own account, and on Describe them
 * - building, slow, thin, build-failed: a read of @nia.tests running (the covers in), past three
 *   minutes, with too little to read, and failed
 *
 * A row or a wedge opens its group's sheet (the ring dims the rest). More renames on the page only. The
 * buttons show their busy state for a moment.
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevAudienceState[] = ["own", "other", "described", "few", "bare", "not-default", "group", "menu", "switcher", "read-again", "reading", "reading-thin", "reading-failed", "none", "loading", "failed", "new", "new-describe", "building", "slow", "thin", "build-failed"];
const isState = (value: string): value is DevAudienceState => (STATES as readonly string[]).includes(value);

export default async function DevAudiencePage({ searchParams }: { searchParams: Promise<Params> }) {
  // Audience's new screen exists in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const state = one((await searchParams).state) ?? "own";
  if (!isState(state)) notFound();
  return <DevAudience key={state} state={state} />;
}
