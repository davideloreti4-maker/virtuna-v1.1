/**
 * The `piece_posts` migration against the code (the pattern of `src/lib/you/__tests__/facts.test.ts`): every
 * limit the code holds is the limit the table holds, the chat it points at has the id type it declares,
 * and a second run of the file changes nothing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HANDLE_PATTERN,
  PIECE_KEY_MAX,
  PIECE_KINDS,
  POST_ID_PATTERN,
  POST_LINK_MAX,
  READ_ERRORS,
  SAID_MEASURES,
  USUAL_MIN_POSTS,
} from "../posted";
import { MIGRATION, migrationColumns } from "./fake-db";

/** The SQL without its comments, so prose cannot satisfy or trip a check. */
const sql = () => readFileSync(MIGRATION, "utf8").replace(/--.*$/gm, "");
/** One column's line of the create table. */
const columnLine = (name: string) => {
  const line = sql()
    .split("\n")
    .find((l) => new RegExp(`^\\s*${name}\\s`).test(l));
  if (!line) throw new Error(`no column ${name}`);
  return line.trim();
};
const quotedList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(",");

describe("the piece_posts migration", () => {
  it("has the plan's columns, in its order", () => {
    expect(migrationColumns()).toEqual([
      "id",
      "user_id",
      "thread_id",
      "piece_key",
      "piece_kind",
      "said_number",
      "said_measure",
      "said_at",
      "platform",
      "post_url",
      "post_id",
      "handle",
      "posted_at",
      "views",
      "likes",
      "comments",
      "shares",
      "saves",
      "read_at",
      "reads",
      "settled_at",
      "usual_views",
      "usual_posts",
      "attempts",
      "read_error",
      "last_attempt_at",
      "removed_at",
      "created_at",
      "updated_at",
    ]);
  });

  it("keeps a removed link as a row: removed_at, null while the link is live (ruling 5)", () => {
    expect(columnLine("removed_at")).toBe("removed_at timestamptz,");
  });

  it("points at a chat by uuid, and a chat's id is a uuid", () => {
    expect(columnLine("thread_id")).toBe("thread_id uuid references public.threads(id) on delete cascade,");
    const threads = readFileSync(join(process.cwd(), "supabase/migrations/20260617000000_threads_messages.sql"), "utf8");
    expect(threads).toMatch(/CREATE TABLE IF NOT EXISTS public\.threads \(\s*id\s+uuid\s+PRIMARY KEY/);
    expect(columnLine("user_id")).toBe("user_id uuid not null references auth.users(id) on delete cascade,");
  });

  it("holds the code's piece kinds: the Library's, without a plain chat", () => {
    expect([...PIECE_KINDS]).toEqual(["video", "script", "remix", "hooks", "ideas", "text"]);
    expect(columnLine("piece_kind")).toContain(`check (piece_kind in (${quotedList(PIECE_KINDS)}))`);
  });

  it("holds the code's limits", () => {
    expect(columnLine("piece_key")).toContain(`check (char_length(piece_key) between 1 and ${PIECE_KEY_MAX})`);
    expect(columnLine("post_url")).toContain(`check (char_length(post_url) between 1 and ${POST_LINK_MAX})`);
    expect(columnLine("said_number")).toContain("check (said_number between 0 and 100)");
    expect(columnLine("said_measure")).toContain(`check (said_measure in (${quotedList(SAID_MEASURES)}))`);
    expect(columnLine("platform")).toBe("platform text not null default 'tiktok' check (platform in ('tiktok')),");
    expect(columnLine("post_id")).toContain(`check (post_id ~ '${POST_ID_PATTERN.source}')`);
    expect(columnLine("handle")).toContain(`check (handle ~ '${HANDLE_PATTERN.source}')`);
    expect(columnLine("usual_posts")).toContain(`check (usual_posts >= ${USUAL_MIN_POSTS})`);
    expect(columnLine("usual_views")).toContain("check (usual_views > 0)");
    expect(columnLine("read_error")).toContain(`check (read_error in (${quotedList(READ_ERRORS)}))`);
    expect(columnLine("reads")).toBe("reads jsonb not null default '[]'::jsonb,");
    expect(columnLine("attempts")).toBe("attempts smallint not null default 0 check (attempts >= 0),");
    for (const n of ["views", "likes", "comments", "shares", "saves"]) expect(columnLine(n)).toBe(`${n} bigint check (${n} >= 0),`);
  });

  it("holds one live post per person, chat and piece, a piece outside a chat included", () => {
    // Partial: a removed link does not hold its piece, so the piece can be linked again (ruling 5).
    expect(sql()).toMatch(
      /create unique index if not exists piece_posts_one_per_piece\s+on public\.piece_posts \(user_id, coalesce\(thread_id, '00000000-0000-0000-0000-000000000000'::uuid\), piece_key\)\s+where removed_at is null;/,
    );
    expect(sql().match(/create unique index/gi)).toHaveLength(1);
  });

  it("lets a person read only their own rows, in the (select auth.uid()) form, and write none: one policy, for select", () => {
    const text = sql();
    expect(text).toMatch(/alter table public\.piece_posts enable row level security;/);
    expect(text.match(/create policy/gi)).toHaveLength(1);
    expect(text).toMatch(
      /create policy piece_posts_select_own on public\.piece_posts\s+for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\);/,
    );
    // No policy for writing: every write goes through the server, which checks the link and the day's allowance.
    expect(text).not.toMatch(/for (all|insert|update|delete)\b/i);
    expect(text).not.toMatch(/with check/i);
    expect(text).not.toMatch(/[^(]auth\.uid\(\)\s*=/); // never the bare, per-row form
  });

  it("is safe to run twice: every create is guarded", () => {
    const text = sql();
    for (const create of text.matchAll(/create (unique index|index|table)\s+(\S+)/gi)) expect(create[2]).toBe("if");
    expect(text).toMatch(
      /if not exists \(select 1 from pg_policies where schemaname = 'public' and tablename = 'piece_posts' and policyname = 'piece_posts_select_own'\) then\s+create policy piece_posts_select_own/,
    );
  });

  it("is additive: it touches no other table and moves no data", () => {
    const text = sql();
    expect(text).not.toMatch(/\b(drop|update|delete from|insert|truncate|grant|revoke)\b/i);
    for (const m of text.matchAll(/alter table\s+([\w.]+)/gi)) expect(m[1]).toBe("public.piece_posts");
    for (const m of text.matchAll(/\bon\s+(public\.\w+)\s*\(/gi)) expect(m[1]).toBe("public.piece_posts");
  });

  it("is the only migration of this part", () => {
    const files = readdirSync(join(process.cwd(), "supabase/migrations")).filter((f) => /piece_posts/.test(f));
    expect(files).toEqual(["20261124130606_piece_posts.sql"]);
  });
});
