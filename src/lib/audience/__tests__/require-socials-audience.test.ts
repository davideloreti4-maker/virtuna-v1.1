/**
 * require-socials-audience.test.ts — MODE-01, the server half of the mode seam.
 *
 * The bug: `hooks` / `ideas` / `script` / `remix` / `explore` / `test` are socials-shaped by
 * construction (they write TikTok hooks and score against an FYP), and NOTHING refused a
 * `mode: 'general'` audience — an analyst panel, a hiring panel, one named person. The composer
 * gated it on the client; a stale client, a restored thread, or a direct API call sailed through.
 *
 * Mirrors predict's existing guard (`mode !== "general"` → 400) in the opposite direction.
 * `read` / `chat` / `simulate` accept BOTH modes and must never call this.
 */

import { describe, it, expect } from "vitest";
import { requireSocialsAudience } from "../require-socials-audience";
import type { Audience } from "../audience-types";

const socials = { mode: "socials", name: "Fitness Creators" } as Pick<Audience, "mode" | "name">;
const general = { mode: "general", name: "Analyst Panel" } as Pick<Audience, "mode" | "name">;

describe("requireSocialsAudience", () => {
  it("allows a socials audience", () => {
    expect(requireSocialsAudience(socials, "hooks")).toBeNull();
  });

  it("allows an absent audience (no pin resolves to General, which is mode:'socials')", () => {
    expect(requireSocialsAudience(null, "hooks")).toBeNull();
    expect(requireSocialsAudience(undefined, "remix")).toBeNull();
  });

  it("refuses a general-mode audience with a 400 — never a throw (a throw becomes a 500)", async () => {
    const res = requireSocialsAudience(general, "hooks");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);

    const body = await res!.json();
    expect(body.error).toBe("skill_requires_socials_audience");
    // The message must name the skill AND the audience — a bare code is not an explanation.
    expect(body.message).toContain("Hooks");
    expect(body.message).toContain("Analyst Panel");
  });

  it("names the offending skill, so the message is never generic", async () => {
    const body = await requireSocialsAudience(general, "remix")!.json();
    expect(body.message).toContain("Remix");
  });

  it("refuses every socials-only skill", () => {
    for (const skill of ["hooks", "ideas", "script", "remix", "explore", "test"] as const) {
      expect(requireSocialsAudience(general, skill)?.status).toBe(400);
    }
  });
});
