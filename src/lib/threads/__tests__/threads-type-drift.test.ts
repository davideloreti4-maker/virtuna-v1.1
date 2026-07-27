/**
 * threads-type-drift.test.ts — the `threads.type` values the CODE writes must be values the
 * SCHEMA accepts.
 *
 * F-021: `archiveThread` shipped writing `type:'archived'` while the table still declared
 * `CHECK (type IN ('grounded','open'))` (20260617000000_threads_messages.sql:30). Every
 * "Delete thread" hit Postgres 23514 — a guaranteed 500, for every user, since the feature
 * shipped — and nothing in the suite noticed, because every unit test mocks the Supabase
 * client and a mock has no CHECK constraint. Mocks make schema drift invisible by
 * construction, so the only cheap guard is a static one: read the migrations, read the code,
 * and assert they agree.
 *
 * This fails against the pre-fix migration set.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const THREADS_LIB = join(process.cwd(), "src/lib/threads/threads.ts");

const literals = (list: string) =>
  [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]!);

/**
 * The effective CHECK list for threads.type — the LAST migration that redefines it wins.
 *
 * Scoped to the CONSTRAINT, never merely to files mentioning the table: `audiences`,
 * `transactions` and others declare their own `type` CHECK, and several of those migrations
 * also reference `public.threads`. A file-level filter therefore lets an unrelated table's
 * constraint win the "last" race — the first draft of this helper did exactly that and was
 * correct only by accident of file ordering.
 *
 * Two shapes count, and only these two:
 *   - the inline column CHECK inside `CREATE TABLE ... public.threads (…)` (Postgres names it
 *     `threads_type_check`), and
 *   - an explicit `ADD CONSTRAINT threads_type_check ... CHECK (type IN (…))`.
 */
function allowedThreadTypes(): string[] {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  let allowed: string[] = [];

  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), "utf8");

    // (a) inline, inside the threads CREATE TABLE body only
    const create = sql.match(/CREATE TABLE[^;]*?public\.threads\s*\(([\s\S]*?)\);/i);
    const inline = create?.[1]?.match(/\btype\b[^,]*?CHECK\s*\(\s*type\s+IN\s*\(([^)]*)\)/i);
    if (inline?.[1]) allowed = literals(inline[1]);

    // (b) an explicitly named re-definition (wins if both appear in one file)
    const named = [
      ...sql.matchAll(
        /ADD\s+CONSTRAINT\s+threads_type_check[\s\S]*?CHECK\s*\(\s*type\s+IN\s*\(([^)]*)\)/gi,
      ),
    ];
    const lastNamed = named[named.length - 1];
    if (lastNamed?.[1]) allowed = literals(lastNamed[1]);
  }
  return allowed;
}

/** Every string literal the lib assigns to `type:` — what the code actually writes. */
function typesWrittenByCode(): string[] {
  const src = readFileSync(THREADS_LIB, "utf8");
  return [...new Set([...src.matchAll(/\btype:\s*"([a-z_]+)"/g)].map((m) => m[1]!))];
}

describe("threads.type — code ↔ schema", () => {
  it("the migrations permit every type the code writes", () => {
    const allowed = allowedThreadTypes();
    expect(allowed.length).toBeGreaterThan(0); // the parser found the constraint at all

    const rejected = typesWrittenByCode().filter((t) => !allowed.includes(t));
    expect(rejected).toEqual([]);
  });

  it("'archived' is permitted — the value the sidebar's Delete writes (F-021)", () => {
    expect(allowedThreadTypes()).toContain("archived");
  });

  it("still permits the two original types — widening must not have dropped either", () => {
    const allowed = allowedThreadTypes();
    expect(allowed).toContain("open");
    expect(allowed).toContain("grounded");
  });
});
