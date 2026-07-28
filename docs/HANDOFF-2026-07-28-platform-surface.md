# Handoff — platform surface audit + Tier 1/2 + sidebar (2026-07-28)

Branch `lane/platform-surface` · worktree `~/virtuna-platform` · 6 commits `9ab566fd`…`66985d26`

**Suite 4755 / 0 · tsc clean · build ✅ · lint unchanged from baseline (65 problems, 34 errors — stash-verified identical before my first edit).**

---

## 0 · What this session was

An audit of our UI against **linear.app, attio.com, cursor.com, claude.com**, then fixing what it found. Method: signed into the running build, captured every real surface at 1512×860 and 390×844, and ran **one identical computed-style probe** over ours and theirs.

Probe scripts live in the session scratchpad (`probe.mjs`, `grid.mjs`, `focus.mjs`, `shoot.mjs`, `mkcookie.mjs`) — **not committed**. To re-run them, rebuild the auth cookie by minting a magic link with the service-role key, POSTing it to `/auth/v1/verify`, and writing the `sb-<ref>-auth-token` cookie as `base64-` + base64url(JSON session), chunked at 3180 chars.

---

## 1 · The bug worth remembering

**tailwind-merge silently deletes custom `text-*` classes.**

It knows Tailwind's built-in font sizes but nothing about custom `--text-*` theme keys. Shown `text-body` it cannot tell a size from a text *colour*, guesses colour, and drops the class whenever a real colour shares the same `cn()`:

```
twMerge("text-body font-medium", "text-foreground-secondary")
  → "font-medium text-foreground-secondary"        ← text-body GONE
twMerge("text-sm   font-medium", "text-foreground-secondary")
  → "text-sm font-medium text-foreground-secondary" ← built-in survives
```

The element falls back to the inherited 16px base. **Completely silent** — tsc clean, suite green, and the `.text-body` rule *is* present in the compiled CSS. It just never reaches the DOM.

Caught by eye, not by any check. The tell was arithmetic: the sidebar's section label carried `letter-spacing: 1.28px`, which is `0.08em × 16px`. I had that measurement in front of me and read past it.

Fixed in `src/lib/utils.ts` (`TYPE_ROLES` + `extendTailwindMerge`). **Guarded**: `src/components/__tests__/type-scale.test.ts` asserts every `--text-*` role in `globals.css` appears in `TYPE_ROLES`. Add a role to one and not the other and it fails.

---

## 2 · Type system

- `html, body { letter-spacing: 0.2px }` **deleted**. Pixels don't scale: it was `+0.007em` at 27px but `+0.020em` at 10px — loosening the smallest text most, backwards. Refs at 12–15px: Attio −0.010…−0.020em, Linear 0…−0.013em, Cursor and Claude 0.000em. **Not one loosens UI body text.**
- **Nine roles** in `@theme`, sized from *measured* usage (13px ×180, 11px ×177, 10px ×152 — none had a token, which is why 1,099 arbitrary `text-[Npx]` existed against 835 on-scale):
  `micro 10 · caption 11 · label 12 · body 13 · reading 14 · title 16 · subhead 18 · heading 22 · stat 27`
  Each carries size **+ line-height + tracking** together.
- **223 half-pixel sizes → 0** repo-wide. All four references use zero.
- ~298 call sites migrated on live surfaces only. Redirect-stub surfaces untouched by design.

### ⚠️ Correction to carry forward
My headline audit metric — *"45.9 distinct type styles per 100 text elements vs Linear's 8.6"* — **was inflated**. It divides by *our* element count, and our pages are sparse. In absolute terms `/home` ran **34 styles vs Linear 40, Cursor 42, Attio 63**. We were never 5× less disciplined. After the work: 30 styles. Don't chase that ratio; it doesn't apply at our page density.

Real remaining drift: **12px renders at four different line-heights** (18/15/19.5/16) because ~100 `leading-*` utilities override the role. Some of that is intentional (`leading-relaxed` on prose) — needs judgement per call site, not a sweep.

---

## 3 · Layout, focus, chrome

- **One content column.** Headers were at x = 268 / 462 / 566 — a 298px jump between sibling routes. Now **450 everywhere**. `SurfaceHeader` already existed for exactly this and had **zero importers** (written for surfaces that became redirect stubs); `PageShell` added alongside. Canonical 880px.
- **One focus ring.** Was Chrome's `outline: auto 1px rgb(0,95,204)`. The branded value existed as a byte-identical local `const focusRing` copy-pasted into **four files, three of them on dead routes**. Now one token + a global `:focus-visible` floor — **excluded on text fields**, where an inset ring draws a box inside the field (this was the "weird box" in the composer and palette; both autofocus, so it appeared before you touched anything).
- **`--color-chrome`** drives both flanking rails. They had drifted opposite ways: left `#1f1f1e` (identical to content), right a hardcoded `#181817`.

---

## 4 · Sidebar

Flush to the window edge, one right hairline, same tone family as chrome. Density 34/14/20 → **30/13/16**. Account stays bottom (owner call — top workspace switcher was offered and declined). Content offset 244 → 220.

**`MOBILE_NAV` is an independent coordinate system** (own `gutter: 10`), not derived from the old sidebar inset — it needed no change. Don't assume otherwise.

---

## 5 · ⌘K palette

`CommandPalette` existed but was **mounted nowhere**, and still carried the retired Raycast system — `--rounding-lg`, `--shadow-elevated`, `--color-bg-100`, `--color-grey-800/300/200`, `animate-scale-in`, **all undefined**. It rendered with no background, radius or shadow; the page showed through it. Nothing surfaced the rot until it was mounted. Repointed to live tokens, glass blur dropped (matte system).

It now searches **threads**. It mounts in `AppShell`, **not** the nav — the nav animates with `translate-x`, and a transformed ancestor re-bases `position: fixed` onto itself, trapping the overlay in a 220px column.

### Owner decision (recorded)
⌘K was called out as thin: zero threads for a new user, and its destinations were already visible in a two-item nav. Options offered were *skill launcher* / *remove* / *keep thin*. **Owner chose keep-thin — "zero further work."** Do not re-propose without new input.

---

## 6 · Threads: titles, pin, rename

**Titles.** The write is write-once (`title IS NULL`), so the first signal keeps the slot forever. A dropped video hands over its *filename* → threads named `TikTok Video Downloader (1).mp4`, permanently. Now refused in `cleanThreadTitle` (the single choke point all three writers pass through), which leaves the guard **open** so the skill subject or a derived card headline claims it instead.

Kept deliberately narrow — an ask that merely *contains* a link or filename must survive. **The negative half of `title-non-topical.test.ts` is the half that matters.**

**Schema.** `threads.pinned_at timestamptz` nullable + partial index. Applied via **`mcp__supabase__apply_migration`** — the SQL-editor path. ⚠️ `supabase db push` remains **UNSAFE** here (48 local-only / 41 remote-only migrations; it would recreate `threads`). Dev and prod share one project, so this ran against **production**.

`listOpenThreads` orders pinned-first via **`nullsFirst: false`** — Postgres sorts NULLs *first* on DESC by default, which would float every unpinned thread above the pinned ones.

**Rename** overwrites (unlike derivation) — the user naming a thread beats anything inferred. Empty clears to null → back to automatic derivation. Both mutations optimistic; pin re-sorts locally because a row that stays put until refetch reads as a dead click.

Verified live: pin persists · rename persists · filename refused.

*Known edge:* renaming *to* a filename returns 200 and clears the title rather than 400-ing. Defensible (matches "empty clears") but mildly surprising. Left as-is.

---

## 7 · Retracted claims from the original audit

I reported these and then disproved them. **Do not act on them.**

| claim | reality |
|---|---|
| Mobile bottom-band collision | The gear is `dev-mock-panel.tsx`, `if (!IS_DEV) return null` — **dev-only**. Re-measured at 390×844: nothing overlaps the composer. |
| 400px rail is nearly empty | **Headless artifact.** Its idle branch renders a constellation + two-column persona cast; my capture caught the `AmbientRoom` branch, which doesn't paint headless. |
| No motion infrastructure | `framer-motion` is a dep and `globals.css` has 26 `@keyframes` — spent on enter/exit and skeletons. "Zero *ambient* motion in the settled state" stands. |
| `/home` has no heading | It has the serif greeting `h1`; suppressed in thread mode, which is what my capture was in. |
| 45.9 vs 8.6 styles per 100 | Inflated by sparse pages — see §2. |

**Lesson worth keeping: verify before planning work on a finding. Three of these would have been wasted effort.**

---

## 8 · Open / next

1. **Thread-content search.** ⌘K searches titles only, over the already-loaded list. Searching *inside* threads needs a server route + a Postgres `tsvector` index on `messages` — and that migration must go through the SQL editor, not `db push`.
2. **`saved_items` in ⌘K.** Cheap and high-precision (user-curated `title` + `snapshot`). Owner hasn't asked for it.
3. **Line-height variance** — §2.
4. **Tier 3, untouched:** ambient motion budget; and the platform-concept question behind the **10 redirect stubs** (`/start /feed /discover /library /analytics /calendar /grow /competitors /saved /referrals` all resolve to `/home`, `/audience` or `/settings`). Real surfaces are only `/home`, `/audience`, `/settings`, `/analyze/[id]`. That is a strategy call, not a patch.
5. **Lint is red at baseline** — 34 pre-existing React-19-compiler errors. Not mine; `eslint.config.mjs` already ignores several live dirs.
