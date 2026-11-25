import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { YOU_FACT_KEYS, YOU_FACT_LIMITS } from "../facts";

// Named by the version the live database recorded when the migration was applied.
const MIGRATION = join(process.cwd(), "supabase/migrations/20261124022536_creator_profile_you_facts.sql");
/** The SQL without its comments, so prose cannot satisfy or trip a check. */
const sql = () => readFileSync(MIGRATION, "utf8").replace(/--.*$/gm, "");

describe("the five facts of You", () => {
  it("are the spec's five, in the page's order, with the spec's limits", () => {
    expect(YOU_FACT_KEYS).toEqual(["about", "sells", "writing_voice_description", "can_film", "never_do"]);
    expect(YOU_FACT_LIMITS).toEqual({ about: 200, sells: 300, writing_voice_description: 200, can_film: 200, never_do: 300 });
    // The five limits add up to 1,200 (spec §5). The writers' bundle carries them on top of its
    // 6,000 cap, with their headers and fences, and never sheds them (the controller's ruling 14).
    expect(Object.values(YOU_FACT_LIMITS).reduce((a, b) => a + b, 0)).toBe(1200);
  });

  it.each(YOU_FACT_KEYS)("the migration adds %s as nullable text with its length check", (key) => {
    const text = sql();
    expect(text).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${key} text NULL`, "i"));
    expect(text).toMatch(new RegExp(`CHECK \\(char_length\\(${key}\\) <= ${YOU_FACT_LIMITS[key]}\\)`, "i"));
  });

  it("the migration is additive only: five columns on creator_profiles, nothing dropped, moved or re-permitted", () => {
    const text = sql();
    expect(text.match(/ADD COLUMN/gi)).toHaveLength(5);
    expect(text).not.toMatch(/\b(DROP|UPDATE|DELETE|INSERT|TRUNCATE|GRANT|REVOKE|POLICY)\b/i);
    expect(text).not.toMatch(/writing_voice_sample/i);
    for (const table of text.matchAll(/ALTER TABLE\s+([\w.]+)/gi)) expect(table[1]).toBe("public.creator_profiles");
  });

  it("each limit's guard looks for its constraint on creator_profiles alone, not by name anywhere", () => {
    const lookups = [...sql().matchAll(/SELECT 1 FROM pg_constraint WHERE ([^)]*)\)/gi)].map((m) => m[1]!.trim());
    expect(lookups).toHaveLength(5);
    for (const key of YOU_FACT_KEYS) {
      expect(lookups).toContain(`conname = 'creator_profiles_${key}_length' AND conrelid = 'public.creator_profiles'::regclass`);
    }
  });

  it("is the only migration of this part, and named as the live database recorded it", () => {
    const files = readdirSync(join(process.cwd(), "supabase/migrations")).filter((f) => f.endsWith("_creator_profile_you_facts.sql"));
    expect(files).toEqual(["20261124022536_creator_profile_you_facts.sql"]);
  });
});
