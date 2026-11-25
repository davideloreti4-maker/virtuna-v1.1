/**
 * changed.ts — where a change starts on the film (spec 2026-11-24-editor-screens-design.md §5.2; plan
 * 2026-11-24-editor-screens-a, Task 3), so the page can go there and play it. Read from the two edits' layouts (`derive.ts`):
 * for each film frame, what is drawn on it (the footage and the moment of it, its framing and look; the caption page that can
 * show; each part showing and how far into it). The film's own look and captions' settings reach every frame: when they
 * differ, the whole film changed and there is no one place (null), and the playhead stays. Sound alone is not seen. Pure.
 */
import { FPS, framingAt, layout, lookOf, momentOf, placed, runWords, type Edit } from "@/lib/edit";

/** What every frame shares: the stage, the film's look, the captions' settings. */
function filmWide(edit: Edit): string {
  return JSON.stringify([edit.stage, edit.look, edit.captions]);
}

/** What is drawn on each frame, as text. */
function framesOf(edit: Edit): string[] {
  const lay = layout(edit);
  const footage = new Array<string>(lay.frames).fill("");
  const over: string[][] = Array.from({ length: lay.frames }, () => []);
  edit.shots.forEach((shot, i) => {
    const place = lay.shots[i];
    const run = place ? lay.runs[place.run] : undefined;
    if (!place || !run) return;
    const look = JSON.stringify(lookOf(edit, shot));
    // Later shots write over earlier ones: in a transition the frame is the incoming shot's (`momentAt`).
    for (let f = Math.max(0, place.at); f < Math.min(lay.frames, place.at + place.frames); f++) {
      const ms = momentOf(run, f);
      const framed = framingAt(shot, ms);
      footage[f] = `${shot.asset}@${Math.round(ms)} ${framed.zoom.toFixed(3)} ${framed.x.toFixed(3)} ${framed.y.toFixed(3)} ${look}`;
    }
  });
  if (edit.captions.on) {
    for (const run of lay.runs) {
      const words = runWords(edit, run);
      // A page holds at most `maxWords` words, so a word can show from the start of a page up to that many words before it.
      words.forEach((word, k) => {
        const page = words.slice(k, k + edit.captions.maxWords).map((each) => `${each.text}${each.stress ? "*" : ""}`).join(" ");
        for (let f = run.at + word.from; f < Math.min(lay.frames, run.at + word.to); f++) over[f]!.push(`said ${page}`);
      });
    }
  }
  for (const thing of placed(edit)) {
    for (let f = thing.at; f < Math.min(lay.frames, thing.at + thing.frames); f++) {
      over[f]!.push(`${thing.thing.part} ${thing.thing.id} ${f - thing.at + thing.skip} ${JSON.stringify(thing.thing.props)}`);
    }
  }
  return footage.map((shown, f) => [shown, ...over[f]!.sort()].join("|"));
}

/**
 * The first film frame whose drawn content differs between `before` and `after`; null when nothing seen changed, or when the
 * whole film did (its look, its captions' settings). A film made shorter at its end gives a second before its new end, so the
 * new ending is played; one made longer gives its first new frame.
 *
 * For a fixed word it gives the start of the page that can show it, not of the page the kit sets (`pagesFor`): the frame of
 * the word `maxWords − 1` places before it, since a full page could start there. So it may be early by up to that many words
 * (two, at three words a page), on the page before the word's own. And a fix that adds or drops a closing mark moves the end
 * of a stretch of speech: where the pages are evened out over a stretch (captions set as a sentence), the kit then cuts the
 * stretch anew, and the film can differ from an earlier frame than the one given, which is still where the page that can
 * show the fixed word starts.
 */
export function firstChangedFrame(before: Edit, after: Edit): number | null {
  if (filmWide(before) !== filmWide(after)) return null;
  const was = framesOf(before);
  const now = framesOf(after);
  const shared = Math.min(was.length, now.length);
  for (let f = 0; f < shared; f++) if (was[f] !== now[f]) return f;
  if (was.length === now.length) return null;
  return now.length < was.length ? Math.max(0, now.length - FPS) : shared;
}
