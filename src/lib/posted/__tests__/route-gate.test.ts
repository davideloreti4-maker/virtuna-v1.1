/**
 * How the posted routes log a failure (`logFailure`). Real: the function and the scraper's error class. The
 * gate itself is tested through the four handlers (`src/app/api/posted/**`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { IngestError } from "@/lib/scraping/types";
import { errorWords } from "../read-posts";
import { logFailure } from "../route-gate";

const LINK = "https://vm.tiktok.com/ZMmadeup1/";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logFailure", () => {
  it("logs the scraper's error by its kind, never its text (which carries the pasted link)", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logFailure("refresh", new IngestError("ssrf_rejected", LINK));
    expect(log).toHaveBeenCalledWith("[posted] refresh failed:", "IngestError[ssrf_rejected]");
    expect(log.mock.calls.flat().join(" ")).not.toContain("ZMmadeup");
  });

  it("logs a database error by its text, and anything else as text", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logFailure("add", new Error("piece_posts insert failed: connection reset by peer"));
    logFailure("add", "odd");
    expect(log.mock.calls).toEqual([
      ["[posted] add failed:", "piece_posts insert failed: connection reset by peer"],
      ["[posted] add failed:", "odd"],
    ]);
  });
});

describe("errorWords (the reader's)", () => {
  it("names a failure without its text", () => {
    expect(errorWords(new IngestError("scrape_failed", LINK))).toBe("IngestError[scrape_failed]");
    expect(errorWords(new TypeError(`fetch failed: ${LINK}`))).toBe("TypeError");
    expect(errorWords("odd")).toBe("string");
  });
});
