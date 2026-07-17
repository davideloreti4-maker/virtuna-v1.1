/**
 * Unit tests for src/lib/engine/version.ts — single source of truth for ENGINE_VERSION.
 * Per CONTEXT.md D-05 + D-06; see RESEARCH Pitfall 8 for circular-import avoidance.
 */
import { describe, it, expect } from "vitest";
import { ENGINE_VERSION } from "../version";

describe("version", () => {
  it("exports ENGINE_VERSION = '3.21.0' (AUD-FAIL-01 — a dead audience can no longer read as HIGH confidence)", () => {
    expect(ENGINE_VERSION).toBe("3.21.0");
  });

  it("ENGINE_VERSION is a literal string", () => {
    expect(typeof ENGINE_VERSION).toBe("string");
  });

  it("ENGINE_VERSION is post-flip semver without -dev suffix (Phase 13 D-27)", () => {
    expect(ENGINE_VERSION).not.toMatch(/-dev$/);
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
