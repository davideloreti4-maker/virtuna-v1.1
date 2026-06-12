# Phase 3: Honesty Moat, Gallery, Proof & Conversion - Research

**Researched:** 2026-06-12
**Domain:** Next.js 16 App Router landing sections + Supabase waitlist capture (anon insert / aggregate-count read) + asset pipeline
**Confidence:** HIGH (all 5 high-priority targets verified against the actual repo, not training data)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** CTA is a REAL email waitlist form that records the signup to Supabase — NOT a link-out. Supabase infra exists in-repo, reachable via anon key.
- **D-02:** Minimal: single `email` field → Next.js server action (mirror `src/app/(onboarding)/signup/actions.ts`, `createClient` from `@/lib/supabase/server`) → insert into NET-NEW `waitlist` table. New migration + RLS (insert-only anon, no public select) + `database.types.ts` regen required. Columns: `email` (unique), `created_at`, `source` ("landing-hero" vs "landing-footer-cta"). Honeypot + email validation. Graceful duplicate-email handling (treat as success, don't leak existence). No auth, no confirmation email this phase.
- **D-03:** CTA repeated near footer (`#cta` slot); Phase 2 hero CTA already scroll-anchors to `#cta`. Both entry points feed one waitlist, distinguished by `source`.
- **D-04:** kero-style 2-column comparison — Numen (band + one-line why) vs UNNAMED generic "virality-score tools" tier. Do NOT name real rivals.
- **D-05:** Rival column may surface the fake-precision pattern ("95% accuracy!", "viral score") as the thing Numen rejects — the ONE place those strings appear, never as a Numen claim. Numen column stays VOICE-clean. Tasteful contrast, not a teardown.
- **D-06:** Build gallery structurally complete now against real-shaped placeholder stills across ≥3 niches. Final rights-cleared asset set deferred to Phase 4 (D-L4).
- **D-07:** Placeholder stills sourced by extracting keyframes from short videos the user supplies (ffmpeg frame extract → cwebp). Reuse `public/images/landing/hero/keyframe.webp` as one niche; ask user for ~2 more. If none supplied, vary the available still — NON-BLOCKING checkpoint, not a gate.
- **D-08:** Live waitlist count is the PRIMARY proof. Testimonial cards built as a component but placeholder-ready (real quotes only at D-L4 / launch).
- **D-09 (honesty guard):** Show the waitlist number only above a sensible threshold; if tiny/zero, show a qualitative anchor instead — never "0 creators". Threshold + copy register = Claude's discretion but MUST obey VOICE.
- **D-10 (placement, PROOF-02):** Credibility anchored early via a thin strip (count + optional niche tags) near top (under hero / around `#how-it-works`), with the fuller proof block in `#proof`. Two surfaces, one source.
- **D-11:** Positioning copy reads "an honest verdict creators can believe," explicitly not hype, confident-mentor voice. Every string passes VOICE self-check.
- **Carried forward (locked):** consume `.numen-surface` tokens + `numen/` primitives (never fork); verdict reuses `VerdictThrone`/`VerdictSwatch` (band + why, never a naked number, no `bg-${verdict}` interpolation); `StageBlock`/`numen-ease-calm` is THE motion, reduced-motion = static opacity, NO scroll-reveal choreography (Phase 4); single h1 (hero owns it; each slot passes `heading=` → its own h2); every word obeys VOICE.md Rules 1–3.

### Claude's Discretion
- Component file split under `src/components/numen-landing/` (`honesty-comparison.tsx`, `reading-gallery.tsx`, `social-proof.tsx`, `waitlist-form.tsx`, `cta-section.tsx`, shared count/card subcomponents).
- Exact `waitlist` schema beyond D-02 columns (indexes, constraints), RLS policy shape, where live count is read (server component vs cached).
- Waitlist-count display threshold (D-09) + qualitative-anchor copy.
- Comparison-table row contents + whether true `<table>` or 2-col grid (must stay accessible + VOICE-clean).
- Gallery layout (grid/masonry/row), card count beyond 3, niche labels.
- Exact positioning/section copy (must pass VOICE).
- Spam/abuse hardening depth (honeypot is the floor; rate-limit optional).

### Deferred Ideas (OUT OF SCOPE)
- Final rights-cleared ≥3-niche gallery asset set + real testimonial quotes (D-L4) → Phase 4 / launch.
- Double opt-in / confirmation email → post-MVP.
- Use cases / personas section (§4.5) → post-MVP.
- Named-rival comparison → rejected (legal/positioning); generic tier only.
- App deep-linking / app entry routing → not this milestone.
- Final token swap (D-L3), scroll-reveal choreography (MOT-01), LCP/OG/a11y polish (PERF-01/03) → Phase 4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRUST-01 | Trust section contrasting Numen's honest verdict vs the "virality score" tier | §Architecture Pattern 1 (2-col comparison, true `<table>`); reuse `VerdictThrone`/`VerdictSwatch`; D-05 rival-column strings sanctioned only here |
| TRUST-02 | Comparison framing (kero), zero "X% accuracy" anywhere on the page | Voice gate test (§Validation) extends `voice.test.tsx` ban list; rival strings live in a scoped component the gate can allowlist |
| GALLERY-01 | Gallery of real Readings across ≥3 niches | §Target 4 ffmpeg→cwebp pipeline; reuse `keyframe.webp` + 2 supplied; `VerdictSwatch` range (good/mixed/bad) for honest breadth |
| GALLERY-02 | Gallery items render as content centerpieces (luma), not feature diagrams | `Surface` plates + `next/image` stills; no glass-over-photo (Lightning CSS) |
| PROOF-01 | Social-proof block (testimonials and/or live waitlist count) | §Targets 1+3 count RPC read; testimonial component placeholder-ready (D-08) |
| PROOF-02 | Credibility anchored early | §Target 3 single cached read serving thin strip + `#proof` block (D-10) |
| CONTENT-02 | Positioning reads "honest verdict creators can believe," not hype | VOICE.md + extend voice gate to new components |
| CTA-02 | CTA records the signup | §Targets 1+2: server action + `waitlist` insert; honeypot; dup-as-success |
</phase_requirements>

## Summary

This phase is mostly a known quantity: the repo already contains every pattern the four sections need. The hard parts are concentrated in the Supabase waitlist (CTA-02 / PROOF-01), and the repo already solved the exact same class of problem — `compute_niche_percentiles` (`supabase/migrations/20260531000001_…` / `…002_…`) is a `SECURITY DEFINER` aggregate RPC that returns counts/stats from a table whose rows RLS hides from the caller. The waitlist count read is that pattern, simplified to a single `count(*)`.

Tooling is all present and verified: `ffmpeg 8.0.1`, `cwebp 1.6.0`, `supabase 2.105.0` CLI, `node 22.22.3`. A service-role client (`src/lib/supabase/service.ts`) AND a `SUPABASE_SERVICE_ROLE_KEY` env slot already exist, so the count read has two viable paths. The page (`src/app/(marketing)/page.tsx`) is currently 100% static (heading-only slots, no data) — adding a Supabase read makes it dynamic unless cached, so the recommended count read uses `unstable_cache` with a short `revalidate` to keep the page near-static and avoid querying on every request while serving BOTH the early strip and the `#proof` block from one source.

**Primary recommendation:** Add a `waitlist` table with anon-INSERT-only RLS + a `SECURITY DEFINER` `waitlist_count()` RPC (granted to `anon`). The server action mirrors `signup/actions.ts` (anon `createClient` from `@/lib/supabase/server`), inserts, and maps unique-violation `23505` to success. The count is read once via `unstable_cache(() => supabase.rpc('waitlist_count'), ['waitlist-count'], { revalidate: 60 })` and passed to both the early strip and `#proof`. Gallery ships on `keyframe.webp` + ffmpeg-extracted stills (commands below). Extend `voice.test.tsx` to cover the four new components, with the rival-strings component scanned separately.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Waitlist email insert | API / Backend (server action) | — | Mutation with secrets — must be server-only (`"use server"`); never a client Supabase write |
| Waitlist count read | Frontend Server (RSC) | Database (RPC) | RSC reads at request/build time via cached RPC; count aggregation owned by Postgres `SECURITY DEFINER` fn (RLS-safe) |
| RLS / count privacy | Database | — | `count(*)` over RLS-hidden rows is a DB concern; solved by `SECURITY DEFINER` |
| Comparison / gallery / proof rendering | Frontend Server (RSC) | Browser (form only) | All four sections are static RSC; only the email form needs `"use client"` (useActionState) |
| Form interactivity (pending/error/success) | Browser | API (server action) | `useActionState` + `useFormStatus` are client; submit dispatches the server action |
| Keyframe still extraction | Build-time / local (one-off script) | — | ffmpeg→cwebp run by a human/agent locally; output committed to `public/` |

## Standard Stack

### Core (all already installed — verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.5 | App Router, server actions, RSC, `next/image`, `unstable_cache` | Already the framework [VERIFIED: package.json] |
| @supabase/ssr | ^0.8.0 | Cookie-aware server client (`createServerClient`) | Used by `src/lib/supabase/server.ts` [VERIFIED: repo] |
| @supabase/supabase-js | ^2.93.1 | Service-role client + `.rpc()` / `.from().insert()` | Used by `service.ts` [VERIFIED: repo] |
| supabase (CLI) | ^2.74.5 (installed 2.105.0) | migrations, `gen types` | dep + on PATH [VERIFIED: `supabase --version`] |
| tailwind-variants | ^3.2.2 | `tv()` component variants | Kit convention (D-08) [VERIFIED: repo] |
| tailwindcss | ^4 | CSS-first styling, `.numen-surface` tokens | Project standard [VERIFIED: repo] |

### Supporting (in-repo primitives to consume — DO NOT fork)
| Component | Path | Purpose | When to Use |
|-----------|------|---------|-------------|
| `VerdictThrone` | `src/components/numen-landing/verdict-throne.tsx` | band + one-line why | Gallery cards, comparison Numen column |
| `VerdictSwatch` | `src/components/numen/verdict-swatch.tsx` | good/mixed/bad bands (literal classes) | Gallery range (honest breadth), comparison |
| `Surface` | `src/components/numen/surface.tsx` | opaque hairline plate, no glass | All cards (gallery, testimonial, comparison) — APCA-safe |
| `PillChip` | `src/components/numen/pill-chip.tsx` | warm-neutral chip | Niche tags on strip / gallery |
| `StageBlock` | `src/components/numen/stage-reveal.tsx` | reduced-motion-safe reveal | Any reveal (NO new scroll choreography) |
| `SectionShell` | `src/components/numen-landing/section-shell.tsx` | slot wrapper, emits the h2 | The four slots already mounted |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `SECURITY DEFINER` count RPC (anon) | service-role count in RSC | Both valid (see Target 1). RPC wins: smaller blast radius, no service key on the read path, mirrors the in-repo `compute_niche_percentiles` precedent |
| Server action | API route | Repo convention is server actions for mutations (`signup/actions.ts`); no reason to diverge |
| `unstable_cache` | `export const revalidate` on page | Page-level revalidate makes the WHOLE page ISR; `unstable_cache` scopes caching to just the count read, keeps the rest static |

**Installation:** None — every dependency is already present.

**Version verification:** `next@16.1.5`, `@supabase/ssr@0.8.0`, `@supabase/supabase-js@2.93.1`, `tailwind-variants@3.2.2` all confirmed in `package.json`; `ffmpeg 8.0.1`, `cwebp 1.6.0`, `supabase 2.105.0`, `node v22.22.3` confirmed on PATH [VERIFIED: repo + shell].

## Package Legitimacy Audit

Not applicable — this phase installs ZERO new packages. All capabilities use dependencies already in `package.json` and binaries already on the machine. No registry verification needed.

---

## HIGH-PRIORITY TARGET 1 — Supabase RLS insert-only + aggregate-count read (CTA-02 / PROOF-01)

### The footgun, resolved
You need: anon can INSERT into `waitlist`, anon CANNOT SELECT rows (no email harvesting), yet PROOF needs a live `count(*)`. With RLS on and no SELECT policy, `select count(*)` from the anon client returns **0** (rows are invisible to the aggregate). **The repo already solved this exact pattern**: `compute_niche_percentiles` (`supabase/migrations/20260531000001_niche_percentiles_rpc.sql`) is a `SECURITY DEFINER` function returning aggregate-only stats over a table the caller's RLS would otherwise hide. [VERIFIED: codebase]

### RECOMMENDATION — Option (a): `SECURITY DEFINER` count RPC, granted to `anon`

Migration file: `supabase/migrations/20260612000000_waitlist.sql` (timestamp > latest `20260531000001`).

```sql
-- =====================================================
-- WAITLIST (landing email capture, CTA-02)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT NOT NULL DEFAULT 'landing',  -- 'landing-hero' | 'landing-footer-cta'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: constrain source to known attribution values (keeps data clean)
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_source_check
  CHECK (source IN ('landing-hero', 'landing-footer-cta', 'landing'));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- INSERT-ONLY for anon: anyone may add themselves, no other policy exists
-- so SELECT/UPDATE/DELETE are implicitly denied to anon (RLS default-deny).
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Aggregate-count read that bypasses RLS safely: returns ONLY a bigint count,
-- never any row/email. Mirrors compute_niche_percentiles (SECURITY DEFINER,
-- aggregate-only). search_path pinned per Supabase linter guidance.
CREATE OR REPLACE FUNCTION public.waitlist_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.waitlist;
$$;

-- Default EXECUTE is granted to PUBLIC, but be explicit (and revoke nothing else):
GRANT EXECUTE ON FUNCTION public.waitlist_count() TO anon, authenticated;
```

**Why insert-only is safe without a SELECT policy:** RLS is default-deny. With only an INSERT policy, anon `select` returns zero rows and the table's emails are never readable from the anon key. The `WITH CHECK (true)` permits any insert; the `UNIQUE(email)` + `23505` mapping (Target 2) prevents enumeration leaks. [CITED: supabase.com/docs — RLS default-deny; VERIFIED against in-repo `referral_clicks` insert-only pattern]

**The read call** (from an RSC, anon client is fine because the RPC runs as definer):
```ts
const supabase = await createClient();              // @/lib/supabase/server
const { data, error } = await supabase.rpc("waitlist_count");
const count = typeof data === "number" ? data : 0;  // RETURNS BIGINT → number
```

### Alternative — Option (b): service-role count in RSC
The repo HAS `createServiceClient()` (`src/lib/supabase/service.ts`) and a `SUPABASE_SERVICE_ROLE_KEY` slot (`.env.example`). A service-role `select count(*)` bypasses RLS too:
```ts
import { createServiceClient } from "@/lib/supabase/service";
const svc = createServiceClient();
const { count } = await svc.from("waitlist").select("*", { count: "exact", head: true });
```
**Rejected as primary** because: (1) it puts the service key on the read path (larger blast radius if the read is ever miswired into a client bundle — `service.ts` warns "NEVER import in client components"); (2) it requires the landing deploy to carry `SUPABASE_SERVICE_ROLE_KEY`, whereas the RPC path needs only the anon key the landing already has. The RPC is the smaller, in-repo-precedented surface. **Keep Option (b) as the documented fallback** if the landing deploy environment can't add the RPC for any reason.

### Files the planner references
- `supabase/migrations/20260531000001_niche_percentiles_rpc.sql` — the SECURITY DEFINER precedent to mirror
- `supabase/migrations/20260213140000_referral_tables.sql` — RLS enable + policy idiom
- `supabase/migrations/20260216000000_referral_clicks_insert_policy.sql` — insert-only policy idiom
- `src/lib/supabase/server.ts` (anon RSC client), `src/lib/supabase/service.ts` (fallback)

---

## HIGH-PRIORITY TARGET 2 — Next.js server action waitlist insert

### RECOMMENDATION
File: `src/app/(marketing)/actions.ts` (route-group-local; the form lives in `(marketing)`).

```ts
"use server";

import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WaitlistState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  // Honeypot: a hidden field bots fill, humans never. Silent success on trip.
  if ((formData.get("company") as string)?.trim()) {
    return { status: "success" };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const source =
    (formData.get("source") as string) === "landing-hero"
      ? "landing-hero"
      : "landing-footer-cta";

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").insert({ email, source });

  if (error) {
    // 23505 = unique_violation → already on the list. Treat as success;
    // never reveal the email already exists (no enumeration leak, D-02).
    if (error.code === "23505") return { status: "success" };
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  return { status: "success" };
}
```

**Pattern provenance:** mirrors `src/app/(onboarding)/signup/actions.ts` — `"use server"`, `createClient` from `@/lib/supabase/server`, `formData.get(...)`, error mapping. The signup action `redirect()`s; the waitlist action instead **returns state** so the form can show inline success/error via `useActionState` (no navigation away from the landing). [VERIFIED: signup/actions.ts read]

**Client form (`waitlist-form.tsx`, `"use client"`):**
```tsx
"use client";
import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/(marketing)/actions";

export function WaitlistForm({ source }: { source: "landing-hero" | "landing-footer-cta" }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlist,
    { status: "idle" },
  );
  return (
    <form action={action}>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot — visually hidden, aria-hidden, tabIndex -1, autocomplete off */}
      <input
        type="text" name="company" tabIndex={-1} autoComplete="off"
        aria-hidden="true" className="sr-only" />
      <input
        type="email" name="email" required autoComplete="email"
        placeholder="you@example.com" disabled={pending} />
      <button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Join the waitlist"}
      </button>
      {state.status === "success" && <p role="status">You're on the list.</p>}
      {state.status === "error" && <p role="alert">{state.message}</p>}
    </form>
  );
}
```

**Notes for the planner:**
- The `.rpc` typing and `.from("waitlist")` typing both REQUIRE `database.types.ts` to be regenerated first (Target 5) — otherwise TS errors on the unknown table/function. Sequence the migration + regen BEFORE wiring the action.
- `source` is constrained server-side (only two literals accepted) so a tampered hidden field can't write arbitrary values; the DB `CHECK` is the backstop.
- VOICE applies to button label + success/error copy ("Join the waitlist", "You're on the list." — second person, plain, no hype).

### Files the planner references
- `src/app/(onboarding)/signup/actions.ts`, `src/lib/supabase/server.ts`

---

## HIGH-PRIORITY TARGET 3 — Live-count read placement (D-10), one source, two surfaces

### Current state
`page.tsx` is fully static (no data fetch). Adding a Supabase read in the RSC makes the route dynamic on every request unless cached. The page must NOT query Supabase twice (early strip + `#proof`).

### RECOMMENDATION — `unstable_cache`, read once in `page.tsx`, pass down as a prop

`src/lib/waitlist-count.ts`:
```ts
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 60s cache: count is "social proof", not a transaction — staleness is fine and
// keeps the landing near-static (one Supabase round-trip per minute, not per hit).
export const getWaitlistCount = unstable_cache(
  async (): Promise<number> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("waitlist_count");
    if (error || typeof data !== "number") return 0;
    return data;
  },
  ["waitlist-count"],
  { revalidate: 60, tags: ["waitlist-count"] },
);
```

`page.tsx` (now `async`):
```tsx
export default async function HomePage() {
  const waitlistCount = await getWaitlistCount();   // ← single read
  return (
    <>
      <SectionShell id="hero" ...><Hero /></SectionShell>
      {/* D-10 early strip — under hero / around how-it-works */}
      <ProofStrip count={waitlistCount} />
      <SectionShell id="how-it-works" heading="How the Reading works"><HowItWorks /></SectionShell>
      <SectionShell id="honesty" ...><HonestyComparison /></SectionShell>
      <SectionShell id="gallery" ...><ReadingGallery /></SectionShell>
      {/* D-10 fuller block — same count, no second query */}
      <SectionShell id="proof" ...><SocialProof count={waitlistCount} /></SectionShell>
      <SectionShell id="cta" ...><CtaSection /></SectionShell>
    </>
  );
}
```

**Why this shape:**
- `unstable_cache` scopes caching to the count read only — the rest of the page stays statically rendered. [CITED: nextjs.org docs — unstable_cache for DB queries]
- One `await` at the top → both `ProofStrip` and `SocialProof` receive the same number. Zero double-query.
- `revalidate: 60` is the recommended default for a vanity count; the planner may pick 30–300s. `tags: ["waitlist-count"]` lets a future post-submit `revalidateTag("waitlist-count")` refresh it after a signup (optional, not required this phase).
- D-09 threshold logic lives in the presentational component, not the read: `count >= THRESHOLD ? \`${count} creators on the list\` : <qualitative anchor>`. Never render "0 creators".

**Caching caveat to flag:** if the planner instead reads inside a component that also touches `cookies()`/`headers()`, that opts the page into dynamic rendering. The `unstable_cache` wrapper above does NOT — `createClient()` reads cookies, but wrapping the call in `unstable_cache` memoizes the result and decouples it from the per-request dynamic scope. Keep the read behind the cache wrapper; do not call `createClient()` directly in the page body for the count.

### Files the planner references
- `src/app/(marketing)/page.tsx` (make `async`, thread the prop)

---

## HIGH-PRIORITY TARGET 4 — ffmpeg → cwebp keyframe pipeline (D-07 / GALLERY)

### Verified environment
`ffmpeg 8.0.1` and `cwebp 1.6.0` are on PATH. The Phase 2 still exists: `public/images/landing/hero/keyframe.webp` — **RIFF WebP, VP8, 720×1280** (portrait, vertical-video aspect). [VERIFIED: `file` output] No committed extraction script was found, so the planner should document the commands inline in the "extract still" task.

### RECOMMENDATION — reproducible 2-step extract (matches the existing 720×1280 still)

Output dir (net-new): `public/images/landing/gallery/`.

```bash
mkdir -p public/images/landing/gallery

# Step 1 — pull ONE representative frame as a lossless PNG.
# -ss seeks to a strong frame (tune per clip); -frames:v 1 grabs exactly one.
ffmpeg -ss 00:00:01.5 -i "/path/to/niche-clip.mp4" \
  -frames:v 1 -q:v 2 /tmp/gallery-frame.png -y

# Step 2 — convert to WebP, matching the hero still's 720px portrait scale.
# -resize 720 0 keeps aspect (0 = auto height); -q 82 ≈ hero file size (~74KB).
cwebp -q 82 -resize 720 0 /tmp/gallery-frame.png \
  -o public/images/landing/gallery/niche-comedy.webp
```

Repeat per niche (e.g. `niche-comedy.webp`, `niche-fitness.webp`, `niche-cooking.webp`).
Reuse `hero/keyframe.webp` as the first niche so ≥3 niches ship even with only 2 new clips.

**Single-command variant** (ffmpeg can emit WebP directly, skipping cwebp — but cwebp gives finer size control to match the existing still):
```bash
ffmpeg -ss 00:00:01.5 -i clip.mp4 -frames:v 1 -vf "scale=720:-1" -c:v libwebp -q:v 82 \
  public/images/landing/gallery/niche-comedy.webp -y
```

**Non-blocking handling (D-07):** if the user supplies no clips, vary `keyframe.webp` across the ≥3 cards (different crop/label) and emit a `checkpoint:human-verify` so the user can drop real distinct-niche clips later. The gallery layout/copy must NOT block on assets — it's token- and asset-independent structure.

**Image rendering:** import the still and pass to `next/image` inside a `Surface` plate (NOT glass-over-photo — Lightning CSS strips `backdrop-filter`; CLAUDE.md). The vitest static-image stub already returns `{ src, height:1280, width:720 }` so gallery component tests render without real files.

### Files the planner references
- `public/images/landing/hero/keyframe.webp` (the niche-1 reuse + the 720×1280 target spec)
- `vitest.config.ts` (`staticImageStub` — image imports already mocked for tests)

---

## HIGH-PRIORITY TARGET 5 — Migration + database.types.ts regen workflow

### Verified facts
- Migrations live in `supabase/migrations/`, named `YYYYMMDDHHMMSS_description.sql`. Latest is `20260531000001_niche_percentiles_rpc.sql`. The waitlist migration must sort AFTER it: use `20260612000000_waitlist.sql`. [VERIFIED: `ls` migrations]
- `supabase/config.toml` has `project_id = "virtuna-v1.1"`, `major_version = 17`. No `supabase/.temp/` → the worktree is NOT locally linked; the project is managed remotely (Supabase MCP server is available in this environment per session tools). [VERIFIED: repo]
- `src/types/database.types.ts` is the generated SSOT (already contains `Functions: { compute_niche_percentiles: … }` — confirms generated types include RPCs). It MUST be regenerated after the migration so `.from("waitlist")` and `.rpc("waitlist_count")` type-check. [VERIFIED: grep]
- `supabase` CLI 2.105.0 is on PATH; no `gen types` npm script exists yet.

### RECOMMENDATION — apply migration, then regenerate types

**Apply the migration.** Two valid paths; pick based on what the executing agent has wired:

1. **Supabase MCP** (available this session): `apply_migration` with name `waitlist` and the Target-1 SQL. Preferred when not locally linked — goes straight to the remote project. [CITED: supabase MCP tool docs]
2. **Supabase CLI** (if a `SUPABASE_ACCESS_TOKEN` + linked project): `supabase db push` after dropping the file in `supabase/migrations/`.

**Regenerate `database.types.ts`** (CLI, project-id form — works without local link, needs access token):
```bash
supabase gen types typescript --project-id virtuna-v1.1 --schema public \
  > src/types/database.types.ts
```
Or via MCP: `generate_typescript_types` then overwrite `src/types/database.types.ts`.

**Sequencing (hard ordering for the planner):**
1. Write + apply `20260612000000_waitlist.sql` (table + RLS + RPC + grant).
2. Regenerate `src/types/database.types.ts`.
3. Verify the new types include `waitlist` (Tables) and `waitlist_count` (Functions). `grep -n 'waitlist' src/types/database.types.ts`.
4. ONLY THEN wire the server action + count read (they won't type-check before step 2).

**Add a convenience script** (Claude's discretion, recommended) to `package.json`:
```json
"db:types": "supabase gen types typescript --project-id virtuna-v1.1 --schema public > src/types/database.types.ts"
```

### Files the planner references
- `supabase/migrations/` (naming), `supabase/config.toml` (`project_id`), `src/types/database.types.ts` (regen target)

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────── page.tsx (RSC, async) ──────────────────────────┐
                         │                                                                              │
  getWaitlistCount() ────┤  unstable_cache(rpc waitlist_count, revalidate 60)                           │
   (one read)            │        │                                                                     │
                         │        ├──► <ProofStrip count>      (D-10 early, under hero)                 │
                         │        └──► <SocialProof count>     (#proof block, lower)                    │
                         │                                                                              │
  static RSC sections ───┤  <HonestyComparison>  <ReadingGallery>  <CtaSection/WaitlistForm…>           │
                         └──────────────────────────────────────────────────────────────────────────┘
                                                          │ (form submit)
                                                          ▼
   Browser  ──form action──►  joinWaitlist() "use server"  ──insert──►  Postgres waitlist (RLS: anon INSERT only)
            (useActionState)        │  23505 → success (no leak)                     ▲
                                    └──────────────────────────────────────────────┘
                                                          ▲
   waitlist_count() SECURITY DEFINER  ──count(*)──────────┘  (RLS bypassed safely, count-only)

   ffmpeg ─frame─► PNG ─cwebp─► public/images/landing/gallery/*.webp ──next/image──► <ReadingGallery> (Surface plates)
```

### Recommended Project Structure (net-new files — Claude's discretion split)
```
src/
├── app/(marketing)/
│   ├── page.tsx                    # make async, read count once, thread prop (EDIT)
│   └── actions.ts                  # "use server" joinWaitlist (NEW)
├── components/numen-landing/
│   ├── honesty-comparison.tsx      # TRUST — 2-col <table>, Numen vs rival tier (NEW)
│   ├── reading-gallery.tsx         # GALLERY — Surface+next/image+VerdictSwatch (NEW)
│   ├── social-proof.tsx            # PROOF — count block + placeholder testimonials (NEW)
│   ├── proof-strip.tsx             # PROOF — D-10 early thin strip (NEW)
│   ├── waitlist-form.tsx           # "use client" useActionState form (NEW)
│   └── cta-section.tsx             # CTA wrapper hosting WaitlistForm (NEW)
├── lib/
│   └── waitlist-count.ts           # unstable_cache RPC read (NEW)
├── types/database.types.ts         # REGENERATE after migration (EDIT via gen)
└── ...
supabase/migrations/
└── 20260612000000_waitlist.sql     # table + RLS + waitlist_count() RPC + grant (NEW)
public/images/landing/gallery/      # extracted stills (NEW dir)
```

### Pattern 1: kero 2-column comparison — true `<table>` (accessibility)
**What:** Numen column (band + one-line why via `VerdictSwatch`/`VerdictThrone`) vs unnamed "virality-score tools" column (the sanctioned home of "viral score / 95% accuracy" rejection strings, D-05).
**When to use:** TRUST section.
**Recommendation:** Use a semantic `<table>` with `<caption class="sr-only">`, `<th scope="col">` for the two columns and `<th scope="row">` for each dimension row. A 2-col CSS grid is acceptable visually but a real `<table>` gives screen readers the row/column relationship for free and is the more accessible default for tabular comparison. Each row = a dimension ("What it gives you", "When it's honest", "What it won't promise"). Numen cells stay VOICE-clean (band + why); rival cells carry the rejected pattern as a labelled category, tasteful, not a teardown.
```tsx
<table>
  <caption className="sr-only">Numen compared to virality-score tools</caption>
  <thead><tr><th scope="col">{/* dimension */}</th><th scope="col">Numen</th><th scope="col">Virality-score tools</th></tr></thead>
  <tbody>
    <tr><th scope="row">What you get</th><td>{/* band + why, VerdictSwatch */}</td><td>{/* "a viral score" — rejected */}</td></tr>
  </tbody>
</table>
```

### Pattern 2: Gallery honest-breadth — verdict RANGE, not all "good"
**What:** Cards show good / mixed / bad bands across niches (`VerdictSwatch verdict="mixed"`/`"bad"`), absorbing Phase 2's deferred "rotating multi-niche verdicts" idea. Honesty by breadth — the gallery proves the verdict isn't always flattering.
**Example:** each card = `Surface` plate → `next/image` still (720×1280) → `VerdictSwatch` band + one-line why + `PillChip` niche tag.

### Pattern 3: D-09 threshold guard (count display)
```tsx
const THRESHOLD = 50; // Claude's discretion
{count >= THRESHOLD
  ? <p>{count.toLocaleString()} creators already on the list.</p>
  : <p>Be among the first creators to read your content honestly.</p>}
```
Never "0 creators". The qualitative anchor must pass VOICE (no fake precision, no inflated promise).

### Anti-Patterns to Avoid
- **`bg-${verdict}` interpolation:** Tailwind v4 cannot see dynamic strings — literal classes only (they live in `VerdictSwatch`). [VERIFIED: verdict-swatch.tsx comment]
- **Glass-over-photo on gallery/proof cards:** Lightning CSS strips `backdrop-filter`. Use opaque `Surface` plates. [VERIFIED: CLAUDE.md + verdict-throne plate decision]
- **Client-side Supabase write for the waitlist:** the insert must be the server action; never `createBrowserClient().from("waitlist").insert()` (would require a client-exposed write path).
- **`select count(*)` from the anon client:** returns 0 under insert-only RLS — use the `waitlist_count()` RPC.
- **Calling `createClient()` directly in the page body for the count:** opts the page into dynamic rendering. Wrap in `unstable_cache`.
- **Scroll-reveal choreography:** Phase 4 (MOT-01). Use only `StageBlock` static reveals here.
- **A second `<h1>`:** hero owns the only h1; every slot passes `heading=` → h2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Count over RLS-hidden rows | Custom service-role fetch + manual key plumbing | `SECURITY DEFINER waitlist_count()` RPC | In-repo precedent (`compute_niche_percentiles`), smaller blast radius, anon-key-only |
| Form pending/error/success state | `useState` + manual fetch | `useActionState` + server action | Native React 19/Next 16 form primitive; progressive-enhancement free |
| Verdict band styling | New colored div | `VerdictSwatch` / `VerdictThrone` | APCA-gated, literal-class, DS-locked (DS-01) |
| Card plate | New glass component | `Surface` | APCA-safe, no backdrop-filter footgun |
| Duplicate-email handling | SELECT-then-INSERT check | `UNIQUE` + map `23505` → success | One round-trip, no enumeration leak, no race |
| DB types | Hand-written interfaces | `supabase gen types` | SSOT regen; hand-written drifts |
| Niche tag chip | New chip | `PillChip` | Kit primitive |

**Key insight:** every "hard" part of this phase already has a verified in-repo precedent. The risk is divergence (inventing a parallel pattern), not missing capability.

## Runtime State Inventory

This is a net-new feature phase (adding a table + sections), not a rename/refactor. The only persistent runtime state introduced is the new `waitlist` table itself.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | NEW `waitlist` table (created this phase) | migration creates it; no pre-existing data to migrate |
| Live service config | Supabase project `virtuna-v1.1` (remote; not locally linked) | apply migration via MCP `apply_migration` or CLI push |
| OS-registered state | None — verified no scheduler/cron touches landing | none |
| Secrets/env vars | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` required for landing deploy; `SUPABASE_SERVICE_ROLE_KEY` only if Option (b) fallback used | confirm anon URL+key present in the landing deploy env (flag for launch) |
| Build artifacts | `src/types/database.types.ts` becomes stale after migration | regenerate (Target 5) |

## Common Pitfalls

### Pitfall 1: Anon `count(*)` silently returns 0
**What goes wrong:** PROOF shows "0 creators" forever; RLS hides rows from the aggregate.
**Why:** RLS default-deny + insert-only policy → SELECT (incl. count) sees nothing.
**How to avoid:** read the count via `waitlist_count()` SECURITY DEFINER RPC, never `from().select(count)` on anon.
**Warning sign:** count is always 0 despite inserts succeeding.

### Pitfall 2: Type errors after migration before regen
**What goes wrong:** `.from("waitlist")` / `.rpc("waitlist_count")` fail TS — table/function unknown.
**Why:** `database.types.ts` not regenerated.
**How to avoid:** regen types (Target 5 step 2) BEFORE wiring action/read; verify with `grep waitlist src/types/database.types.ts`.
**Warning sign:** `Argument of type '"waitlist"' is not assignable…`.

### Pitfall 3: Page goes fully dynamic / queries Supabase on every hit
**What goes wrong:** landing loses static rendering, hammers Supabase.
**Why:** direct `createClient()` read in page body, or page-level `export const revalidate`.
**How to avoid:** `unstable_cache(..., { revalidate: 60 })`; read once, prop-thread.

### Pitfall 4: Email enumeration via the form
**What goes wrong:** "this email already exists" reveals who's on the list.
**Why:** surfacing the `23505` as a distinct error.
**How to avoid:** map `23505` → `{ status: "success" }`; identical UX for new and dup.

### Pitfall 5: A banned token leaks into the voice gate
**What goes wrong:** the TRUST rival column intentionally contains "viral score" / "accuracy" — the page-wide `voice.test.tsx` ban list would flag it as a violation.
**Why:** D-05 sanctions those strings in exactly one component; the global gate doesn't know that.
**How to avoid:** keep rival strings inside a single component (`honesty-comparison.tsx`) and have the voice gate scan the OTHER new components for the ban list, while asserting the rival strings are present-but-labelled in the comparison (a positive assertion, not the negative ban scan). See Validation.

## Code Examples

(See Targets 1–5 and Patterns 1–3 above — all examples are verified against in-repo precedents: `signup/actions.ts`, `compute_niche_percentiles`, `verdict-swatch.tsx`, `surface.tsx`, `voice.test.tsx`.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Form `useState` + `fetch` to API route | `useActionState` + server action | React 19 / Next 13.4+ | Less code, progressive enhancement; repo already uses server actions |
| `count` over RLS rows from client | `SECURITY DEFINER` aggregate RPC | Supabase standard | Privacy-preserving counts; in-repo precedent |
| `unstable_noStore` for opt-out | `unstable_cache` for opt-IN scoped caching | Next 14+ | Cache the count, keep page static |

**Deprecated/outdated:** none affecting this phase. `unstable_cache` remains the supported App-Router DB-cache primitive in Next 16.1.5 [CITED: nextjs.org docs].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Migration applies via Supabase MCP `apply_migration` (project not locally linked) | Target 5 | Low — CLI `db push` is the documented fallback; either way the SQL is identical |
| A2 | Landing deploy env carries `NEXT_PUBLIC_SUPABASE_URL` + anon key | Runtime Inventory | Medium — if the landing deploys separately without these, the count read + insert both fail; flag as a launch checklist item (CONTEXT D-01 notes "reachable via anon key even though the landing may deploy separately") |
| A3 | `revalidate: 60` is an acceptable count staleness window | Target 3 | Low — purely a tuning value, Claude's discretion (30–300s) |
| A4 | Default EXECUTE grant + explicit `GRANT … TO anon` exposes the RPC to the anon role | Target 1 | Low — explicit grant removes ambiguity; existing RPCs rely on default grant and work |
| A5 | User may supply 0–2 niche clips | Target 4 | None — D-07 makes this explicitly non-blocking (vary the existing still) |

## Open Questions

1. **Does the landing deploy share the app's Supabase env or deploy standalone?**
   - What we know: Supabase exists in-repo; anon key path is intended (D-01).
   - What's unclear: whether the landing's Vercel project has the env vars wired.
   - Recommendation: planner adds a `checkpoint:human-verify` confirming `NEXT_PUBLIC_SUPABASE_URL` + anon key are set in the landing deploy before relying on live count in prod (dev works locally regardless).

2. **Threshold value for D-09 count display.**
   - What we know: must never show "0 creators"; threshold is Claude's discretion.
   - Recommendation: default 50; surface the chosen value in the plan as a one-line decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ffmpeg | Keyframe extraction (D-07) | ✓ | 8.0.1 | — |
| cwebp | WebP conversion (D-07) | ✓ | 1.6.0 | ffmpeg `-c:v libwebp` |
| supabase CLI | migration + `gen types` | ✓ | 2.105.0 | Supabase MCP `apply_migration` / `generate_typescript_types` |
| node | build/test | ✓ | 22.22.3 | — |
| Supabase MCP | apply migration when not locally linked | ✓ (session) | — | CLI `db push` (needs access token + link) |
| Supabase project `virtuna-v1.1` (remote) | table + RPC live | ✓ (remote, not locally linked) | PG 17 | local `supabase start` stack |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** local Supabase link absent → use MCP `apply_migration` (preferred) or set up CLI link.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (happy-dom env) + @testing-library/react |
| Config file | `vitest.config.ts` (has `staticImageStub` for `.webp` imports; `@/` alias) |
| Quick run command | `npm test -- src/components/numen-landing/__tests__/<file>.test.tsx` |
| Full suite command | `npm test` (vitest run) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTA-02 | `joinWaitlist` maps `23505` → `{status:"success"}` (dup-as-success, no leak) | unit | `npm test -- src/app/(marketing)/__tests__/actions.test.ts -x` | ❌ Wave 0 |
| CTA-02 | invalid email → `{status:"error"}`, no insert call | unit | same file | ❌ Wave 0 |
| CTA-02 | honeypot `company` filled → success without insert | unit | same file | ❌ Wave 0 |
| PROOF-01 | `getWaitlistCount` returns RPC number; error → 0 | unit | `npm test -- src/lib/__tests__/waitlist-count.test.ts` | ❌ Wave 0 |
| PROOF-01/D-09 | count < threshold renders qualitative anchor, never "0 creators" | unit | `npm test -- …/social-proof.test.tsx` | ❌ Wave 0 |
| PROOF-02/D-10 | proof strip + #proof receive the SAME count (one source) | unit | `…/proof-placement.test.tsx` (render page-ish) | ❌ Wave 0 |
| TRUST-01/02 | comparison renders a `<table>` with 2 col headers; rival strings present but scoped | unit (a11y) | `…/honesty-comparison.test.tsx` | ❌ Wave 0 |
| TRUST-02/CONTENT-02 | extended voice gate: new components carry NO banned token (rival component excluded/positively-asserted) | unit | `…/voice.test.tsx` (extend) | ✅ extend existing |
| GALLERY-01/02 | gallery renders ≥3 cards, each with an `<img>` + non-empty alt + a verdict band; verdict RANGE (not all good) | unit | `…/reading-gallery.test.tsx` | ❌ Wave 0 |
| single-h1 | page still has exactly one `<h1>` after slots filled | unit | extend page/heading test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- <the touched component test>`
- **Per wave merge:** `npm test` (full vitest run)
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/app/(marketing)/__tests__/actions.test.ts` — CTA-02 (mock `@/lib/supabase/server`; assert `insert` called / not-called, `23505`→success, honeypot, invalid email)
- [ ] `src/lib/__tests__/waitlist-count.test.ts` — PROOF-01 (mock RPC → number / error→0)
- [ ] `src/components/numen-landing/__tests__/social-proof.test.tsx` — D-09 threshold + never-"0"
- [ ] `src/components/numen-landing/__tests__/honesty-comparison.test.tsx` — `<table>` semantics + scoped rival strings
- [ ] `src/components/numen-landing/__tests__/reading-gallery.test.tsx` — ≥3 cards, alts, verdict range
- [ ] Extend `src/components/numen-landing/__tests__/voice.test.tsx` — add the four new components to the ban scan; assert the rival strings appear ONLY in `honesty-comparison` (positive assertion) so the page-wide gate stays meaningful
- [ ] Framework install: none — vitest + testing-library already present

**Testable seams identified:** (1) `joinWaitlist` server action — pure function of FormData + mocked Supabase client, the highest-value unit seam (dup-as-success, honeypot, validation all deterministic). (2) `getWaitlistCount` — RPC result mapping, error→0. (3) D-09 threshold render. (4) voice gate extension. A `VALIDATION.md` can be derived directly from the Req→Test map above.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Landing waitlist is unauthenticated by design (no auth this phase) |
| V3 Session Management | no | No sessions on the landing |
| V4 Access Control | yes | RLS insert-only policy; `SECURITY DEFINER` RPC returns count-only (no row access) |
| V5 Input Validation | yes | Server-side email regex + `source` literal allowlist + `CHECK` constraint; honeypot |
| V6 Cryptography | no | No secrets generated; no hashing this phase |

### Known Threat Patterns for {Next.js server action + Supabase}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email enumeration via dup error | Information Disclosure | Map `23505` → success; identical UX (D-02) |
| Email harvesting via count/select | Information Disclosure | Insert-only RLS; count via SECURITY DEFINER aggregate (never rows) |
| Bot spam signups | Denial of Service | Honeypot field (floor); optional rate-limit (Claude's discretion) |
| `source` field tampering | Tampering | Server-side literal allowlist + DB `CHECK` constraint |
| Service-role key exposure | Elevation of Privilege | Prefer anon-key RPC path; if fallback (b) used, the key stays server-only (`service.ts` is RSC-only) |
| Mass insert / unique-key flooding | DoS | `UNIQUE(email)` bounds duplicates; rate-limit optional |

## Sources

### Primary (HIGH confidence)
- Codebase (verified this session): `src/app/(onboarding)/signup/actions.ts`, `src/lib/supabase/{server,service,client}.ts`, `supabase/migrations/20260531000001_niche_percentiles_rpc.sql` + `…002_niche_histogram.sql` (SECURITY DEFINER count precedent), `…/20260213140000_referral_tables.sql` + `…/20260216000000_referral_clicks_insert_policy.sql` (RLS idiom), `src/components/numen/{verdict-swatch,surface,pill-chip}.tsx`, `src/components/numen-landing/{verdict-throne,section-shell}.tsx`, `src/components/numen-landing/__tests__/{hero,voice}.test.tsx`, `vitest.config.ts`, `package.json`, `supabase/config.toml`, `src/types/database.types.ts`, `.planning/VOICE.md`, `public/images/landing/hero/keyframe.webp` (`file` → 720×1280 WebP).
- Context7 `/vercel/next.js` — App Router caching (`unstable_cache`, `revalidate`, `no-store`, `unstable_noStore`).
- Shell (verified): `ffmpeg 8.0.1`, `cwebp 1.6.0`, `supabase 2.105.0`, `node v22.22.3`.

### Secondary (MEDIUM confidence)
- Supabase RLS default-deny + SECURITY DEFINER pattern — cross-verified against the repo's own working RPCs.

### Tertiary (LOW confidence)
- None — every load-bearing claim is verified against the repo or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all versions confirmed in repo.
- Architecture (waitlist insert/count, caching): HIGH — every pattern has a verified in-repo precedent.
- Asset pipeline: HIGH — tools confirmed on PATH; target spec read from the existing still.
- Migration/types workflow: HIGH (CLI) / MEDIUM (which apply path) — SQL is path-independent.
- Pitfalls/validation: HIGH — derived from repo's own test scaffolds.

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable stack; only Next caching APIs could shift — they're stable in 16.1.5)
