/**
 * live-chat-turn.mjs — drive the real /api/tools/chat SSE route as a signed-in user.
 *
 * The only way to verify chat dispatch end-to-end. Playwright cannot do it: `e2e/auth.setup.ts`
 * aside, the login page is code-first and the app's ambient animations never settle. So this mints a
 * session against the Supabase auth REST endpoint, writes the chunked cookie by hand, and reads the
 * SSE frames directly.
 *
 * ⚠️ SPENDS REAL CREDITS on a REAL PROD account (E2E_USER_EMAIL). One hooks run per turn.
 *
 *   node --env-file=.env.local scripts/live-chat-turn.mjs                        # the §4 sequence
 *   node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<ask>" # one turn, existing thread
 *   node --env-file=.env.local scripts/live-chat-turn.mjs one <threadId> "<prompt>" hooks   # as a CHIP
 *
 * The 4th argument is the generator a tapped follow-up chip DECLARES (chat-followups.ts `skill`) —
 * exactly what the client sends when the creator presses "More hooks". Omit it to send the message
 * the way a typed ask arrives, with no pin.
 *
 * Needs a dev server: `npm run dev -- --port 3005` (override with LIVE_BASE).
 * ⚠️ `next dev` buffers stdout when not a TTY — its log stays 0 bytes while it serves fine. Probe it
 * with a request to decide whether it is up; do not tail the log.
 */

const BASE = process.env.LIVE_BASE ?? "http://localhost:3005";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = new URL(SUPABASE_URL).hostname.split(".")[0];
/** Supabase splits the auth cookie at this width; the server rejoins `.0`, `.1`, … in order. */
const CHUNK = 3180;

const SEED_ASK = "i launched a budgeting app for students. give me hooks for it";
const SECOND_ASK = "give me hooks for my student budgeting app that stops food delivery overspending";

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in ${res.status}: ${await res.text()}`);
  return res.json();
}

function authCookie(session) {
  const raw = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const parts = [];
  for (let i = 0; i < raw.length; i += CHUNK) parts.push(raw.slice(i, i + CHUNK));
  return parts.map((p, i) => `sb-${REF}-auth-token.${i}=${p}`).join("; ");
}

/**
 * One chat turn. `activeThread` is the `maven_active_thread` pointer the client normally sets —
 * pass a thread id to continue that thread, or `__new__` to force a fresh one.
 * Note: no Origin header, so csrfGuard's cross-origin check passes; Content-Type must be exact.
 */
async function turn(cookie, ask, activeThread, skill) {
  const jar = activeThread ? `${cookie}; maven_active_thread=${activeThread}` : cookie;
  const res = await fetch(`${BASE}/api/tools/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: jar },
    // `skill` rides only when a CHIP was tapped — omitted entirely for a typed ask, so this stays
    // the exact body the route has always received on the conversational path.
    body: JSON.stringify({ ask, platform: "tiktok", ...(skill ? { skill } : {}) }),
  });
  if (!res.ok) throw new Error(`POST ${res.status}: ${await res.text()}`);

  const t0 = Date.now();
  const out = { dispatch: null, blocks: [], stages: [], evidence: 0, text: "", error: null, ms: 0 };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const f of frames) {
      const ev = /event: (.+)/.exec(f)?.[1];
      const data = /data: (.+)/.exec(f)?.[1];
      if (!ev || !data) continue;
      const d = JSON.parse(data);
      if (ev === "dispatch") {
        out.dispatch = d.skill;
        console.log(`   +${((Date.now() - t0) / 1000).toFixed(1)}s  dispatch → ${d.skill}`);
      } else if (ev === "block") out.blocks.push(d.block?.type);
      else if (ev === "stage") { if (d.status === "active") out.stages.push(d.name); }
      else if (ev === "evidence") out.evidence++;
      else if (ev === "token") out.text += d.delta;
      else if (ev === "error") out.error = d.message;
      else if (ev === "credit-wall") out.error = "CREDIT WALL";
    }
  }
  out.ms = Date.now() - t0;
  return out;
}

async function newestThread(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/threads?user_id=eq.${userId}&type=eq.open&order=updated_at.desc&limit=1&select=id,title`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
  );
  return (await res.json())[0];
}

function report(label, r) {
  const cards = r.blocks.filter((b) => b && b.endsWith("-card"));
  console.log(
    `   ${label}: dispatch=${r.dispatch ?? "NONE"}  cards=${cards.length} [${[...new Set(cards)].join(",")}]  ` +
      `stages=${r.stages.length}  evidence=${r.evidence}  ${(r.ms / 1000).toFixed(1)}s${r.error ? `  ERROR=${r.error}` : ""}`,
  );
  console.log(`   text: "${r.text.replace(/\s+/g, " ").trim().slice(0, 180)}"`);
  return { dispatched: !!r.dispatch, cards: cards.length };
}

async function one(threadId, ask, skill) {
  const cookie = authCookie(await signIn());
  console.log(`── ONE TURN in thread ${threadId} — "${ask}"${skill ? `  [chip declares ${skill}]` : ""}`);
  const { dispatched, cards } = report("turn", await turn(cookie, ask, threadId, skill));
  console.log(`\nRESULT: ${dispatched && cards > 0 ? "PASS" : "FAIL"}`);
}

async function main() {
  if (process.argv[2] === "one") return one(process.argv[3], process.argv[4], process.argv[5]);

  const session = await signIn();
  const cookie = authCookie(session);
  console.log(`signed in as ${session.user.email} (${session.user.id})\nbase ${BASE}\n`);

  console.log(`── TURN 1 (fresh thread) — seed: "${SEED_ASK}"`);
  const a = report("turn 1", await turn(cookie, SEED_ASK, "__new__"));

  const thread = await newestThread(session.user.id);
  console.log(`   → thread ${thread.id} ("${thread.title}")\n`);

  // THE TEST: a generation ask in a thread that already contains a "…are on screen" closing line.
  console.log(`── TURN 2 (SAME thread) — "${SECOND_ASK}"`);
  const t2 = await turn(cookie, SECOND_ASK, thread.id);
  const b = report("turn 2", t2);

  console.log(
    `\nRESULT: ${b.dispatched && b.cards > 0 ? "PASS" : "FAIL"} — the second ask in the same thread ` +
      `${b.dispatched ? `dispatched ${t2.dispatch} and rendered ${b.cards} cards` : "dispatched NOTHING"}` +
      `  (turn 1: dispatch=${a.dispatched}, ${a.cards} cards)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
