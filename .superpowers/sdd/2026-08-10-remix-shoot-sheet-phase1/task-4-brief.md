## Task 4: `remix_blueprints` table + repo

**Files:**
- Create: `supabase/migrations/20260810120000_remix_blueprints.sql`
- Create: `src/lib/remix/blueprint-repo.ts`
- Test: `src/lib/remix/__tests__/blueprint-repo.test.ts`

**Interfaces:**
- Produces: `insertBlueprint(service, row): Promise<void>` and `getBlueprint(service, id, userId): Promise<BlueprintRow | null>`.

⚠️ **Do not run `supabase db push`.** This project has migration-ledger drift; the file is written here and applied by hand in the SQL editor. Flag to the user when the task is done that the migration is pending.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260810120000_remix_blueprints.sql
-- Remix shoot sheet (phase 1). Holds the source's timed structural skeleton + the adapted
-- script, so revise_remix (phase 5) can rewrite without re-resolving the source video —
-- which is impossible anyway, because derive-and-drop deletes the source mp4 on every run.
--
-- id is a url-safe nanoid(12), NOT a uuid: analysis ids in this codebase are nanoids and a
-- .uuid() validator on /api/remix/adapt rejected every real id with a 400.

create table if not exists public.remix_blueprints (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  thread_id       uuid,
  -- The clip dedupe key (phase 4). /feed serves the same ~520 curated rows to every user, so
  -- clips must be keyed by SOURCE VIDEO, not by remix run, or storage grows with runs.
  source_video_id text,
  blueprint       jsonb not null,
  script          jsonb not null default '[]'::jsonb,
  clip_uris       jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists remix_blueprints_user_id_idx on public.remix_blueprints (user_id);
create index if not exists remix_blueprints_thread_id_idx on public.remix_blueprints (thread_id);
create index if not exists remix_blueprints_source_video_idx on public.remix_blueprints (source_video_id);

alter table public.remix_blueprints enable row level security;

-- RLS ON WITH NO POLICY reads as an empty table through the caller's client and writes fail
-- silently. The policy is not optional.
create policy "remix_blueprints_select_own"
  on public.remix_blueprints for select
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Write the failing repo tests**

```ts
// src/lib/remix/__tests__/blueprint-repo.test.ts
import { describe, it, expect, vi } from "vitest";
import { insertBlueprint, getBlueprint } from "../blueprint-repo";

/** Minimal supabase-js double — the I/O boundary we cannot run in a unit test. */
function clientReturning(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const eqUser = vi.fn().mockReturnValue({ single });
  const eqId = vi.fn().mockReturnValue({ eq: eqUser });
  const select = vi.fn().mockReturnValue({ eq: eqId });
  const insert = vi.fn().mockResolvedValue(result);
  return { from: vi.fn().mockReturnValue({ select, insert }), _insert: insert, _eqUser: eqUser };
}

describe("blueprint-repo", () => {
  it("throws when the insert returns an error — a swallowed write stores nothing", async () => {
    const c = clientReturning({ data: null, error: { message: "check constraint" } });
    await expect(insertBlueprint(c as never, {
      id: "abc123def456", user_id: "u1", thread_id: "t1", source_video_id: "v1",
      blueprint: { duration_s: 0, words_per_second: 0, has_speech: false, beats: [] },
      script: [],
    })).rejects.toThrow(/check constraint/);
  });

  it("scopes the read by user id as well as row id", async () => {
    const c = clientReturning({ data: { id: "abc123def456", script: [] }, error: null });
    await getBlueprint(c as never, "abc123def456", "u1");
    expect(c._eqUser).toHaveBeenCalledWith("user_id", "u1");
  });

  it("returns null rather than throwing when the row is absent", async () => {
    const c = clientReturning({ data: null, error: { code: "PGRST116", message: "no rows" } });
    expect(await getBlueprint(c as never, "missing", "u1")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm test -- src/lib/remix/__tests__/blueprint-repo.test.ts`
Expected: FAIL — `Failed to resolve import "../blueprint-repo"`.

- [ ] **Step 4: Implement `blueprint-repo.ts`**

```ts
/**
 * blueprint-repo.ts — the only module that touches remix_blueprints.
 *
 * supabase-js RETURNS errors, it does not throw them. A caller that ignores `error` stores
 * nothing and never finds out — that failure mode has cost this codebase real debugging time,
 * so every write here checks and throws.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";

export interface BlueprintRow {
  id: string;
  user_id: string;
  thread_id: string | null;
  source_video_id: string | null;
  blueprint: SourceBlueprint;
  /** One entry per ranked variant, in the same order the runner emitted its cards. */
  script: AdaptedBeat[][];
}

export async function insertBlueprint(
  service: SupabaseClient,
  row: BlueprintRow,
): Promise<void> {
  const { error } = await service.from("remix_blueprints").insert(row);
  if (error) throw new Error(`remix_blueprints insert failed: ${error.message}`);
}

export async function getBlueprint(
  service: SupabaseClient,
  id: string,
  userId: string,
): Promise<BlueprintRow | null> {
  const { data, error } = await service
    .from("remix_blueprints")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as BlueprintRow;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test -- src/lib/remix/__tests__/blueprint-repo.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Apply the migration by hand and verify RLS**

Paste the migration into the Supabase SQL editor and run it. Then verify — do not assume:

```sql
select 1 from public.remix_blueprints limit 1;
select relrowsecurity from pg_class where relname = 'remix_blueprints';  -- expect: t
select policyname from pg_policies where tablename = 'remix_blueprints'; -- expect 1 row
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260810120000_remix_blueprints.sql src/lib/remix/blueprint-repo.ts src/lib/remix/__tests__/blueprint-repo.test.ts
git commit -m "feat(remix): remix_blueprints table + repo, RLS on with a policy"
```

---

