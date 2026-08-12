/**
 * probe-proof-strip-roundtrip.ts — the D7 loop, end to end, against live retrieval.
 *
 * The claim `EMIT_CARD_TOOL` makes to the model is "use teardown row ids that search_corpus
 * actually returned". This proves that sentence is true: run a real corpus search, take an id out
 * of the JSON the model would read, hand it to `handleEmitCard`, and confirm a server-materialized
 * receipt comes back. Also runs the search with ids OFF to confirm a grounded turn without composed
 * cards is unchanged.
 *
 * Run: `npx tsx scripts/probe-proof-strip-roundtrip.ts`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { executeCorpusSearch } = await import("@/lib/grounding/corpus-tool");
  const { retrieveCachedExamples } = await import("@/lib/grounding/retrieve");
  const { handleEmitCard } = await import("@/lib/tools/emit-card-tool");

  const query = "saving money on food delivery";

  const off = await executeCorpusSearch({ query }, "tiktok", 1, retrieveCachedExamples);
  const offRows = JSON.parse(off.content).results ?? [];
  console.log(`ids OFF — rows: ${offRows.length}, any row carrying an id: ${offRows.some((r: { id?: string }) => r.id)}`);

  const on = await executeCorpusSearch({ query }, "tiktok", 1, retrieveCachedExamples, {
    includeRowIds: true,
  });
  const payload = JSON.parse(on.content);
  const rows = (payload.results ?? []) as Array<{ id?: string; creator?: string | null; multiplier?: string | null }>;
  console.log(`ids ON  — rows: ${rows.length}, carrying an id: ${rows.filter((r) => r.id).length}`);
  console.log(`note ends with: …${String(payload.note).slice(-120)}`);

  const ids = rows.map((r) => r.id).filter((id): id is string => !!id).slice(0, 3);
  if (ids.length === 0) {
    console.error("\nFAIL: retrieval returned no usable row ids — proof_strip is still unreachable.");
    process.exit(1);
  }
  console.log(`\nrows the model would see: ${rows.slice(0, 3).map((r) => `${r.creator} ${r.multiplier ?? "(no number)"}`).join(" | ")}`);

  // Exactly what the model would send back, using ids it was actually given.
  const emitted = await handleEmitCard({
    cards: [
      {
        recipe: "teardown",
        deliverable: { kind: "claim", text: "The confession opening is what carried this." },
        receiptRef: ids[0],
        body: [
          { kind: "proof_strip", receiptRefs: ids },
          {
            kind: "beats",
            items: [
              { label: "Hook", text: "Names the loss out loud." },
              { label: "Turn", text: "Shows the receipt on screen." },
            ],
          },
        ],
      },
    ],
  });

  const receipts = emitted.blocks[0]?.props.receipts ?? {};
  console.log(`\nemit_card → blocks: ${emitted.blocks.length}, error: ${emitted.error ?? "none"}`);
  console.log(`receipts materialized: ${Object.keys(receipts).length} of ${ids.length} ids`);
  for (const [id, p] of Object.entries(receipts)) {
    const num = p.multiplier === null ? "no number (below the band or no basis)" : `${p.multiplier}× ${p.baselineLabel}`;
    console.log(`  ${id.slice(0, 8)}… @${p.handle} · ${num} · ${p.views?.toLocaleString() ?? "?"} views`);
  }

  if (Object.keys(receipts).length === 0) {
    console.error("\nFAIL: ids came back from search but resolved to no receipt.");
    process.exit(1);
  }
  console.log("\nPASS: a search_corpus id round-trips into a server-materialized receipt.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
