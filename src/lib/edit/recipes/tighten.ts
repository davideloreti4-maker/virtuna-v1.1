/**
 * tighten.ts — the pauses of an edit made shorter, inside the silence the worker measured (X54, N3,
 * N8). Pure: an edit and its takes' analyses in, operations out, the same every time, and run on its
 * own output it changes nothing.
 *
 * The rules, as built (the brief, with rulings A1 to A3 of part 3's Task 4, its round 0 and its
 * fix rounds 1 to 3):
 * - A silence is a measured pause, or pauses with only wordless gaps of at most 400 ms between them
 *   (a click, a breath), tightened as one (round 0, ruling 1). A pause is half-open (`[start, end)`,
 *   as `review` reads a cut's side): its end is where a word starts, never a cut point (A1). Every
 *   moved side lands inside a pause, and no shot is ever made longer.
 * - A silence holding joins or cuts between shots of its take in a row (a creator's splits, or cuts
 *   already made) has one budget (fix round 3, N1): what its shots show of it, less `pauseMs`. It is
 *   spent at the join or cut nearest the silence's quietest moment (its longest pause's `cutMs`) as
 *   far as that one can go, then at the others, nearest first, never past the budget in all. Each
 *   move keeps the shots beside it three frames long by their planned ends. Where nothing fits in the
 *   budget and the silence is still shown whole, the smallest move there is goes: what the gap forces.
 *   A split where a word starts cannot open into a pause, so it stays a join (the controller's
 *   decision (a)).
 * - Any other end of a shot in a silence keeps at most `pauseMs / 2` of it next to the speech: the
 *   start moves to the silence's end less that, the end to its start plus that, each held inside the
 *   silence's last or first pause. The film's own start and end follow its words (ruling 2): it
 *   starts `pauseMs / 2` before its take's first word, or later by the rule above, and ends
 *   `pauseMs / 2` after its last word, or earlier by it; `review` passes them there. If a level whose
 *   moment lies in the stretch so kept is more than 12 LU above the film's speech median, that edge
 *   moves to 60 ms from the word, and the result says so (`transients`). Ends that would leave a shot
 *   under three frames are not trimmed, but the film's own end (or start), past its last word, is
 *   trimmed as far as three frames allow (O3).
 * - Inside a shot, each silence it holds whole and longer than `pauseMs` loses all but `pauseMs`.
 *   One pause: the stretch removed is centred on its `cutMs` and held inside it,
 *   `lo = clamp(cutMs − r/2, start, end − 1 − r)`, `hi = lo + r`, with `r = (end − start) − pauseMs`.
 *   Several: from the first pause into the last, keeping `pauseMs / 2` in each where they hold it;
 *   where they cannot hold `pauseMs`, the length nearest it (NB1). It goes as `shot.split` at `lo`
 *   with a new id, `<shot id>-t<n>`, then `shot.trim` of the new piece to start at `hi`.
 * - No shot may end up shorter than three frames (A2). Every piece is at least three frames' worth of
 *   milliseconds at its speed, which fills three frames wherever its run starts. A removal that would
 *   leave a shorter piece is slid inside its pauses, away from it; if that is not enough it is shrunk
 *   to what the floors allow (O4: the budget rule, never past it); if nothing can go, the silence stays.
 * - A shot already shorter than that has its three frames only from where its run starts: such a run
 *   is left alone, all of it (round 0, ruling 3).
 * Counted: removals inside shots slid or shrunk or of joined pauses, silences longer than `pauseMs`
 * shown whole as before (each once, N2), and runs left alone. Milliseconds are whole, `pauseMs` too: a
 * fractional one is rounded once, after its range is checked (fix round 4).
 */
import type { Analyses, Pause, TakeAnalysis } from "../analysis";
import { assetOf, layout } from "../derive";
import { IdSchema, type Edit, type Shot, type Word } from "../doc";
import type { Op } from "../ops";
import { MIN_FRAMES, msOf } from "../time";

/** The pause a tightened cut keeps, in ms: from 120 (the shortest the worker measures) to 400. */
export const PAUSE_MS = { min: 120, max: 400 } as const;
/** The longest wordless gap between two pauses that still makes them one silence (round 0, ruling 1). */
const JOIN_MS = 400;
/** How far above the film's speech median a level in a kept head or tail must be to count as a transient, in LU. */
const TRANSIENT_LU = 12;
/** Where a film edge goes from its word when a transient is kept next to it. */
const TRANSIENT_EDGE_MS = 60;
/** The worker's floor: nothing reads under -70 LUFS, which is silence. */
const SILENCE_LUFS = -70;

/** A film edge moved to 60 ms from its word because of a loud level in the stretch it kept. */
export interface Transient {
  shot: string;
  side: "start" | "end";
  /** The level's moment and loudness. */
  levelMs: number;
  lufs: number;
  /** Where the edge is now. */
  edgeMs: number;
}

/** What `tighten` did: its operations, and what it had to do about pieces too short, joined pauses and transients. */
export interface Tightened {
  ops: Op[];
  /** Removals slid inside their pauses, or shrunk, to keep the pieces beside them three frames long (A2). */
  slid: number;
  shrunk: number;
  /** Silences longer than `pauseMs` (as shown) that are shown the same after as before, each counted once (N2). */
  leftAlone: number;
  /** Runs left alone, all of them, for holding a shot under three frames' worth of milliseconds. */
  runsLeftAlone: number;
  /** Removals of a silence of several pauses. */
  joined: number;
  transients: Transient[];
}

/** The operations that tighten the edit's pauses to `pauseMs`. */
export function tighten(edit: Edit, analyses: Analyses, opts: { pauseMs: number }): Op[] {
  return tightened(edit, analyses, opts).ops;
}

/** `tighten`, with the counts of what it had to do. */
export function tightened(edit: Edit, analyses: Analyses, opts: { pauseMs: number }): Tightened {
  if (!(opts.pauseMs >= PAUSE_MS.min && opts.pauseMs <= PAUSE_MS.max)) throw new RangeError(`pauseMs is ${opts.pauseMs}; it is ${PAUSE_MS.min} to ${PAUSE_MS.max}`);
  // Rounded once, here, and used so everywhere (fix round 4, B1): rounded in two places, k + 0.5 kept k + 1 of a joined
  // silence, and a second run read the budget left as round(0.5) = 1 and took 1 ms more.
  const pauseMs = Math.round(opts.pauseMs);
  const done: Tightened = { ops: [], slid: 0, shrunk: 0, leftAlone: 0, runsLeftAlone: 0, joined: 0, transients: [] };
  const takes = takesOf(edit, analyses);
  const speech = speechMedian(edit, analyses);
  const lay = layout(edit);

  // A run holding a shot under three frames' worth is left alone, all of it (round 0, ruling 3).
  const fragile = new Set<number>();
  for (const run of lay.runs) {
    if (!edit.shots.slice(run.first, run.last + 1).some((shot) => shot.endMs - shot.startMs < leastMs(shot))) continue;
    for (let i = run.first; i <= run.last; i++) fragile.add(i);
  }

  // The silences holding a join or a cut between shots of their take (fix round 3, N1), and the sides they hold.
  const chains = chainsOf(edit, takes);
  const held = sidesHeld(edit, chains);
  // Each shot's own ends: the sides no such silence holds.
  const ends: Ends[] = edit.shots.map((shot, i) => {
    const take = takes.get(shot.asset);
    if (!take || fragile.has(i)) return { from: shot.startMs, to: shot.endMs, transients: [] };
    return ownEnds(shot, take, pauseMs, { first: i === 0, last: i === edit.shots.length - 1 }, speech, { start: held.has(`${i} start`), end: held.has(`${i} end`) });
  });
  // Each such silence spends its one budget at its joins and cuts, on the ends planned so far.
  for (const chain of chains) spend(edit, chain, ends, fragile, pauseMs);

  // Inside each shot, the silences it holds whole; then the operations.
  const used = idsOf(edit);
  const shown: { asset: string; pieces: [number, number][] }[] = [];
  edit.shots.forEach((shot, i) => {
    const take = takes.get(shot.asset);
    const removals = take && !fragile.has(i) ? inner(shot, take, ends[i]!, pauseMs) : [];
    emit(shot, ends[i]!, removals, used, done);
    const pieces: [number, number][] = [];
    let at = ends[i]!.from;
    for (const removal of removals) {
      pieces.push([at, removal.lo]);
      at = removal.hi;
    }
    pieces.push([at, ends[i]!.to]);
    shown.push({ asset: shot.asset, pieces });
  });

  // What was left whole (N2): each silence longer than pauseMs as shown, shown just as before, counted once.
  for (const [asset, take] of takes) {
    for (const silence of take.silences) {
      const before = edit.shots.reduce((sum, shot) => sum + (shot.asset === asset ? overlap(shot.startMs, shot.endMs, silence) : 0), 0);
      const after = shown.reduce((sum, each) => sum + (each.asset === asset ? each.pieces.reduce((inner, [from, to]) => inner + overlap(from, to, silence), 0) : 0), 0);
      if (Math.round(before - pauseMs) > 0 && after === before) done.leftAlone++;
    }
  }
  // A run left alone counts when it shows more than pauseMs of a silence.
  for (const run of lay.runs) {
    if (!fragile.has(run.first)) continue;
    const shots = edit.shots.slice(run.first, run.last + 1);
    const shows = (asset: string, silence: Silence) => shots.reduce((sum, shot) => sum + (shot.asset === asset ? overlap(shot.startMs, shot.endMs, silence) : 0), 0);
    done.runsLeftAlone += Number([...takes].some(([asset, take]) => take.silences.some((silence) => shows(asset, silence) > pauseMs)));
  }
  return done;
}

/** How much of a silence's span a stretch [from, to) holds. */
const overlap = (from: number, to: number, silence: Silence): number => Math.max(0, Math.min(to, silence.endMs) - Math.max(from, silence.startMs));

/** The shortest a piece of a shot may be: three frames' worth at its speed. It fills three frames wherever its run starts (round(x + 3) − round(x) = 3). */
const leastMs = (shot: Shot): number => Math.ceil(msOf(MIN_FRAMES, shot.speed) - 1e-9);

/** A pause, or pauses with only wordless gaps of at most 400 ms between them: from the first's start to the last's end. */
interface Silence {
  startMs: number;
  endMs: number;
  pauses: Pause[];
}

/** Whether a moment lies in a silence: "in" one of its pauses ([start, end), as review reads a cut's side), or just "after" silence ((start, end]: a shot's end). */
function holds(silence: Silence, ms: number, how: "in" | "after"): boolean {
  return silence.pauses.some((pause) => (how === "in" ? pause.startMs <= ms && ms < pause.endMs : pause.startMs < ms && ms <= pause.endMs));
}

/** What `tighten` reads of a take with words and measured pauses, worked out once (M3). */
interface Take {
  found: TakeAnalysis;
  silences: Silence[];
  /** Where its first word starts and its last word ends. */
  firstWord: number;
  lastEnd: number;
}

/** The takes the edit's shots show that have words and measured pauses, by asset id. */
function takesOf(edit: Edit, analyses: Analyses): Map<string, Take> {
  const takes = new Map<string, Take>();
  for (const asset of edit.assets) {
    if (asset.kind !== "video" || !asset.words?.length) continue;
    const found = analysisFor(analyses, asset.id);
    if (!found?.pauses.length) continue;
    takes.set(asset.id, { found, silences: silencesOf(found.pauses, asset.words), firstWord: asset.words[0]!.startMs, lastEnd: Math.max(...asset.words.map((word) => word.endMs)) });
  }
  return takes;
}

/** The take's pauses as silences, in order. */
function silencesOf(pauses: readonly Pause[], words: readonly Word[]): Silence[] {
  const silences: Silence[] = [];
  for (const pause of pauses) {
    const last = silences[silences.length - 1];
    const wordless = last && !words.some((word) => word.startMs < pause.startMs && word.endMs > last.endMs);
    if (last && wordless && pause.startMs - last.endMs <= JOIN_MS) {
      last.pauses.push(pause);
      last.endMs = pause.endMs;
    } else silences.push({ startMs: pause.startMs, endMs: pause.endMs, pauses: [pause] });
  }
  return silences;
}

/* ── the silences across joins and cuts (fix round 3, N1) ─────────────────────────────────────── */

/**
 * A silence holding one or more joins or cuts between shots of its take: shots `first` to `last` in
 * a row, each joined or cut to the next inside the silence's span (a creator's split, `a = b`, or a
 * cut, `a < b`), its edges too.
 */
interface Chain {
  silence: Silence;
  first: number;
  last: number;
}

function chainsOf(edit: Edit, takes: Map<string, Take>): Chain[] {
  const chains: Chain[] = [];
  edit.shots.forEach((shot, i) => {
    const next = edit.shots[i + 1];
    const take = next?.asset === shot.asset ? takes.get(shot.asset) : undefined;
    if (!next || !take || next.startMs < shot.endMs) return;
    const silence = take.silences.find((each) => each.startMs <= shot.endMs && next.startMs <= each.endMs);
    if (!silence) return;
    const before = chains[chains.length - 1];
    if (before && before.silence === silence && before.last === i) before.last = i + 1;
    else chains.push({ silence, first: i, last: i + 1 });
  });
  return chains;
}

/** The sides a chain holds, as "<shot index> start|end": every side at its joins and cuts, and a first start or last end inside its silence. */
function sidesHeld(edit: Edit, chains: Chain[]): Set<string> {
  const held = new Set<string>();
  for (const { silence, first, last } of chains) {
    for (let m = first; m < last; m++) held.add(`${m} end`).add(`${m + 1} start`);
    if (edit.shots[first]!.startMs >= silence.startMs) held.add(`${first} start`);
    if (edit.shots[last]!.endMs <= silence.endMs) held.add(`${last} end`);
  }
  return held;
}

/** The ends a shot has before the removals inside it, and the transients that moved them. */
interface Ends {
  from: number;
  to: number;
  transients: Transient[];
}

/**
 * A chain's one budget (fix round 3, N1): the silence its shots show, less pauseMs. It is spent at
 * its joins and cuts, the one nearest the silence's quietest moment first (the `cutMs` of its longest
 * pause), each as far as its budget, its pauses and the three-frame floors of the shots beside it
 * allow, on the ends planned so far. A side moves only to a moment inside a pause and only outward
 * (no shot gets longer), and a shot left alone in its run does not move. Where nothing fits in the
 * budget and the silence is still shown whole, the smallest move there is goes (what the gap forces).
 */
function spend(edit: Edit, chain: Chain, ends: Ends[], fragile: Set<number>, pauseMs: number): void {
  const { silence, first, last } = chain;
  const shots = edit.shots.slice(first, last + 1);
  const shown = shots.reduce((sum, shot) => sum + overlap(shot.startMs, shot.endMs, silence), 0);
  const budget = Math.round(shown - pauseMs);
  if (budget <= 0) return;
  const quiet = silence.pauses.reduce((longest, pause) => (pause.endMs - pause.startMs > longest.endMs - longest.startMs ? pause : longest)).cutMs;
  const preferred = removalOf(silence, pauseMs)?.lo;
  const junctions = Array.from({ length: last - first }, (_, k) => {
    const m = first + k;
    return { m, a: edit.shots[m]!.endMs, b: edit.shots[m + 1]!.startMs };
  }).sort((x, y) => distanceTo(quiet, x) - distanceTo(quiet, y) || x.m - y.m);

  let spent = 0;
  for (const junction of junctions) {
    if (spent >= budget) break;
    const fits = optionsAt(edit, junction, silence, ends, fragile)
      .filter((option) => option.most >= 1 && option.least <= budget - spent)
      .reduce<{ option: Option; amount: number } | null>((best, option) => {
        const amount = Math.min(budget - spent, option.most);
        return !best || amount > best.amount ? { option, amount } : best;
      }, null);
    if (!fits) continue;
    place(junction, fits.option, fits.amount, preferred, ends);
    spent += fits.amount;
  }
  if (spent > 0 || shown < silence.endMs - silence.startMs) return;
  // Nothing fits in the budget and the silence is shown whole: the smallest move there is (NB1).
  let forced: { junction: (typeof junctions)[number]; option: Option; amount: number } | null = null;
  for (const junction of junctions) {
    for (const option of optionsAt(edit, junction, silence, ends, fragile)) {
      const amount = Math.max(option.least, 1);
      if (option.most >= 1 && (!forced || amount < forced.amount)) forced = { junction, option, amount };
    }
  }
  if (forced) place(forced.junction, forced.option, forced.amount, preferred, ends);
}

/** How far a moment is from a join or a cut [a, b]: 0 inside it. */
const distanceTo = (ms: number, { a, b }: { a: number; b: number }): number => (ms < a ? a - ms : ms > b ? ms - b : 0);

/** One way to move a join or a cut: its left side somewhere in `lo`, its right side somewhere in `hi`, removing `least` to `most` more. */
interface Option {
  lo: [number, number];
  hi: [number, number];
  least: number;
  most: number;
}

/**
 * The ways a join or a cut [a, b) of shots m and m + 1 may move outward: each side to a moment inside
 * a pause of the silence, the left no earlier than three frames after shot m's planned start, the
 * right no later than three frames before shot m + 1's planned end. A shot left alone in its run keeps
 * its side, and then only if that side is already inside a pause.
 */
function optionsAt(edit: Edit, { m, a, b }: { m: number; a: number; b: number }, silence: Silence, ends: Ends[], fragile: Set<number>): Option[] {
  const [left, right] = [edit.shots[m]!, edit.shots[m + 1]!];
  const inPauseAt = (ms: number) => silence.pauses.some((pause) => pause.startMs <= ms && ms < pause.endMs);
  const los: [number, number][] = fragile.has(m)
    ? (inPauseAt(a) ? [[a, a]] : [])
    : silence.pauses.map((pause): [number, number] => [Math.max(pause.startMs, ends[m]!.from + leastMs(left)), Math.min(pause.endMs - 1, a)]).filter(([lo, hi]) => lo <= hi).reverse();
  const his: [number, number][] = fragile.has(m + 1)
    ? (inPauseAt(b) ? [[b, b]] : [])
    : silence.pauses.map((pause): [number, number] => [Math.max(pause.startMs, b), Math.min(pause.endMs - 1, ends[m + 1]!.to - leastMs(right))]).filter(([lo, hi]) => lo <= hi);
  return los.flatMap((lo) => his.map((hi) => ({ lo, hi, least: a - lo[1] + (hi[0] - b), most: a - lo[0] + (hi[1] - b) })));
}

/** Moves a join or a cut by `amount` within an option, its removal as near where the silence's own removal would start as it can be. */
function place({ m, a, b }: { m: number; a: number; b: number }, option: Option, amount: number, preferred: number | undefined, ends: Ends[]): void {
  const length = b - a + amount;
  const [low, high] = [Math.max(option.lo[0], option.hi[0] - length), Math.min(option.lo[1], option.hi[1] - length)];
  const lo = Math.min(high, Math.max(low, preferred ?? a));
  ends[m]!.to = lo;
  ends[m + 1]!.from = lo + length;
}

/* ── one shot ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * A shot's own ends: a side lying in a silence no chain holds keeps half of pauseMs of it, and the
 * film's own start and end follow its words (ruling 2), with the transient guard. Where that would
 * leave the shot under three frames, the film's own end (or start) is trimmed as far as three frames
 * allow (fix round 3, O3); any other trim is not made.
 */
function ownEnds(shot: Shot, take: Take, pauseMs: number, film: { first: boolean; last: boolean }, speech: number | null, held: { start: boolean; end: boolean }): Ends {
  const least = leastMs(shot);
  const keep = Math.floor(pauseMs / 2);
  const { found, silences, firstWord, lastEnd } = take;
  const transients: Transient[] = [];
  const head = silences.find((silence) => holds(silence, shot.startMs, "in"));
  const tail = silences.find((silence) => holds(silence, shot.endMs, "after"));
  if (head && head === tail) return { from: shot.startMs, to: shot.endMs, transients }; // all silence: only a chain moves it
  let from = !held.start && head && head.endMs - shot.startMs > keep ? Math.max(shot.startMs, head.pauses[head.pauses.length - 1]!.startMs, head.endMs - keep) : shot.startMs;
  let to = !held.end && tail && shot.endMs - tail.startMs > keep ? Math.min(shot.endMs, tail.pauses[0]!.endMs - 1, tail.startMs + keep) : shot.endMs;

  // The film's own ends: half of pauseMs from the take's first and last word, unless a loud level is kept there.
  const wordStart = film.first && !held.start && shot.startMs <= firstWord;
  const wordEnd = film.last && !held.end && shot.endMs >= lastEnd;
  if (wordStart) {
    from = Math.max(from, firstWord - keep);
    const loud = transientIn(found, from, firstWord, speech);
    if (loud && from < firstWord - TRANSIENT_EDGE_MS) {
      from = firstWord - TRANSIENT_EDGE_MS;
      transients.push({ shot: shot.id, side: "start", levelMs: loud.ms, lufs: loud.lufs, edgeMs: from });
    }
  }
  if (wordEnd) {
    to = Math.min(to, lastEnd + keep);
    const loud = transientIn(found, lastEnd, to, speech);
    if (loud && to > lastEnd + TRANSIENT_EDGE_MS) {
      to = lastEnd + TRANSIENT_EDGE_MS;
      transients.push({ shot: shot.id, side: "end", levelMs: loud.ms, lufs: loud.lufs, edgeMs: to });
    }
  }
  if (to - from >= least) return { from, to, transients };
  // Too short: at the film's own end (or start), past its last (or before its first) word, as far as three frames allow (O3).
  if (wordEnd && to !== shot.endMs && from + least <= shot.endMs) return { from, to: from + least, transients };
  if (wordStart && from !== shot.startMs && to - least >= shot.startMs) return { from: to - least, to, transients };
  return { from: shot.startMs, to: shot.endMs, transients: [] };
}

/** A removal from a shot: from `lo` up to `hi`, `lo` and `hi` each held inside a pause of its silence. */
interface Removal {
  lo: number;
  hi: number;
  bounds: { lo: [number, number]; hi: [number, number] };
  joined: boolean;
  outcome: "as-is" | "slid" | "shrunk";
}

/**
 * The removals inside a shot, between its ends: each silence it holds whole and longer than pauseMs,
 * in order, each keeping the piece before it three frames long (A2), the last the piece after it too.
 */
function inner(shot: Shot, take: Take, { from, to }: Ends, pauseMs: number): Removal[] {
  const least = leastMs(shot);
  const removals: Removal[] = [];
  let left = from;
  for (const silence of take.silences) {
    if (silence.startMs <= from || silence.endMs >= to) continue; // not whole inside what the shot keeps
    const removal = removalOf(silence, pauseMs);
    if (!removal || (removal.lo < left + least && !keepBefore(removal, left + least))) continue;
    removals.push(removal);
    left = removal.hi;
  }
  const last = removals[removals.length - 1];
  if (last && to - last.hi < least && !keepAfter(last, (removals[removals.length - 2]?.hi ?? from) + least, to - least)) removals.pop();
  return removals;
}

/** How much of a silence goes to leave pauseMs of it: the whole of it less pauseMs, in whole milliseconds. */
const removalLength = (silence: Silence, pauseMs: number): number =>
  silence.pauses.length === 1 ? Math.round(silence.endMs - silence.startMs - pauseMs) : silence.endMs - silence.startMs - Math.round(pauseMs);

/** The stretch a silence longer than pauseMs loses, or null when it is not longer. Where its outer pauses cannot hold pauseMs, the nearest (NB1). */
function removalOf(silence: Silence, pauseMs: number): Removal | null {
  const keep = Math.floor(pauseMs / 2);
  const [first, last] = [silence.pauses[0]!, silence.pauses[silence.pauses.length - 1]!];
  if (silence.endMs - silence.startMs <= pauseMs) return null;
  const bounds = { lo: [first.startMs, first.endMs - 1], hi: [last.startMs, last.endMs - 1] } as Removal["bounds"];
  if (first === last) {
    const r = Math.round(first.endMs - first.startMs - pauseMs);
    if (r <= 0) return null;
    const lo = Math.min(Math.max(Math.round(first.cutMs - r / 2), first.startMs), first.endMs - 1 - r);
    return { lo, hi: lo + r, bounds, joined: false, outcome: "as-is" };
  }
  // From the first pause into the last, keeping half of pauseMs at each end where they hold it. Where the two cannot
  // hold pauseMs, the length nearest it that still starts in the first and ends in the last (fix round 2, NB1).
  const r = removalLength(silence, pauseMs);
  const length = Math.min(last.endMs - 1 - first.startMs, Math.max(last.startMs - (first.endMs - 1), r));
  const lo = Math.min(first.endMs - 1, last.endMs - 1 - length, Math.max(first.startMs, last.startMs - length, first.startMs + keep));
  return { lo, hi: lo + length, bounds, joined: true, outcome: "as-is" };
}

/**
 * Moves a removal to start at `least` or later, sliding it or else shrinking it, inside its bounds.
 * False when it cannot. Shrunk, it spends what the floors and its pauses allow and never more than it
 * would have (O4): its end goes as far as its pause lets it, short of where the slide would put it;
 * stopping at its old end instead would leave budget a second run spends.
 */
function keepBefore(removal: Removal, least: number): boolean {
  const { lo: [loLeast, loMost], hi: [, hiMost] } = removal.bounds;
  const by = least - removal.lo;
  if (removal.lo + by <= loMost && removal.hi + by <= hiMost) {
    Object.assign(removal, { lo: removal.lo + by, hi: removal.hi + by, outcome: "slid" });
    return true;
  }
  const lo = Math.max(loLeast, least);
  if (lo > loMost || lo >= hiMost) return false;
  Object.assign(removal, { lo, hi: hiMost, outcome: "shrunk" });
  return true;
}

/** Moves a removal to end at `most` or earlier while starting at `least` or later, sliding it or else shrinking it. False when it cannot. */
function keepAfter(removal: Removal, least: number, most: number): boolean {
  const { lo: [loLeast, loMost], hi: [hiLeast] } = removal.bounds;
  const by = removal.hi - most;
  if (removal.lo - by >= Math.max(loLeast, least) && most >= hiLeast) {
    Object.assign(removal, { lo: removal.lo - by, hi: most, outcome: removal.outcome === "as-is" ? "slid" : removal.outcome });
    return true;
  }
  const lo = Math.max(loLeast, least);
  if (most < hiLeast || lo > loMost || lo >= most) return false;
  Object.assign(removal, { lo, hi: most, outcome: "shrunk" });
  return true;
}

/**
 * The film's speech median: the median of the levels above silence, of the takes its shots show,
 * whose moment lies in a word and in a shot's stretch. Null when there are none.
 */
function speechMedian(edit: Edit, analyses: Analyses): number | null {
  const levels = edit.shots.flatMap((shot) => {
    const asset = assetOf(edit, shot.asset);
    const loudness = asset?.kind === "video" ? analysisFor(analyses, asset.id)?.loudness : null;
    if (asset?.kind !== "video" || !loudness) return [];
    const said = (ms: number) => (asset.words ?? []).some((word) => word.startMs <= ms && ms < word.endMs);
    return loudness.levels.filter((level) => level.lufs > SILENCE_LUFS && shot.startMs <= level.ms && level.ms < shot.endMs && said(level.ms)).map((level) => level.lufs);
  });
  if (levels.length === 0) return null;
  const sorted = levels.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** The loudest level whose moment lies in `[from, to)` and is more than 12 LU above the speech median; null when none (M1: the word's own levels never count). */
function transientIn(found: TakeAnalysis, from: number, to: number, speech: number | null): { ms: number; lufs: number } | null {
  if (speech === null || !found.loudness || to <= from) return null;
  const loud = found.loudness.levels.filter((level) => from <= level.ms && level.ms < to && level.lufs > speech + TRANSIENT_LU);
  return loud.reduce<{ ms: number; lufs: number } | null>((max, level) => (!max || level.lufs > max.lufs ? level : max), null);
}

/** A shot's operations: its new ends, then each removal as a split and a trim, with new ids for the pieces; and its counts. */
function emit(shot: Shot, { from, to, transients }: Ends, removals: Removal[], used: Set<string>, done: Tightened): void {
  done.transients.push(...transients);
  for (const removal of removals) {
    if (removal.outcome === "slid") done.slid++;
    if (removal.outcome === "shrunk") done.shrunk++;
    if (removal.joined) done.joined++;
  }
  if (from !== shot.startMs || to !== shot.endMs) {
    done.ops.push({ op: "shot.trim", id: shot.id, ...(from !== shot.startMs && { startMs: from }), ...(to !== shot.endMs && { endMs: to }) });
  }
  let piece = shot.id;
  for (const removal of removals) {
    const newId = freshId(shot.id, used);
    done.ops.push({ op: "shot.split", id: piece, atMs: removal.lo, newId }, { op: "shot.trim", id: newId, startMs: removal.hi });
    piece = newId;
  }
}

/** Every id the edit uses: its files, shots, marks and items. An id names one thing (`checkEdit`). */
function idsOf(edit: Edit): Set<string> {
  return new Set([...edit.assets.map((asset) => asset.id), ...edit.shots.flatMap((shot) => [shot.id, ...shot.marks.map((mark) => mark.id)]), ...edit.items.map((item) => item.id)]);
}

/** `<base>-t<n>` for the first n not in use, the base cut short where the id would pass 40 characters. Marked as used. */
function freshId(base: string, used: Set<string>): string {
  for (let n = 1; ; n++) {
    const suffix = `-t${n}`;
    const id = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    if (!used.has(id) && IdSchema.safeParse(id).success) {
      used.add(id);
      return id;
    }
  }
}

/** A take's analysis, by its asset id; undefined when there is none. */
export function analysisFor(analyses: Analyses, asset: string): TakeAnalysis | undefined {
  return Object.hasOwn(analyses, asset) ? analyses[asset] : undefined;
}

/** Whether a moment lies in a pause, as `review` reads one: from its start up to, not including, its end. */
export function inPause(pauses: readonly Pause[], ms: number): boolean {
  return pauses.some((pause) => pause.startMs <= ms && ms < pause.endMs);
}
