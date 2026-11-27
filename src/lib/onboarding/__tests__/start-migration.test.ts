/**
 * The start-answers migration (plan 01-start-and-profile, Task 1) holds the new columns the funnel's five parts
 * agreed on (master plan, "Profile columns"), each added once, with its check; it adds no duplicate of the
 * columns it reuses (primary_goal, target_platforms, display_name), touches none of them, and changes no access
 * rule.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261126120000_creator_profile_start_answers.sql"),
  "utf8",
);

const COLUMNS = [
  "niche text",
  "niche_source text",
  "email_consent boolean NOT NULL DEFAULT false",
  "guide_step smallint NOT NULL DEFAULT 0",
  "guide_dismissed_at timestamptz",
  "trial_reminder_sent_at timestamptz",
  "paywall_left_email_at timestamptz",
];

const CHECKS = ["creator_profiles_niche_length", "creator_profiles_niche_source_known", "creator_profiles_guide_step_range"];

/** Reused, never added or changed here (master plan, revised 2026-11-26). */
const REUSED = ["primary_goal", "target_platforms", "display_name"];

describe("start-answers migration", () => {
  it.each(COLUMNS)("adds %s, once", (column) => {
    expect(SQL).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
  });

  it.each(CHECKS)("adds the check %s only when it is missing", (name) => {
    expect(SQL).toContain(`conname = '${name}'`);
    expect(SQL).toContain(`ADD CONSTRAINT ${name} CHECK`);
  });

  it("changes no access rule", () => {
    expect(SQL).not.toMatch(/^\s*(CREATE|ALTER|DROP)\s+POLICY|^\s*GRANT|ENABLE ROW LEVEL SECURITY/im);
  });

  it.each(REUSED)("adds no %s and does not touch it", (column) => {
    const statements = SQL.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
    expect(statements).not.toContain(column);
  });

  it("adds no column named goal or platforms", () => {
    expect(SQL).not.toMatch(/ADD COLUMN IF NOT EXISTS (goal|platforms)\b/);
  });

  it("its undo drops only the new columns", () => {
    const start = SQL.indexOf("Undo:");
    const undo = SQL.slice(start, SQL.indexOf("=====", start));
    expect(undo).toContain("DROP COLUMN niche,");
    for (const column of REUSED) expect(undo).not.toContain(column);
  });
});
