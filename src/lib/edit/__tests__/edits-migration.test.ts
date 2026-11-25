/**
 * edits-migration.test.ts — the editor's two tables as their migration writes them (plan 2026-11-24-editor-screens-a, Task 1).
 * The migration is applied by the controller after review, never by a test: this reads its text and holds the rules the
 * routes and the stand-in rely on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(join(process.cwd(), "supabase/migrations/20261124210000_edits_turns.sql"), "utf8").replace(/--.*$/gm, "");

describe("the edits and edit_turns migration", () => {
  it("makes both tables, a turn keyed on its edit and its number", () => {
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.edits (");
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.edit_turns (");
    expect(SQL).toMatch(/PRIMARY KEY \(edit_id, n\)/);
    expect(SQL).toMatch(/kind\s+text\s+NOT NULL CHECK \(kind IN \('cut', 'change', 'direct', 'said'\)\)/);
    expect(SQL).toMatch(/CHECK \(\(kind = 'said'\) = \(doc IS NULL\)\)/);
    expect(SQL).toMatch(/n\s+integer\s+NOT NULL CHECK \(n >= 1 AND n <= 300\)/);
  });

  it("holds an edit to its creator's own take, and drops its turns with it", () => {
    expect(SQL).toMatch(/FOREIGN KEY \(take_id, user_id\) REFERENCES public\.edit_takes \(id, user_id\) ON DELETE CASCADE/);
    expect(SQL).toMatch(/FOREIGN KEY \(edit_id\) REFERENCES public\.edits \(id\) ON DELETE CASCADE/);
  });

  it("indexes every key an edit holds to another table's row", () => {
    expect(SQL).toContain("CREATE INDEX IF NOT EXISTS edits_take_idx ON public.edits (take_id, user_id);");
    expect(SQL).toContain("CREATE INDEX IF NOT EXISTS edits_thread_idx ON public.edits (thread_id) WHERE thread_id IS NOT NULL;");
    expect(SQL).toContain("CREATE INDEX IF NOT EXISTS edits_export_job_idx ON public.edits (export_job) WHERE export_job IS NOT NULL;");
  });

  it("lets a creator read their own rows and write none", () => {
    expect(SQL.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(2);
    expect(SQL.match(/FOR SELECT TO authenticated/g)).toHaveLength(2);
    expect(SQL).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/);
    // A turn is read through its edit, the turn's own column named in full.
    expect(SQL).toContain("WHERE e.id = edit_turns.edit_id AND e.user_id = (SELECT auth.uid())");
    expect(SQL).toContain("REVOKE ALL ON TABLE public.edits, public.edit_turns FROM anon;");
    expect(SQL).toContain("REVOKE ALL ON TABLE public.edits, public.edit_turns FROM authenticated;");
    expect(SQL).toContain("GRANT SELECT ON TABLE public.edits, public.edit_turns TO authenticated;");
  });

  it("stamps an edit's updated_at with the database's clock", () => {
    expect(SQL).toMatch(/CREATE TRIGGER edits_updated_at\s+BEFORE UPDATE ON public\.edits\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.edit_touch_updated_at\(\);/);
  });
});
