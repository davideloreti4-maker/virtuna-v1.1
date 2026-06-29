/**
 * IN-01 / V12 — file ingest: validate-then-read for `.txt` / `.md` uploads
 * (RED until Wave 1 lands `../ingest`).
 *
 * `readTextFile` reads an allowed text `File` into trimmed text using `file.text()`
 * (zero parser deps, D-05). `validateUpload` enforces the caps BEFORE any read:
 *   - allowlist MIME + extension (`.txt` / `.md`; empty MIME tolerated for `.md`)
 *   - size cap (`MAX_TEXT_BYTES`)
 * A bad extension, a wrong MIME, or an oversize file is REJECTED at the boundary
 * (T-V12) — `file.name` is NEVER used as a path (Pitfall 3).
 *
 * Runner: `node ./node_modules/vitest/vitest.mjs run` (NEVER npm test / npx vitest).
 *
 * EXPECTED-RED: `../ingest` does not exist until its Wave-1 implementation plan.
 */
import { describe, it, expect } from "vitest";

import {
  readTextFile,
  validateUpload,
  MAX_TEXT_BYTES,
} from "../ingest";

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe("IN-01 / V12: text file ingest", () => {
  it("reads a .txt file into trimmed text", async () => {
    const file = makeFile("  hello world  ", "notes.txt", "text/plain");
    await expect(readTextFile(file)).resolves.toBe("hello world");
  });

  it("reads a .md file into trimmed text (empty MIME tolerated)", async () => {
    const file = makeFile("# Heading\n", "readme.md", "");
    await expect(readTextFile(file)).resolves.toBe("# Heading");
  });

  it("REJECTS a bad extension (e.g. .exe)", () => {
    const file = makeFile("MZ", "evil.exe", "application/octet-stream");
    expect(() => validateUpload(file)).toThrow();
  });

  it("REJECTS a wrong MIME type", () => {
    const file = makeFile("data", "sneaky.txt", "application/x-msdownload");
    expect(() => validateUpload(file)).toThrow();
  });

  it("REJECTS an oversize file (> MAX_TEXT_BYTES) before reading", () => {
    const huge = "a".repeat(MAX_TEXT_BYTES + 1);
    const file = makeFile(huge, "big.txt", "text/plain");
    expect(() => validateUpload(file)).toThrow();
  });
});
