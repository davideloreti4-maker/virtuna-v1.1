/**
 * review.real.test.ts — `review` on the owner's own take: its first edit, read against the analysis the worker
 * made of it (worker batch, Scribe). The analysis is in `.scratch/` (git-ignored); without it, this skips.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analysisOf } from "../analysis";
import { review } from "../review";
import { assetOf, firstEdit, type TakeRow } from "../worker/takes";

const FILE = fileURLToPath(new URL("../../../../.scratch/worker-proof/batch/analysis-scribe.json", import.meta.url));

/** The take's row as the worker writes it (worker/store.py): the facts with the length, the words, and the rest of the analysis beside the copies' keys. */
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

describe("review on the owner's take", () => {
  it.skipIf(!existsSync(FILE))("finds no cut outside a pause and footage on frame 0 in the take's first edit", () => {
    const row = rowOf(JSON.parse(readFileSync(FILE, "utf8")));
    const asset = assetOf(row, "edit-media");
    const edit = firstEdit(asset);
    const findings = review(edit, { [asset.id]: analysisOf(row) });
    console.log(`the take: ${asset.kind === "video" ? `${asset.ms} ms, ${asset.w}x${asset.h}, ${asset.words?.length ?? 0} words` : asset.kind}; ${findings.length} findings`);
    for (const finding of findings) console.log(`  ${finding.severity.padEnd(5)} ${finding.code.padEnd(17)} ${JSON.stringify(finding.where)}  ${finding.says}`);
    expect(findings.filter((finding) => finding.code === "cut-outside-pause")).toEqual([]);
    expect(findings.filter((finding) => finding.code === "empty-start")).toEqual([]);
    expect(review(edit, { [asset.id]: analysisOf(row) })).toEqual(findings);
  });
});
