/**
 * Unit tests for src/lib/engine/version.ts — single source of truth for ENGINE_VERSION.
 * Per CONTEXT.md D-05 + D-06; see RESEARCH Pitfall 8 for circular-import avoidance.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { ENGINE_VERSION } from "../version";

/** Re-import version.ts with ENGINE_AUDIO_SPLIT stubbed. The module reads the env at load, so
 *  the module registry has to be reset between the two branches. */
async function versionWithSplit(value: string | undefined): Promise<string> {
  vi.resetModules();
  if (value === undefined) vi.unstubAllEnvs();
  else vi.stubEnv("ENGINE_AUDIO_SPLIT", value);
  const mod = await import("../version");
  return mod.ENGINE_VERSION;
}

describe("version", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exports ENGINE_VERSION = '3.23.0' (2026-08-04 — the modality split is ON by default; cache MUST invalidate)", () => {
    expect(ENGINE_VERSION).toBe("3.23.0");
  });

  it("ENGINE_VERSION is a literal string", () => {
    expect(typeof ENGINE_VERSION).toBe("string");
  });

  // The version is derived from the modality-split flag rather than flat. These two assertions
  // ARE the cache-partition guarantee: without them, rolling the split back (or toggling the env
  // var in the Vercel dashboard with no deploy) would leave unified-era reads being written under
  // the split-era version and served from each other's rows.
  it("is 3.23.0 by default and on an explicit true — the split is ON in production", async () => {
    expect(await versionWithSplit(undefined)).toBe("3.23.0");
    expect(await versionWithSplit("true")).toBe("3.23.0");
  });

  it("returns to 3.22.0 on the ENGINE_AUDIO_SPLIT=false rollback (cache follows the engine back)", async () => {
    expect(await versionWithSplit("false")).toBe("3.22.0");
  });

  it("ENGINE_VERSION is post-flip semver without -dev suffix (Phase 13 D-27)", () => {
    expect(ENGINE_VERSION).not.toMatch(/-dev$/);
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
