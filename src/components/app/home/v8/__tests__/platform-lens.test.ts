import { describe, expect, it } from "vitest";
import { extrapolationNote, LENS_LABEL, LENS_OPTIONS } from "../platform-lens";
import type { Audience } from "@/lib/audience/audience-types";

const aud = (platform: Audience["platform"]) => ({ platform }) as Audience;

describe("platform lens", () => {
  it("labels the three lenses as surfaces, not providers", () => {
    expect(LENS_OPTIONS).toEqual(["tiktok", "instagram", "youtube"]);
    expect(LENS_LABEL.tiktok).toBe("TikTok");
    expect(LENS_LABEL.instagram).toBe("Reels");
    expect(LENS_LABEL.youtube).toBe("Shorts");
  });

  it("admits extrapolation when lens ≠ provenance", () => {
    expect(extrapolationNote("tiktok", aud("instagram"))).toBe(
      "calibrated on Instagram — extrapolating",
    );
  });

  it("is quiet when lens matches provenance or provenance is unknown", () => {
    expect(extrapolationNote("tiktok", aud("tiktok"))).toBeNull();
    expect(extrapolationNote("tiktok", aud("custom"))).toBeNull();
    expect(extrapolationNote("tiktok", null)).toBeNull();
  });
});
