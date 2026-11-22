import { notFound } from "next/navigation";

import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

import { DevAnswers, type DevAnswersSkin, type DevAnswersState } from "./dev-answers";

/**
 * /dev/answers — the thread's answer cards in each state of the approved drawing
 * (`.scratch/next-look/part3/answers/answer-system.png`; single renders `answers/renders/ax-*.png`),
 * drawn from the shared fixtures inside the real "Maven" turn, in a column of the drawing's width
 * (the phone's 361, the desktop's 720), so a full-window screenshot lines up with the drawing. For
 * looking at it; nothing here sends anything. Dev-only: the /dev layout 404s it in production,
 * and with the flag off it does not exist.
 *
 *   /dev/answers?state=<state>[&skin=light|dark][&frames=<base>]
 *
 * - p3: three hooks, not simulated · p4: "Simulate all" at 2 of 3 · p5: all simulated, Best on
 *   hook 3 (at 1440 wide this is the desktop drawing d2) · p12: four ideas, not simulated
 * - p8: a video simulating ("running", the clock from 0:41, "Watch it run"); its thumbnail is the
 *   plain tile (the dev page has no staged file)
 * - p9 / d3: the video's result, the recorded run `middle` (46, "Half leave by 0:17.") read by the
 *   real `videoStateOf`; the layout follows the window by CSS (d3 is p9 at 1440 wide)
 * - p10: the script, the opening not simulated · p11: the remix · p13: the fallback card (the
 *   account read; the chat answer above it in the drawing is not a card)
 * - Not drawn, for looking at: p9b the video's row still loading · p10b the script's opening
 *   simulated · p11b three remixes on the pager
 * - skin: paints that theme on <html> for this page without storing it
 * - frames: the recorded run's scenes get the frames `<base>/<index>.jpg` (its stored ones have
 *   expired), so the video's thumbnail is the first scene frame, as in a thread
 */

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;

// Kept here, not imported from the client module: a server file gets a client module's values as
// references, not as the array.
const STATES: readonly DevAnswersState[] = ["p3", "p4", "p5", "p12", "p8", "p9", "p9b", "p10", "p10b", "p11", "p11b", "p13", "d3"];
const SKINS: readonly DevAnswersSkin[] = ["light", "dark"];
const isState = (value: string): value is DevAnswersState => (STATES as readonly string[]).includes(value);
const isSkin = (value: string): value is DevAnswersSkin => (SKINS as readonly string[]).includes(value);

export default async function DevAnswersPage({ searchParams }: { searchParams: Promise<Params> }) {
  // The answer cards exist in the new look only; with the flag off this page does not exist either.
  if (!NEW_LOOK_ENABLED) notFound();
  const params = await searchParams;
  const state = one(params.state) ?? "p3";
  const skin = one(params.skin) ?? "light";
  if (!isState(state) || !isSkin(skin)) notFound();
  const frames = one(params.frames) ?? null;
  return <DevAnswers key={`${state}-${skin}-${frames ?? ""}`} state={state} skin={skin} frames={frames} />;
}
