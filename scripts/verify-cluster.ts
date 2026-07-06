/** THROWAWAY verify harness (Phase B). Runs clusterPillarsForUser on the seeded
 * account, then reads back content_pillars + per-pillar post counts. Delete after. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const envText = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const USER_ID = "31c5a91c-31e1-45fd-ae67-e75c21a49df1";

async function main() {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const { clusterPillarsForUser } = await import("@/lib/content-pillars/cluster");
  const supabase = createServiceClient();

  console.log("clustering…");
  const result = await clusterPillarsForUser(supabase, USER_ID);
  console.log("result:", result);

  const db = supabase as unknown as { from: (t: string) => any };
  const { data: pillars } = await db
    .from("content_pillars")
    .select("id, name, sort_order")
    .eq("user_id", USER_ID)
    .order("sort_order");

  console.log("\ncontent_pillars:");
  for (const p of pillars ?? []) {
    const { count } = await db
      .from("account_posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", USER_ID)
      .eq("pillar_id", p.id);
    // one example caption
    const { data: sample } = await db
      .from("account_posts")
      .select("caption")
      .eq("user_id", USER_ID)
      .eq("pillar_id", p.id)
      .limit(1);
    console.log(
      `  • ${p.name}  (${count} posts)  e.g. "${((sample?.[0]?.caption as string) || "").slice(0, 50)}"`,
    );
  }

  const { count: unassigned } = await db
    .from("account_posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", USER_ID)
    .is("pillar_id", null);
  console.log(`\nunassigned posts: ${unassigned}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
