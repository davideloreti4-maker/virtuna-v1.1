import { describe, it, expect } from "vitest";
import {
  buildThreadLaunchHref,
  THREAD_LAUNCH_PATH,
  LAUNCH_PARAM,
} from "../thread-launch";

/** Read the querystring of a built href back into URLSearchParams. */
const q = (href: string) => new URLSearchParams(href.split("?")[1] ?? "");

describe("buildThreadLaunchHref", () => {
  it("carries verb + seed + the run flag", () => {
    const href = buildThreadLaunchHref({
      input: "hooks about morning routines",
      verb: "Make",
      run: true,
    });
    const p = q(href);
    expect(href.startsWith(`${THREAD_LAUNCH_PATH}?`)).toBe(true);
    expect(p.get(LAUNCH_PARAM.verb)).toBe("Make");
    expect(p.get(LAUNCH_PARAM.seed)).toBe("hooks about morning routines");
    expect(p.get(LAUNCH_PARAM.run)).toBe("1");
  });

  it("omits the seed param for empty / whitespace input", () => {
    const href = buildThreadLaunchHref({ input: "   ", verb: "Ask" });
    expect(href).toBe(`${THREAD_LAUNCH_PATH}?v=Ask`);
    expect(q(href).has(LAUNCH_PARAM.seed)).toBe(false);
  });

  it("omits the run flag when not requested (= pre-fill only)", () => {
    const href = buildThreadLaunchHref({ input: "a real video", verb: "Test" });
    expect(q(href).get(LAUNCH_PARAM.run)).toBeNull();
  });

  it("includes the audience id only when provided", () => {
    expect(q(buildThreadLaunchHref({ input: "x", verb: "Make" })).has(LAUNCH_PARAM.audience)).toBe(false);
    const withAud = buildThreadLaunchHref({ input: "x", verb: "Make", audienceId: "aud-123" });
    expect(q(withAud).get(LAUNCH_PARAM.audience)).toBe("aud-123");
  });

  it("trims the seed", () => {
    const href = buildThreadLaunchHref({ input: "  spaced  ", verb: "Make" });
    expect(q(href).get(LAUNCH_PARAM.seed)).toBe("spaced");
  });

  it("round-trips special characters (URL, query, quotes, newlines)", () => {
    const input = 'https://www.tiktok.com/@x/video/123?a=b&c=d "quote" line2';
    const href = buildThreadLaunchHref({ input, verb: "Test", run: true });
    // Decoded back it must equal the original (no drift through the encode boundary).
    expect(q(href).get(LAUNCH_PARAM.seed)).toBe(input);
    // And the raw href must not leak an unencoded ampersand into a spurious param.
    expect(q(href).has("c")).toBe(false);
  });
});
