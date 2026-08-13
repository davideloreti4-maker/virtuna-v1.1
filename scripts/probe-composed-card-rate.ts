/**
 * probe-composed-card-rate.ts — how often does a composed card actually reach a creator?
 *
 * The lane's other instruments all stop short of production:
 *   · `spike-slot-composer.ts` has its own SYSTEM prompt (documented).
 *   · `probe-thinking-stream.ts` is called "the end-to-end check", but it passes its own one-line
 *     `systemPrompt: "You are Maven, a strategist for short-form video creators."` and
 *     `context: { profileRow: null, audience: null }`. The route passes `KC_CHAT_SYSTEM_PROMPT`
 *     (25,268 chars) and a real creator's profile + calibrated audience. So the same caveat the
 *     spike carries applies to the end-to-end probe too, one level up.
 *
 * This one POSTs the REAL route as a REAL signed-in user and counts blocks off the SSE stream.
 * Nothing between it and what a creator sees except the React renderer.
 *
 * ── MEASURED 2026-08-12, COMPOSED_CARDS=true, dev, same six asks, back to back ──
 *     run 1: 1/6      run 2: 4/6      run 3: 2/6      → 7/18 ≈ 39%
 * Do NOT quote any of those alone. DashScope does not pin on a seed, and a 1/6-to-4/6 spread on an
 * IDENTICAL ask set is the same trap the spike write-up warns about — a prompt or contract change
 * cannot be judged against a single run of this script. Sample repeatedly and compare RATES.
 *
 * For scale, the same contract measured further from production scored much higher: the spike
 * harness 6/6, 5/6, 6/6 and `probe-thinking-stream.ts` 5/5. Both use their own short prompt and no
 * creator context. Whether that gap is real or just this sampler's variance is NOT settled here —
 * it needs many more samples per configuration than any run so far has paid for.
 *
 * ⚠️ SEPARATE DEFECT, seen on every run: ask 4 ("explain the structure of a story-time video")
 * streamed 20,742 / 33,165 / 18,484 chars of prose. That is a wall of text on a creator's screen,
 * consistent across runs rather than noise, and it is NOT a composed-card problem — it reproduces
 * on turns that compose nothing. Worth its own investigation.
 *
 * ── TWO INSTRUMENT TRAPS, both paid for ──
 *  1. `emit_card` fires in a LATER round than the prose. A browser poll that waits for the answer
 *     to stop growing and then declares "prose only" reports 0/N against a surface that is in fact
 *     composing cards. Wait for the stream to CLOSE, never for the text to settle.
 *  2. Without the `maven_active_thread=__new__` cookie, `/home` rehydrates the newest open thread
 *     and appends. Several single-ask runs then pile into one thread, and counting cards per
 *     thread double-counts across runs. One POST per ask avoids the whole problem.
 *
 * Needs: a dev server on PORT with COMPOSED_CARDS=true, and a signed-in storageState JSON
 * (see memory `signed-in-verification-recipe` — the login UI cannot be driven in dev).
 *
 * Run: `AUTH_STATE=/path/to/auth-state.json npx tsx scripts/probe-composed-card-rate.ts`
 */
import { readFileSync } from "fs";

const PORT = process.env.PORT ?? "3000";
const AUTH_STATE = process.env.AUTH_STATE;

const ASKS = [
  "compare posting daily against posting three times a week for a brand new account",
  "break down why this format works: a morning routine narrated like a nature documentary",
  "what makes an ending actually land on a short video?",
  "explain the structure of a story-time video, start to finish",
  "confession opening versus question opening — which holds attention longer, and why?",
  "greenscreen vs talking head for explaining a technical product — which works better?",
];

interface TurnResult {
  prose: number;
  cards: number;
  blocks: string[];
}

async function runAsk(text: string, cookie: string): Promise<TurnResult | { error: number }> {
  const res = await fetch(`http://localhost:${PORT}/api/tools/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ ask: text, platform: "tiktok" }),
  });
  if (!res.ok || !res.body) return { error: res.status };

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let prose = 0;
  const blocks: string[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(raw);
      } catch {
        continue;
      }
      if (typeof ev.token === "string") prose += ev.token.length;
      if (typeof ev.delta === "string") prose += ev.delta.length;
      const block = ev.block as { type?: string } | undefined;
      if (block?.type) blocks.push(block.type);
    }
  }
  return { prose, cards: blocks.filter((b) => b === "composed-card").length, blocks };
}

async function main() {
  if (!AUTH_STATE) {
    console.error("set AUTH_STATE=/path/to/auth-state.json (a Playwright storageState with the sb-* cookie)");
    process.exit(1);
  }
  const state = JSON.parse(readFileSync(AUTH_STATE, "utf8")) as {
    cookies: Array<{ name: string; value: string }>;
  };
  const cookie = state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  let withCard = 0;
  for (let i = 0; i < ASKS.length; i++) {
    const r = await runAsk(ASKS[i]!, cookie);
    if ("error" in r) {
      console.log(`${i + 1}. HTTP ${r.error}`);
      continue;
    }
    if (r.cards > 0) withCard++;
    const verdict = r.cards > 0 ? `CARD x${r.cards}` : "prose only";
    console.log(
      `${i + 1}. ${verdict.padEnd(11)} prose=${String(r.prose).padStart(6)}  ` +
        `blocks=[${r.blocks.join(",") || "-"}]  "${ASKS[i]!.slice(0, 46)}"`,
    );
  }

  console.log(`\n=== ${withCard}/${ASKS.length} asks produced a composed card through the real route ===`);
  console.log("One run is not a result. Compare rates across several.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
