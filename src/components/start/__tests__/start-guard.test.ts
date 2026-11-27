/**
 * /start's parts are new-look code (CLAUDE.md, "New look in progress"): tokens only. No colour literal, no
 * legacy charcoal or coral, no accent, no glass on these screens.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "src/components/start");
const FILES = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f));
// The legacy shadow utilities only: `shadow-[var(--shadow-rest)]` is the right form and must pass.
const BANNED = [/#[0-9a-fA-F]{6}\b/, /#fff\b/i, /rgba?\(/, /white\/\[/, /charcoal/, /coral/, /\baccent\b/, /backdrop/, /(?<![-\w])shadow-(float|button|rest)\b/];

describe("src/components/start uses tokens only", () => {
  it("has files", () => expect(FILES.length).toBeGreaterThan(5));
  it.each(FILES)("%s", (file) => {
    const text = readFileSync(path.join(DIR, file), "utf8");
    for (const pattern of BANNED) expect(text, String(pattern)).not.toMatch(pattern);
  });
});
