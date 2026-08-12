"use client";

/**
 * Platform as a RUN-LEVEL LENS (spec §3 / v8): the surface the next run generates for,
 * decoupled from `audiences.platform`, which is reinterpreted as PROVENANCE (what the
 * audience was calibrated from). Lens ≠ provenance → a quiet extrapolation note, never
 * a block. Applies next-run-only by construction (read at submit time).
 *
 * ⚠️ The Flash SIM is platform-blind — the lens changes GENERATION prompts only
 * (binding constraint, handoff §6). Never imply the verdict moved with the lens.
 */
import { useCallback, useEffect, useState } from "react";
import type { Platform } from "@/components/app/home/platform-chip";
import type { Audience } from "@/lib/audience/audience-types";
import { platformLabel } from "@/lib/platforms";

/** Lens display names — where the content ships (the scroll), not the provider brand. */
export const LENS_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Reels",
  youtube: "Shorts",
};
export const LENS_OPTIONS: Platform[] = ["tiktok", "instagram", "youtube"];

const STORAGE_KEY = "maven:v8:platform-lens";

const isPlatform = (v: unknown): v is Platform =>
  v === "tiktok" || v === "instagram" || v === "youtube";

/** The audience's real provenance, or null when it has none (custom / General). */
export function audienceProvenance(audience: Audience | null): Platform | null {
  const p = audience?.platform;
  return isPlatform(p) ? p : null;
}

/** "calibrated on Instagram — extrapolating" · null when the lens is honest already. */
export function extrapolationNote(lens: Platform, audience: Audience | null): string | null {
  const prov = audienceProvenance(audience);
  if (!prov || prov === lens) return null;
  return `calibrated on ${platformLabel(prov)} — extrapolating`;
}

/**
 * The lens carried from last session (localStorage), defaulting to the audience's
 * provenance until the creator picks one. Loaded post-mount (SSR-safe, same dodge
 * as the greeting).
 */
export function usePlatformLens(audience: Audience | null): {
  lens: Platform;
  setLens: (p: Platform) => void;
  note: string | null;
} {
  const [chosen, setChosen] = useState<Platform | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isPlatform(stored)) setChosen(stored);
    } catch {
      // Private mode etc. — the provenance default is fine.
    }
  }, []);
  const setLens = useCallback((p: Platform) => {
    setChosen(p);
    try {
      window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // Session-only is fine.
    }
  }, []);
  const lens = chosen ?? audienceProvenance(audience) ?? "tiktok";
  return { lens, setLens, note: extrapolationNote(lens, audience) };
}
