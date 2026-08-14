/**
 * skill-dispatch-live-scrape.test.ts — does `LIVE_SCRAPE_DEFAULT` reach a skill the CHAT AGENT
 * dispatched, or only one the composer routes started?
 *
 * The gap this closes: `resolveAllowScrape` lived ONLY in the three HTTP route handlers
 * (`/api/tools/{ideas,hooks,script}`). `skill-dispatch.ts` calls the pipelines directly and passed
 * no `allowScrape` at all, and the runners forward `input.allowScrape` with no env fallback — so the
 * flag was invisible to every generator run started from chat. With the flag ON and "everything on
 * for testing", asking Maven in chat for ideas still answered from the corpus, and no measurement of
 * the live path taken through chat could ever have been true.
 *
 * Own file because the runner mocks below would otherwise leak into the hermetic dispatcher suite,
 * which deliberately injects its registry rather than exercising the real bindings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runIdeasPipeline } from "@/lib/tools/runners/ideas-runner";
import { runHooksPipeline } from "@/lib/tools/runners/hooks-runner";
import { runScriptPipeline } from "@/lib/tools/runners/script-runner";
import { SKILL_TOOLS } from "@/lib/tools/skill-dispatch";

vi.mock("@/lib/tools/runners/ideas-runner", () => ({
  runIdeasPipeline: vi.fn(async () => ({ blocks: [], warnings: [] })),
}));
vi.mock("@/lib/tools/runners/hooks-runner", () => ({
  runHooksPipeline: vi.fn(async () => ({ blocks: [], warnings: [] })),
}));
vi.mock("@/lib/tools/runners/script-runner", () => ({
  runScriptPipeline: vi.fn(async () => ({ blocks: [], warnings: [] })),
}));

const CTX = {
  platform: "tiktok" as const,
  profileRow: null,
  audience: null,
  conversation: [],
} as unknown as Parameters<(typeof SKILL_TOOLS)[number]["run"]>[1];

const toolNamed = (name: string) => SKILL_TOOLS.find((t) => t.name === name)!;

/** The three generators are the only dispatched skills that can reach Apify. */
const GENERATORS = [
  { tool: "generate_ideas", pipeline: runIdeasPipeline },
  { tool: "generate_hooks", pipeline: runHooksPipeline },
  { tool: "write_script", pipeline: runScriptPipeline },
] as const;

let original: string | undefined;

beforeEach(() => {
  original = process.env.LIVE_SCRAPE_DEFAULT;
  vi.clearAllMocks();
});
afterEach(() => {
  if (original === undefined) delete process.env.LIVE_SCRAPE_DEFAULT;
  else process.env.LIVE_SCRAPE_DEFAULT = original;
});

describe("chat-dispatched generators and LIVE_SCRAPE_DEFAULT", () => {
  it("authorizes the live scrape when the environment does", async () => {
    process.env.LIVE_SCRAPE_DEFAULT = "true";

    for (const { tool, pipeline } of GENERATORS) {
      await toolNamed(tool).run({ topic: "high protein breakfast" }, CTX);
      expect(pipeline, `${tool} must forward the env authorization`).toHaveBeenCalledWith(
        expect.objectContaining({ allowScrape: true }),
      );
    }
  });

  /**
   * The default arm is the one that matters in production, and it is the arm a test that SETS the
   * variable can never see. The owner's 2026-07-17 rule — the scrape is explicit-only — has to
   * survive this seam, or one merge arms a spend for every user on every chat send.
   */
  it("does NOT authorize it when the variable is unset", async () => {
    delete process.env.LIVE_SCRAPE_DEFAULT;

    for (const { tool, pipeline } of GENERATORS) {
      await toolNamed(tool).run({ topic: "high protein breakfast" }, CTX);
      expect(pipeline, `${tool} must not spend by default`).toHaveBeenCalledWith(
        expect.objectContaining({ allowScrape: false }),
      );
    }
  });

  /**
   * For a MONEY flag ambiguity resolves to free — the inverse of the house `!== "false"` switch.
   * A shipped-ON feature should survive a half-set env; a spend must never be ARMED by one.
   */
  it("treats a half-set or mistyped value as NOT authorized", async () => {
    for (const value of ["", "TRUE", "1", "yes", "false"]) {
      process.env.LIVE_SCRAPE_DEFAULT = value;
      vi.clearAllMocks();

      await toolNamed("generate_ideas").run({ topic: "x" }, CTX);
      expect(runIdeasPipeline, `"${value}" must not arm a spend`).toHaveBeenCalledWith(
        expect.objectContaining({ allowScrape: false }),
      );
    }
  });

  /**
   * Read per call, never captured at module load — the owner flips this in `.env.local` against a
   * long-running dev server, and a value latched at import would make the flip look broken.
   */
  it("re-reads the variable per dispatch rather than latching it at import", async () => {
    delete process.env.LIVE_SCRAPE_DEFAULT;
    await toolNamed("generate_ideas").run({ topic: "x" }, CTX);
    expect(runIdeasPipeline).toHaveBeenLastCalledWith(expect.objectContaining({ allowScrape: false }));

    process.env.LIVE_SCRAPE_DEFAULT = "true";
    await toolNamed("generate_ideas").run({ topic: "x" }, CTX);
    expect(runIdeasPipeline).toHaveBeenLastCalledWith(expect.objectContaining({ allowScrape: true }));
  });
});
