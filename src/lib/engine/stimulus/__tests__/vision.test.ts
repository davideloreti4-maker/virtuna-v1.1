/**
 * IN-03 / V5 — image → base64 data URL → vision read (RED until Wave 2 lands
 * `../vision`).
 *
 * `readImageWithVision` validates a screenshot `File`, base64-encodes it into a
 * `data:image/...;base64,` URL, and reads it with `QWEN_REASONING_MODEL`
 * (qwen3.7-plus — vision-capable; NEVER `QWEN_OMNI_MODEL`, D-04). The request is a
 * multimodal user-content array: an `{type:"image_url", image_url:{url}}` item
 * (the data URL) followed by a trailing `{type:"text"}` instruction item. The model
 * output is stripped → `JSON.parse` → Zod-validated into the returned read.
 * Oversize images and bad image MIME types are rejected at the boundary.
 *
 * The qwen client is MOCKED here (assert request shape + response parse). The only
 * live touch is the gated A2 base64 smoke at the bottom (DASHSCOPE_API_KEY-gated).
 *
 * Runner: `node ./node_modules/vitest/vitest.mjs run` (NEVER npm test / npx vitest).
 *
 * EXPECTED-RED: `../vision` does not exist until its Wave-2 implementation plan.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

// Partial-mock: keep the real model constants (QWEN_REASONING_MODEL etc.) and only
// swap getQwenClient for a fake whose completions.create is observable.
vi.mock("../../qwen/client", async (importActual) => {
  const actual = await importActual<typeof import("../../qwen/client")>();
  return {
    ...actual,
    getQwenClient: vi.fn(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

process.env.DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY ?? "test-key";

import { readImageWithVision } from "../vision";
import { QWEN_REASONING_MODEL, QWEN_OMNI_MODEL } from "../../qwen/client";

// A canned JSON read the (stub) vision module strips → parses → Zod-validates.
const CANNED_READ = JSON.stringify({ read: "A screenshot of a tweet about cats." });

function makePngFile(name = "shot.png", type = "image/png", bytes = 64): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: CANNED_READ } }],
  });
});

describe("IN-03 / V5: readImageWithVision request shape", () => {
  it("calls QWEN_REASONING_MODEL — NEVER QWEN_OMNI_MODEL (D-04)", async () => {
    await readImageWithVision(makePngFile());
    const params = mockCreate.mock.calls[0]![0];
    expect(params.model).toBe(QWEN_REASONING_MODEL);
    expect(params.model).not.toBe(QWEN_OMNI_MODEL);
  });

  it("builds a user-content array: base64 data-URL image_url item + trailing text item", async () => {
    await readImageWithVision(makePngFile("shot.png", "image/png"));
    const params = mockCreate.mock.calls[0]![0];
    const userMsg = params.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    const content = userMsg.content as Array<Record<string, unknown>>;

    const imageItem = content.find((c) => c.type === "image_url") as {
      image_url: { url: string };
    };
    expect(imageItem).toBeTruthy();
    expect(imageItem.image_url.url).toMatch(/^data:image\/png;base64,/);

    // A trailing text instruction item follows the image.
    expect(content[content.length - 1]!.type).toBe("text");
  });

  it("strips → JSON.parse → Zod-validates the model output into the returned read", async () => {
    const result = await readImageWithVision(makePngFile());
    // The returned value is derived from the parsed canned read, not the raw string.
    expect(typeof result).toBe("string");
    expect(result).toContain("cats");
  });

  it("REJECTS a bad image MIME type", async () => {
    await expect(
      readImageWithVision(makePngFile("evil.gif", "image/gif")),
    ).rejects.toThrow();
  });

  it("REJECTS an oversize image", async () => {
    const huge = makePngFile("big.png", "image/png", 11 * 1024 * 1024);
    await expect(readImageWithVision(huge)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// A2 live smoke (gated) — de-risks the one open unknown: does qwen3.7-plus accept
// a base64 `data:` image URL (not just hosted URLs)? SKIP-BY-DEFAULT (a paid live
// call): runs ONLY on explicit opt-in via `RUN_VISION_LIVE_SMOKE=1` AND a real
// DASHSCOPE_API_KEY. The opt-in flag is required because vitest auto-loads
// `.env.local` (which carries a key) — without it this paid probe would fire on
// every routine unit run. Fallback if base64 is rejected = Storage → signed-URL
// (the proven avatar pattern). Uses the REAL endpoint directly so the file-level
// getQwenClient mock does not interfere.
// ---------------------------------------------------------------------------
const liveIt =
  process.env.RUN_VISION_LIVE_SMOKE && process.env.DASHSCOPE_API_KEY
    ? it
    : it.skip;

// 1×1 transparent PNG.
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("A2 (gated live): qwen3.7-plus accepts a base64 data: image URL", () => {
  liveIt(
    "sends a 1×1 base64 PNG to QWEN_REASONING_MODEL and gets a parseable read",
    async () => {
      const { default: OpenAI } = await import("openai");
      const ai = new OpenAI({
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL:
          "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      });
      const params = {
        model: QWEN_REASONING_MODEL,
        messages: [
          {
            role: "user" as const,
            content: [
              {
                type: "image_url" as const,
                image_url: { url: `data:image/png;base64,${TINY_PNG_B64}` },
              },
              {
                type: "text" as const,
                text: 'Describe this image. Reply as JSON: {"read": string}.',
              },
            ],
          },
        ],
        response_format: { type: "json_object" as const },
        temperature: 0,
      };
      const completion = await ai.chat.completions.create(params as never);
      const raw = completion.choices[0]?.message?.content ?? "";
      expect(raw.length).toBeGreaterThan(0);
      expect(() => JSON.parse(raw)).not.toThrow();
    },
    60_000,
  );
});
