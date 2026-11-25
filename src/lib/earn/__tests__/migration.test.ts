/**
 * The migration of step B (ruling 11; the pattern of `src/lib/posted/__tests__/migration.test.ts`): two
 * columns on `referral_codes`, each with a check on the form the code holds, safe to run twice, and nothing
 * else. Pure FS test.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { WHOP_AFFILIATE_ID_PATTERN, WHOP_USERNAME_PATTERN } from "../earn";

const DIR = join(process.cwd(), "supabase/migrations");
const FILE = "20261124203943_referral_codes_whop.sql";
/** The SQL without its comments, so prose cannot satisfy or trip a check. */
const sql = () => readFileSync(join(DIR, FILE), "utf8").replace(/--.*$/gm, "");

describe("the referral_codes Whop migration", () => {
  it("adds exactly two nullable text columns to referral_codes, each only if it is not there", () => {
    const adds = [...sql().matchAll(/add column\s+(.+?)[,;]/gi)].map((m) => m[1]!.replace(/\s+/g, " ").trim());
    expect(adds).toEqual(["if not exists whop_username text", "if not exists whop_affiliate_id text"]);
    expect(sql()).toMatch(/alter table public\.referral_codes\s+add column if not exists whop_username text,\s+add column if not exists whop_affiliate_id text;/);
  });

  it("checks each column's form with the code's own pattern", () => {
    expect(sql()).toContain(
      `alter table public.referral_codes add constraint referral_codes_whop_username_form check (whop_username ~ '${WHOP_USERNAME_PATTERN.source}');`,
    );
    expect(sql()).toContain(
      `alter table public.referral_codes add constraint referral_codes_whop_affiliate_id_form check (whop_affiliate_id ~ '${WHOP_AFFILIATE_ID_PATTERN.source}');`,
    );
    expect(sql().match(/add constraint/gi)).toHaveLength(2);
  });

  it("is safe to run twice: each check is added only when it is not there", () => {
    for (const name of ["referral_codes_whop_username_form", "referral_codes_whop_affiliate_id_form"]) {
      expect(sql()).toMatch(
        new RegExp(
          `if not exists \\(select 1 from pg_constraint where conname = '${name}' and conrelid = 'public\\.referral_codes'::regclass\\) then\\s+alter table public\\.referral_codes add constraint ${name} `,
        ),
      );
    }
  });

  it("is additive: it touches no other table, no access rule, and moves no data", () => {
    const text = sql();
    expect(text).not.toMatch(/\b(drop|update|delete from|insert|truncate|grant|revoke|create policy|alter policy|create table|create index)\b/i);
    const altered = [...text.matchAll(/alter table\s+([\w.]+)/gi)].map((m) => m[1]);
    expect(altered.length).toBeGreaterThan(0);
    for (const table of altered) expect(table).toBe("public.referral_codes");
    expect(text).not.toMatch(/\bnot null\b|\bdefault\b/i);
  });

  it("the step's migration is this one file", () => {
    const files = readdirSync(DIR).filter((f) => /whop_username|referral_codes_whop/.test(f));
    expect(files).toEqual([FILE]);
  });
});
