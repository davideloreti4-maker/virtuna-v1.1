/**
 * recipes.real.test.ts — the recipes on the owner's own take: its first edit tightened at 200 ms, its captions
 * placed and its shots levelled, read against the analysis the worker made of it (worker batch, Scribe). The
 * analysis is in `.scratch/` (git-ignored); without it, this skips.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analysisOf, type Analyses } from "../../analysis";
import { layout } from "../../derive";
import type { Edit } from "../../doc";
import { applyOps, type Op } from "../../ops";
import { review } from "../../review";
import { assetOf, firstEdit, type TakeRow } from "../../worker/takes";
import { levelled, levelVoice, placeCaptions, punched, tightened } from "..";

const FILE = fileURLToPath(new URL("../../../../../.scratch/worker-proof/batch/analysis-scribe.json", import.meta.url));

/** The take's row as the worker writes it (worker/store.py), as in review.real.test.ts. */
function rowOf(found: Record<string, unknown> & { facts: object; ms: number; words: unknown; files: Record<string, string> }): TakeRow {
  const { facts, ms, words, files, ...rest } = found;
  const key = (name: string) => `u/owner/takes/take/${name}`;
  return {
    id: "take", user_id: "owner", status: "ready", name: "take.mp4", bytes: 1, source_path: key("source"),
    facts: { ...facts, ms }, words: words as TakeRow["words"],
    analysis: { files: { full: key(files.full ?? "full.mp4"), preview: key(files.preview ?? "preview.mp4"), poster: key(files.poster ?? "poster.jpg") }, ...rest } as TakeRow["analysis"],
    error: null, created_at: "2026-11-21T00:00:00.000Z", updated_at: "2026-11-21T00:00:00.000Z",
  };
}

function through(edit: Edit, ops: Op[]): Edit {
  if (ops.length === 0) return edit;
  const made = applyOps(edit, ops, edit.assets);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
}
const seconds = (edit: Edit) => `${layout(edit).frames} frames (${(layout(edit).frames / 30).toFixed(2)} s)`;
const shots = (edit: Edit) => edit.shots.map((shot) => `${shot.id} ${shot.startMs}-${shot.endMs}${shot.volume !== 1 ? ` vol ${shot.volume}` : ""}${shot.framing.from.zoom !== 1 ? ` zoom ${shot.framing.from.zoom} x ${shot.framing.from.x.toFixed(3)} y ${shot.framing.from.y.toFixed(3)}` : ""}`).join(", ");
function show(name: string, edit: Edit, given: Analyses): void {
  const findings = review(edit, given);
  console.log(`${name}: ${seconds(edit)}; captions at y ${edit.captions.y}; ${findings.length} findings\n  shots: ${shots(edit)}`);
  for (const finding of findings) console.log(`  ${finding.severity.padEnd(5)} ${finding.code.padEnd(17)} ${JSON.stringify(finding.where)}  ${finding.says}`);
}

describe.skipIf(!existsSync(FILE))("the recipes on the owner's take", () => {
  const row = existsSync(FILE) ? rowOf(JSON.parse(readFileSync(FILE, "utf8"))) : null;
  const asset = row ? assetOf(row, "edit-media") : null;
  const given: Analyses = row && asset ? { [asset.id]: analysisOf(row) } : {};

  it("tightens its first edit at 200 ms, places its captions and levels it, with no errors", () => {
    const first = firstEdit(asset!);
    const tight = tightened(first, given, { pauseMs: 200 });
    const cut = through(first, tight.ops);
    const placed = through(cut, placeCaptions(cut, given));
    const level = levelled(placed, given);
    console.log(`levelVoice: ${level.ops.length} ops, ${level.rounds} rounds, ${level.settled}`);
    expect(level.settled).toBe("stable");
    const levelledEdit = through(placed, level.ops);
    show("first edit", first, given);
    console.log(`tighten: ${tight.ops.length} ops, ${tight.joined} joined, ${tight.slid} slid, ${tight.shrunk} shrunk, ${tight.leftAlone} left alone, ${tight.runsLeftAlone} runs left alone, transients ${JSON.stringify(tight.transients)}`);
    show("tightened, placed, levelled", levelledEdit, given);
    expect(review(levelledEdit, given).filter((finding) => finding.severity === "error")).toEqual([]);
    expect(levelledEdit.captions.y).toBeGreaterThanOrEqual(0.75);
    expect(levelledEdit.captions.y).toBeLessThanOrEqual(0.76);
    expect(levelledEdit.shots[levelledEdit.shots.length - 1]!.endMs).toBe(12_254); // 100 ms after the last word, before the knock (round 0, ruling 2)
    expect(tight.joined).toBe(1); // the pauses either side of the click, as one silence (round 0, ruling 1)
    expect(levelVoice(levelledEdit, given)).toEqual([]);
  });

  it("with punch-ins before the captions are placed (perMin 6, zoom 1.15): no errors either", () => {
    const first = firstEdit(asset!);
    const cut = through(first, tightened(first, given, { pauseMs: 200 }).ops);
    const punch = punched(cut, given, { perMin: 6, zoom: 1.15 });
    const punchedEdit = through(cut, punch.ops);
    const placed = through(punchedEdit, placeCaptions(punchedEdit, given));
    const final = through(placed, levelVoice(placed, given));
    console.log(`punchIns: ${punch.ops.length} punched, ${punch.dropped} dropped`);
    show("tightened, punched, placed, levelled", final, given);
    expect(review(final, given).filter((finding) => finding.severity === "error")).toEqual([]);
    // Each recipe run again on the result changes nothing (fix round 1).
    expect([tightened(final, given, { pauseMs: 200 }).ops, punched(final, given, { perMin: 6, zoom: 1.15 }).ops, placeCaptions(final, given), levelVoice(final, given)]).toEqual([[], [], [], []]);
  });
});
