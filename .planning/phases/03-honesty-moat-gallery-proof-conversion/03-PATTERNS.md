# Phase 3: Honesty Moat, Gallery, Proof & Conversion - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 11 (8 new, 3 modified)
**Analogs found:** 11 / 11

All eleven Phase-3 files have a verified in-repo analog. This phase invents **zero** new patterns — every "hard" part (Supabase insert, RLS-safe count, verdict band, card plate, client form, static RSC section, voice gate) has an existing precedent to copy. The risk is divergence, not missing capability.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(marketing)/actions.ts` | server-action | request-response (mutation) | `src/app/(onboarding)/signup/actions.ts` | role + flow (insert vs auth) |
| `src/lib/waitlist-count.ts` | utility (cached read) | CRUD (aggregate read) | `supabase/migrations/20260531000001_…` (RPC) + `src/lib/supabase/server.ts` | role-match |
| `supabase/migrations/20260612000000_waitlist.sql` | migration | CRUD + RLS | `supabase/migrations/20260531000001_niche_percentiles_rpc.sql` + `…20260216000000_referral_clicks_insert_policy.sql` | exact (SECURITY DEFINER aggregate + insert-only RLS) |
| `src/components/numen-landing/honesty-comparison.tsx` | component (RSC) | transform/static | `src/components/numen-landing/how-it-works.tsx` | role-match (static RSC section) |
| `src/components/numen-landing/reading-gallery.tsx` | component (RSC) | static + image-I/O | `src/components/numen-landing/how-it-works.tsx` (Surface + next/image + VerdictThrone grid) | exact |
| `src/components/numen-landing/social-proof.tsx` | component (RSC) | static (prop-driven) | `src/components/numen-landing/how-it-works.tsx` + `verdict-throne.tsx` (plate) | role-match |
| `src/components/numen-landing/proof-strip.tsx` | component (RSC) | static (prop-driven) | `how-it-works.tsx` (thin band variant) | role-match |
| `src/components/numen-landing/waitlist-form.tsx` | component (client form) | request-response | `src/app/(onboarding)/signup/signup-form.tsx` | exact (`useActionState` + server action) |
| `src/components/numen-landing/cta-section.tsx` | component (RSC wrapper) | static | `how-it-works.tsx` (hosts a child artifact) | role-match |
| `src/app/(marketing)/page.tsx` | route (RSC) | static → async read | itself (current) + thread count prop | EDIT |
| `src/components/numen-landing/__tests__/voice.test.tsx` | test | — | itself (extend) | EDIT |
| `src/types/database.types.ts` | config (generated) | — | itself (regen via `supabase gen types`) | EDIT (generated, do not hand-edit) |

---

## Pattern Assignments

### `src/app/(marketing)/actions.ts` (server-action, request-response)

**Analog:** `src/app/(onboarding)/signup/actions.ts`

**Server-action header + client import** (lines 1-4):
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
```
Copy `"use server"` + `createClient` from `@/lib/supabase/server`. **Drop `redirect`** — waitlist returns inline state via `useActionState` instead of navigating (see RESEARCH Target 2). Add the `WaitlistState` union return type.

**FormData + error-mapping pattern** (lines 26-42):
```ts
export async function signup(_prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(mapSignupError(error.message))}`);
  }
  redirect("/login?message=…");
}
```
Mirror the `formData.get(...)` + `createClient()` + `{ error }` destructure shape. **Diverge** on three points the analog doesn't have (all in RESEARCH Target 2):
- Honeypot: `if ((formData.get("company") as string)?.trim()) return { status: "success" };`
- Email regex validation server-side before insert.
- Replace `signUp` with `supabase.from("waitlist").insert({ email, source })`; map unique-violation `error.code === "23505"` → `{ status: "success" }` (dup-as-success, no enumeration leak, D-02). Other errors → `{ status: "error", message: … }`.
- `source` is a server-side literal allowlist (`"landing-hero"` | `"landing-footer-cta"`), not trusted from the hidden field.

> **Sequence gate:** `.from("waitlist")` will NOT type-check until `database.types.ts` is regenerated (RESEARCH Target 5). Migration + regen BEFORE wiring this action.

---

### `src/lib/waitlist-count.ts` (utility, aggregate read)

**Analog (read path):** `src/lib/supabase/server.ts` (the `createClient` factory) + `supabase/migrations/20260531000001_niche_percentiles_rpc.sql` (the aggregate RPC it calls).

`server.ts` shows the anon RSC client this util reuses; the count is read via `supabase.rpc("waitlist_count")`. Wrap in `unstable_cache` so the page stays static (RESEARCH Target 3 — do NOT call `createClient()` directly in the page body for the count):
```ts
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const getWaitlistCount = unstable_cache(
  async (): Promise<number> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("waitlist_count");
    if (error || typeof data !== "number") return 0;  // fail-soft → 0 → below-threshold anchor
    return data;
  },
  ["waitlist-count"],
  { revalidate: 60, tags: ["waitlist-count"] },
);
```
**Error handling:** fail-soft to `0` (never throw) — `0` routes the D-09 guard to the qualitative anchor, never renders "0 creators".

---

### `supabase/migrations/20260612000000_waitlist.sql` (migration, CRUD + RLS)

**Analog (SECURITY DEFINER aggregate):** `supabase/migrations/20260531000001_niche_percentiles_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION public.compute_niche_percentiles(...)
RETURNS TABLE(median NUMERIC, p75 NUMERIC, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT … count(*) AS count
  FROM public.analysis_results
  WHERE …;
$$;
```
Copy the `LANGUAGE sql` + `SECURITY DEFINER` + `SET search_path = public` idiom EXACTLY for `waitlist_count()` (returns a bare `BIGINT count(*)`). This is the precedent that solves "count over RLS-hidden rows" — the function runs as definer so the anon caller gets a count without row visibility.

**Analog (insert-only RLS policy):** `supabase/migrations/20260216000000_referral_clicks_insert_policy.sql`
```sql
CREATE POLICY "Authenticated users can create referral clicks"
  ON referral_clicks FOR INSERT
  TO authenticated
  WITH CHECK (referred_user_id = (SELECT auth.uid()));
```
Mirror the `… FOR INSERT TO … WITH CHECK (…)` shape. **Diverge:** `TO anon, authenticated` + `WITH CHECK (true)` (anyone may join; no SELECT/UPDATE/DELETE policy → RLS default-deny hides rows from the anon aggregate). Full SQL is in RESEARCH Target 1 (table + `UNIQUE(email)` + `source` CHECK constraint + `ENABLE ROW LEVEL SECURITY` + the RPC + `GRANT EXECUTE … TO anon, authenticated`).

**Apply path:** Supabase MCP `apply_migration` (project not locally linked) — preferred; CLI `db push` is the fallback (RESEARCH Target 5). Then regenerate types.

---

### `src/components/numen-landing/reading-gallery.tsx` (component, static + image-I/O)

**Analog:** `src/components/numen-landing/how-it-works.tsx` — this is an EXACT structural match (Surface plates + `next/image` real stills + VerdictThrone in a responsive grid).

**Imports + grid pattern** (lines 1-5, 28-29):
```tsx
import Image from "next/image";
import { Surface } from "@/components/numen/surface";
import { VerdictThrone } from "@/components/numen-landing/verdict-throne";
import heroKeyframe from "@/../public/images/landing/hero/keyframe.webp";
…
<div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
```
Copy the import block + the `mt-8 grid gap-6 md:grid-cols-3 md:gap-8` grid (UI-SPEC §2: single-col mobile, `md:grid-cols-3`). Add `@/../public/images/landing/gallery/*.webp` imports for new niche stills (RESEARCH Target 4 ffmpeg→cwebp; reuse `heroKeyframe` as niche-1 if clips not supplied).

**Card anatomy** (lines 31-47) — copy the Surface + image plate:
```tsx
<Surface className="flex flex-col gap-4 p-4 md:p-6">
  …
  <div className="overflow-hidden rounded-[12px] border border-border">
    <Image src={heroKeyframe} alt="A real creator video ready for its Reading."
      placeholder="blur" className="h-auto w-full"
      sizes="(min-width: 768px) 320px, 100vw" />
  </div>
</Surface>
```
**Diverge (UI-SPEC §2 / Pattern 2 — honesty by breadth):** each card needs a verdict that VARIES (good / mixed / bad), not all-good. The existing `VerdictThrone` is HARD-CODED to `verdict="good"` + fixed copy. The planner MUST EITHER (a) parametrize `VerdictThrone` with `verdict`+`label`+`why` props (preferred — keeps band+why+plate in one place), OR (b) compose `VerdictSwatch` + label + why-line directly in the card. Add a `PillChip` niche tag per card. Every `<img>` gets a factual in-voice non-empty `alt`.

---

### `src/components/numen-landing/honesty-comparison.tsx` (component, transform/static)

**Analog:** `src/components/numen-landing/how-it-works.tsx` (static RSC, no `"use client"`, token-name color, `mt-8` lead-in).

**Diverge — semantic `<table>`** (RESEARCH Pattern 1 / UI-SPEC §1, no in-repo table analog):
```tsx
<table>
  <caption className="sr-only">Numen compared to virality-score tools</caption>
  <thead><tr><th scope="col">{/* corner */}</th><th scope="col">Numen</th><th scope="col">Virality-score tools</th></tr></thead>
  <tbody>
    <tr><th scope="row">What you get</th><td>{/* VerdictSwatch band + why */}</td><td>{/* "a viral score out of 100" — rejected */}</td></tr>
  </tbody>
</table>
```
**Verdict band** in the Numen column reuses `VerdictSwatch` (literal classes, see verdict-swatch.tsx) — band + why, never a number. Cells on `bg-panel` plates with `border-border` hairline rules.

> **D-05 HARD scoping:** "viral score" / "virality score" / "95% accuracy" / "% accuracy" / "guaranteed views" may appear ONLY inside THIS component (labelling the rejected rival category, never as a Numen claim). The voice gate (below) bans them everywhere else and positively-asserts them here. Keep them out of every other Phase-3 component.

---

### `src/components/numen-landing/social-proof.tsx` + `proof-strip.tsx` (components, prop-driven static)

**Analog:** `how-it-works.tsx` (Surface cards, token color) + `verdict-throne.tsx` (the plate pattern, lines 32-49) for the count block.

`verdict-throne.tsx` shows the plate idiom to copy for the count figure backing:
```tsx
<div className={cn("rounded-[12px] border border-border bg-panel p-4 md:p-6", className)}>
```
Both components receive `count: number` as a prop (one source, two surfaces — D-10; the page reads once and threads it). **D-09 threshold guard** lives in the presentational component, not the read (RESEARCH Pattern 3):
```tsx
const THRESHOLD = 50; // UI-SPEC default; tune 30–100, surface as a one-line decision
{count >= THRESHOLD
  ? <p>{count.toLocaleString()} creators are on the list.</p>
  : <p>Be one of the first creators to read your content honestly.</p>}
```
Never render "0 creators". Count figure = `text-3xl md:text-4xl font-bold tracking-tight text-text` (UI-SPEC §Typography — reuses the h2 scale, NOT a new display size; it's a `<p>`/`<span>`, not a heading).
- `proof-strip.tsx` = the thin `py-4 md:py-6` `border-y border-border` band (NOT a `py-24` section) mounted under the hero in `page.tsx` (D-10).
- `social-proof.tsx` = the fuller `#proof` block + a **placeholder-ready testimonial row**: renders from an EMPTY array → renders nothing (or one neutral non-quote line), NEVER a fabricated quote (D-08). Testimonial card = `Surface` plate + quote (`text-text`) + attribution (`text-text-muted`).

---

### `src/components/numen-landing/waitlist-form.tsx` (component, client form)

**Analog:** `src/app/(onboarding)/signup/signup-form.tsx` — EXACT `useActionState` + server-action form precedent.

**Client header + useActionState** (lines 1-4, 18-19):
```tsx
"use client";
import { useActionState } from "react";
…
const [_state, formAction, isPending] = useActionState(signup, null);
```
Copy `"use client"` + `useActionState(action, initialState)` + the `isPending` disable wiring. **Diverge:** import `joinWaitlist` from `@/app/(marketing)/actions`; initial state `{ status: "idle" }`; render inline success/error from `state` (analog redirects instead).

**Form + submit pattern** (lines 64-105):
```tsx
<form action={handleSubmit} className="space-y-4">
  <input type="hidden" name="next" value={next || ""} />
  <InputField label="Email" name="email" type="email" placeholder="you@example.com" required />
  {(error || clientError) && <p className="text-sm text-error" role="alert">{…}</p>}
  <Button type="submit" variant="primary" className="w-full" loading={isPending}>Create account</Button>
</form>
```
Mirror the hidden field (`name="source"` instead of `next`), `type="email" required`, `role="alert"` error, and `loading={isPending}` submit. **Diverge per UI-SPEC §4:**
- Add the **honeypot**: `<input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="sr-only" />`.
- Submit = `bg-accent text-bg min-h-11 rounded-lg`, label "Join the waitlist" → "Joining…" (NOT the auth `Button` — use the carried CTA accent treatment matching `hero.tsx` line 45).
- Success swaps the form for "You're on the list." (`role="status"`, `aria-live="polite"`); duplicate-as-success is IDENTICAL copy.

> **Note:** the analog uses `@/components/ui/*` (InputField/Button/Typography) — those are the OLD app kit, NOT the numen-landing kit. Prefer native `<input>`/`<button>` with token-name classes (`bg-panel`, `border-border`, `text-text`, accent submit) so the form matches the landing's `.numen-surface` language, not the app's glass forms.

---

### `src/components/numen-landing/cta-section.tsx` (component, RSC wrapper)

**Analog:** `how-it-works.tsx` (a section body that hosts a child artifact — here `<WaitlistForm source="landing-footer-cta" />`).

RSC wrapper: intro lead (`mt-6 md:mt-8` under the slot's h2) → `<WaitlistForm>` in a `max-w-md` container. The h2 is already on the `#cta` slot in `page.tsx`. The form is the only `"use client"` island; the wrapper stays RSC.

---

### `src/app/(marketing)/page.tsx` (route, EDIT)

**Analog:** itself (current, lines 17-47). Make `default function HomePage` **`async`**, read the count once, thread the prop (RESEARCH Target 3):
```tsx
export default async function HomePage() {
  const waitlistCount = await getWaitlistCount();
  return (
    <>
      <SectionShell id="hero" …><Hero /></SectionShell>
      <ProofStrip count={waitlistCount} />               {/* D-10 early strip */}
      <SectionShell id="how-it-works" …><HowItWorks /></SectionShell>
      <SectionShell id="honesty" heading="An honest verdict, not a hype score."><HonestyComparison /></SectionShell>
      <SectionShell id="gallery" heading="Real Readings, real creators."><ReadingGallery /></SectionShell>
      <SectionShell id="proof" heading="Creators who trust the Reading."><SocialProof count={waitlistCount} /></SectionShell>
      <SectionShell id="cta" heading="See what your next video is really saying."><CtaSection /></SectionShell>
    </>
  );
}
```
Fill the four currently heading-only slots; keep exactly one `<h1>` (hero owns it). Headings stay on the slots (carried copy).

---

### `src/components/numen-landing/__tests__/voice.test.tsx` (test, EXTEND)

**Analog:** itself (lines 19-47). Extend the `banned` regex scan to render the four new copy-bearing components:
```ts
const banned: RegExp[] = [/%/, /\bviral\b/i, /virality/i, /guaranteed/i, /\bApollo\b/, /\bfold\b/, /\bOmni\b/i, /\bpipeline\b/, /\bmodel\b/i, /accuracy/i, /predict/i];
```
**Diverge (RESEARCH Pitfall 5):** add `reading-gallery`, `social-proof`, `proof-strip`, `cta-section` to the ban scan, but EXCLUDE `honesty-comparison` from the negative scan — instead **positively assert** the sanctioned rival strings appear ONLY there (D-05). Keeps the page-wide gate meaningful.

---

### `src/types/database.types.ts` (config, REGENERATE — do not hand-edit)

Generated SSOT — already contains a `Functions:` block (`compute_niche_percentiles` at line 1852) confirming RPCs are included. After the migration applies, regenerate via `supabase gen types typescript --project-id virtuna-v1.1 --schema public > src/types/database.types.ts` (or MCP `generate_typescript_types`). Verify with `grep -n waitlist src/types/database.types.ts` → must show `waitlist` (Tables) + `waitlist_count` (Functions) BEFORE wiring the action/read.

---

## Shared Patterns

### Token-name color (NEVER hex in JSX)
**Source:** `how-it-works.tsx`, `verdict-throne.tsx`, `surface.tsx` — all color via bridged token NAMES (`bg-bg`, `bg-panel`, `text-text`, `text-text-muted`, `border-border`, `bg-verdict-good/mixed/bad`, `bg-accent`).
**Apply to:** every Phase-3 component. Phase-4 hex swap (D-L3) must need zero JSX edits. Accent (`bg-accent`/`text-accent`) reserved for the submit button fill + `focus-visible` ring ONLY.

### `cn()` + caller-overrides-win
**Source:** `surface.tsx` line 41, `verdict-throne.tsx` line 35, `section-shell.tsx` line 36 — caller `className` merged LAST through `cn()`.
```tsx
className={cn("rounded-[12px] border border-border bg-panel p-4 md:p-6", className)}
```
**Apply to:** every component with a `className` prop.

### `tailwind-variants` for variants
**Source:** `verdict-swatch.tsx` (`tv({ variants })`, literal classes), `pill-chip.tsx` (`tv({ slots })`), `surface.tsx`.
**Apply to:** any component needing variants (e.g. parametrized `VerdictThrone`, card states). NEVER `bg-${verdict}` interpolation — Tailwind v4 can't see dynamic strings; literal classes live in `VerdictSwatch`.

### Verdict band + why (never a naked number)
**Source:** `verdict-throne.tsx` (band + label + why on a `bg-panel` plate, APCA Lc ≥ 60 mitigation) → built on `verdict-swatch.tsx`.
**Apply to:** gallery cards + the comparison Numen cell. Plate-backed (NOT glass-over-photo — Lightning CSS strips `backdrop-filter`; CLAUDE.md). The label sits on a SOLID plate, never directly on the band.

### Focus-visible ring (carried verbatim)
**Source:** `hero.tsx` lines 27-28 (copied from `nav.tsx`/`footer.tsx`).
```tsx
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
```
**Apply to:** the email input, submit button, any clickable niche chip/card.

### Accent CTA treatment (carried)
**Source:** `hero.tsx` line 45 — the `#cta` scroll-anchor link.
```tsx
"inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
```
**Apply to:** the waitlist submit button (`min-h-11`, accent fill, `text-bg`).

### Server-only Supabase mutation (never client write)
**Source:** `signup/actions.ts` (`"use server"` + `createClient` from `@/lib/supabase/server`).
**Apply to:** the waitlist insert. NEVER `createBrowserClient().from("waitlist").insert()`. The form dispatches the server action; the action owns the write.

### Static RSC by default, client only for the form
**Source:** `how-it-works.tsx` (no `"use client"`), `hero.tsx` (`"use client"` only because it mounts an interactive child).
**Apply to:** honesty-comparison / reading-gallery / social-proof / proof-strip / cta-section = RSC. ONLY `waitlist-form.tsx` is `"use client"` (`useActionState`).

---

## No Analog Found

None. All eleven files map to a verified in-repo analog. The only NEW shape with no exact precedent is the semantic comparison `<table>` (RESEARCH Pattern 1) — but it's plain HTML inside an otherwise-analogous static RSC (`how-it-works.tsx`), not a new pattern class.

## Metadata

**Analog search scope:** `src/components/numen-landing/`, `src/components/numen/`, `src/app/(marketing)/`, `src/app/(onboarding)/signup/`, `src/lib/supabase/`, `supabase/migrations/`, `src/types/`
**Files scanned:** ~16 read end-to-end + grep on migrations/types
**Pattern extraction date:** 2026-06-12
```