/**
 * probe-emit-card.ts — Task 7 verification against REAL data, not a stub.
 *
 * Proves the whole emit boundary end to end: pull a real `outlier_teardowns` row id, hand the model's
 * shape of tool arguments to `handleEmitCard`, and confirm the server-materialized receipt lands on
 * `props.receipts` while a model-authored handle does not. Also checks a nonexistent row id degrades
 * to a card with no receipt rather than a placeholder (spec §5).
 *
 * Run: `npx tsx scripts/probe-emit-card.ts`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { handleEmitCard } = await import("@/lib/tools/emit-card-tool");
  const { getCorpusClient } = await import("@/lib/grounding/corpus");

  const supabase = getCorpusClient();
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .select("id, creator_handle, outlier_multiplier, baseline_label")
    .not("creator_handle", "is", null)
    .limit(1);

  if (error || !data?.length) {
    console.error("could not read a teardown row:", error?.message ?? "no rows");
    process.exit(1);
  }
  const row = data[0] as { id: string; creator_handle: string | null };
  console.log(`real row: ${row.id} (@${row.creator_handle})\n`);

  const teardownCard = (refId: string) => ({
    cards: [
      {
        recipe: "teardown",
        deliverable: { kind: "claim", text: "The confession opening is what carried this." },
        receiptRef: refId,
        body: [
          { kind: "proof_strip", receiptRefs: [refId] },
          {
            kind: "beats",
            items: [
              { label: "Hook", text: "Names the loss out loud." },
              { label: "Turn", text: "Shows the receipt on screen." },
            ],
          },
        ],
        // What a model must never be able to publish:
        handle: "@fabricated",
        receipts: { [refId]: { handle: "@fabricated", multiplier: 900 } },
      },
    ],
  });

  const real = await handleEmitCard(teardownCard(row.id));
  console.log("── real row id ──");
  console.log("blocks:", real.blocks.length, "error:", real.error ?? "none");
  console.log("receipts:", JSON.stringify(real.blocks[0]?.props.receipts, null, 2));
  console.log("fabricated handle anywhere in the block:", JSON.stringify(real.blocks).includes("fabricated"));

  const ghost = await handleEmitCard(teardownCard("00000000-0000-0000-0000-000000000000"));
  console.log("\n── nonexistent row id ──");
  console.log("blocks:", ghost.blocks.length, "error:", ghost.error ?? "none");
  console.log("receipts:", ghost.blocks[0]?.props.receipts ?? "(none — card renders without it)");

  const doubleEncoded = await handleEmitCard({ cards: JSON.stringify(teardownCard(row.id).cards) });
  console.log("\n── `cards` arriving as a JSON string (spike failure 2) ──");
  console.log("blocks:", doubleEncoded.blocks.length, "error:", doubleEncoded.error ?? "none");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
