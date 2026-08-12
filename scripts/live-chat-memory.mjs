/**
 * live-chat-memory.mjs — does the thread REMEMBER? Measured live, on the real route.
 *
 * The chat agent is supposed to carry the whole conversation: `openChatPriorTurns` walks the
 * persisted thread and hands the loop every past turn, with each skill run attached to the turn that
 * announced it. This drives a real multi-turn conversation through `/api/tools/chat` and checks
 * whether facts stated in EARLIER turns survive into later ones.
 *
 * COSTS NOTHING in credits: every ask is conversational, so no generator is dispatched and no paid
 * pipeline runs. (It does spend chat model tokens — chat itself is free by decision.)
 *
 *   npm run dev -- --port 3005
 *   node --env-file=.env.local scripts/live-chat-memory.mjs
 *
 * Each probe turn declares the FACTS it must recall. A miss is reported with the answer, because
 * "it forgot" and "it answered a different question" look identical in a pass/fail count.
 */

const BASE = process.env.LIVE_BASE ?? "http://localhost:3005";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const CHUNK = 3180;

/**
 * The conversation. `recall` lists strings the answer MUST contain (case-insensitive) — the facts
 * that were only ever stated in an earlier turn, so the model can produce them only by having read
 * the transcript. A turn with no `recall` is a setup turn.
 */
const SCRIPT = [
  { ask: "My app is called PennyWise. It's for UK university students, and the one thing it does is stop food-delivery overspending. Got that?" },
  { ask: "I also want you to know my audience is mostly first-years who live in halls." },
  { ask: "What is my app called?", recall: ["pennywise"] },
  { ask: "Remind me who the audience is and what the app actually does.", recall: ["first-year", "halls", "delivery"] },
  { ask: "Given everything I've told you so far, what angle should I lead with? Name the app and the audience in your answer.", recall: ["pennywise", "first-year"] },
];

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

async function turn(cookie, ask, activeThread) {
  const jar = activeThread ? `${cookie}; maven_active_thread=${activeThread}` : cookie;
  const res = await fetch(`${BASE}/api/tools/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: jar },
    body: JSON.stringify({ ask, platform: "tiktok" }),
  });
  if (!res.ok) throw new Error(`POST ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const out = { dispatch: null, blocks: [], text: "", error: null };
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
      if (ev === "dispatch") out.dispatch = d.skill;
      else if (ev === "block") out.blocks.push(d.block?.type);
      else if (ev === "token") out.text += d.delta;
      else if (ev === "error") out.error = d.message;
      else if (ev === "credit-wall") out.error = "CREDIT WALL";
    }
  }
  return out;
}

async function newestThread(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/threads?user_id=eq.${userId}&type=eq.open&order=updated_at.desc&limit=1&select=id,title`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
  );
  return (await res.json())[0];
}

/** How many messages the thread actually holds — the anchor's raw material. */
async function messageCount(threadId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/messages?thread_id=eq.${threadId}&select=id,role,created_at&order=created_at.asc`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
  );
  return (await res.json()).length;
}

async function main() {
  const session = await signIn();
  const cookie = authCookie(session);
  console.log(`signed in as ${session.user.email}\nbase ${BASE}\n`);

  let thread = "__new__";
  let threadId = null;
  let passes = 0;
  let checks = 0;

  for (const [i, step] of SCRIPT.entries()) {
    const r = await turn(cookie, step.ask, thread);
    if (i === 0) {
      // The first send creates the thread; pin every later turn to it explicitly so this can
      // never silently drift onto a different thread and call that a memory failure.
      const t = await newestThread(session.user.id);
      threadId = t.id;
      thread = t.id;
      console.log(`→ thread ${threadId} ("${t.title ?? ""}")\n`);
    }

    const lower = r.text.toLowerCase();
    const missing = (step.recall ?? []).filter((f) => !lower.includes(f.toLowerCase()));
    const found = (step.recall ?? []).filter((f) => lower.includes(f.toLowerCase()));
    if (step.recall) {
      checks++;
      if (missing.length === 0) passes++;
    }

    console.log(`── turn ${i + 1}: "${step.ask.slice(0, 80)}${step.ask.length > 80 ? "…" : ""}"`);
    if (step.recall) {
      console.log(
        `   RECALL ${missing.length === 0 ? "PASS" : "FAIL"}  found=[${found.join(",")}]  missing=[${missing.join(",")}]`,
      );
    }
    console.log(
      `   dispatch=${r.dispatch ?? "NONE"}  cards=${r.blocks.filter((b) => b && b.endsWith("-card")).length}` +
        `${r.error ? `  ERROR=${r.error}` : ""}`,
    );
    console.log(`   text: ${JSON.stringify(r.text.replace(/\s+/g, " ").trim().slice(0, 320))}\n`);
  }

  console.log(`thread ${threadId} now holds ${await messageCount(threadId)} message rows`);
  console.log(`\nRESULT: recall ${passes}/${checks}`);
  console.log(passes === checks ? "PASS — the thread remembers" : "FAIL — context is being lost");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
