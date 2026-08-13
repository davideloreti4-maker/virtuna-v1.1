/**
 * mint-auth-state.mjs — a signed-in Playwright storageState, without the login UI.
 *
 * `e2e/auth.setup.ts` CANNOT work here: the login page is emailed-code-first and its
 * "sign in with a password instead" button never hydrates in dev. So POST the Supabase auth REST
 * endpoint directly and write the chunked cookie @supabase/ssr expects.
 *
 * Reads .env.local itself, so credentials never pass through a terminal or a transcript.
 * ⚠️ Writes .scratch/auth-state.json — a REAL session for a REAL prod account. Never track it.
 *
 *   node scripts/mint-auth-state.mjs http://localhost:3015
 */
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = env.E2E_USER_EMAIL || "e2e-test@virtuna.local";
const PASSWORD = env.E2E_USER_PASSWORD || "e2e-test-password-2026";

if (!URL_ || !ANON) {
  console.error("MISSING: NEXT_PUBLIC_SUPABASE_URL or the anon/publishable key in .env.local");
  console.error("keys present:", Object.keys(env).filter((k) => k.includes("SUPABASE")).join(", "));
  process.exit(1);
}

const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

if (!res.ok) {
  console.error(`AUTH FAILED ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

const session = await res.json();
const projectRef = new URL(URL_).hostname.split(".")[0];
const raw = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");

// @supabase/ssr 0.8 chunks at 3180 chars into .0, .1, …
const CHUNK = 3180;
const cookies = [];
if (raw.length <= CHUNK) {
  cookies.push({ name: `sb-${projectRef}-auth-token`, value: raw });
} else {
  for (let i = 0, n = 0; i < raw.length; i += CHUNK, n += 1) {
    cookies.push({ name: `sb-${projectRef}-auth-token.${n}`, value: raw.slice(i, i + CHUNK) });
  }
}

const base = new URL(process.argv[2] || "http://localhost:3015");
writeFileSync(
  ".scratch/auth-state.json",
  JSON.stringify(
    {
      cookies: cookies.map((c) => ({
        ...c,
        domain: base.hostname,
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: base.protocol === "https:",
        sameSite: "Lax",
      })),
      origins: [],
    },
    null,
    2,
  ),
);

console.log(`OK  user=${session.user?.email}  chunks=${cookies.length}  raw=${raw.length} chars`);
console.log(`wrote .scratch/auth-state.json for ${base.origin}`);
