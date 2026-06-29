/**
 * IN-01 + D-06 — `normalizeStimulus`: raw per-kind input → flat `Stimulus`
 * (RED until Wave 1/2 land `../normalize` + its `../ingest` / `../vision` deps).
 *
 * `normalizeStimulus` is the General-path twin of the Socials `normalizeInput`:
 *   - text       → `Stimulus{kind:"text", content, tier:"flash"}`
 *   - .txt/.md   → `content` = file text (via readTextFile), `tier:"flash"`
 *   - image      → `content` = vision read (vision MOCKED here), `tier:"flash"`
 *   - person-video → `Stimulus{kind:"video", tier:"max", source.storagePath set,
 *                    subject.isProfiledSubject===true, subject.goal carried}`
 *                    (D-06: P4 only TAGS the reference — NO omni run).
 *
 * `../vision` and `../ingest` are mocked so this isolates the normalize mapping.
 *
 * Runner: `node ./node_modules/vitest/vitest.mjs run` (NEVER npm test / npx vitest).
 *
 * EXPECTED-RED: `../normalize` (+ siblings) do not exist until Wave 1/2.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../vision", () => ({
  readImageWithVision: vi.fn(async () => "vision read of the screenshot"),
}));
vi.mock("../ingest", () => ({
  readTextFile: vi.fn(async (file: File) => `text:${file.name}`),
  validateUpload: vi.fn(),
}));

import { normalizeStimulus } from "../normalize";

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe("IN-01 + D-06: normalizeStimulus", () => {
  it("text → Stimulus{kind:'text', content, tier:'flash'}", async () => {
    const s = await normalizeStimulus({ kind: "text", text: "hello" });
    expect(s.kind).toBe("text");
    expect(s.content).toBe("hello");
    expect(s.tier).toBe("flash");
    expect(s.source.origin).toBe("text");
  });

  it(".txt/.md File → content = file text, tier:'flash'", async () => {
    const file = makeFile("# Notes", "notes.md", "");
    const s = await normalizeStimulus({ kind: "file_text", file });
    expect(s.kind).toBe("file_text");
    expect(s.content).toBe("text:notes.md");
    expect(s.tier).toBe("flash");
    expect(s.source.origin).toBe("file");
    // filename is display-only provenance (NEVER a path — Pitfall 3).
    expect(s.source.filename).toBe("notes.md");
  });

  it("image File → content = vision read (mocked), tier:'flash'", async () => {
    const file = makeFile("binary", "shot.png", "image/png");
    const s = await normalizeStimulus({ kind: "image", file });
    expect(s.kind).toBe("image");
    expect(s.content).toBe("vision read of the screenshot");
    expect(s.tier).toBe("flash");
    expect(s.source.origin).toBe("image");
  });

  it("person-video → kind:'video', tier:'max', storagePath + subject tag carried (no omni run)", async () => {
    const s = await normalizeStimulus({
      kind: "video",
      storagePath: "user-abc/clip.mp4",
      filename: "clip.mp4",
      goal: "assess executive presence",
      isProfiledSubject: true,
    });
    expect(s.kind).toBe("video");
    expect(s.tier).toBe("max");
    expect(s.source.origin).toBe("video");
    expect(s.source.storagePath).toBe("user-abc/clip.mp4");
    expect(s.subject?.isProfiledSubject).toBe(true);
    expect(s.subject?.goal).toBe("assess executive presence");
    // D-06: no omni run in P4 — content stays empty (the read happens in P5).
    expect(s.content).toBe("");
  });
});
