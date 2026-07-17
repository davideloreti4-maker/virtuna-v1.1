/**
 * §P BUILD step 3 — enrich-signature.ts unit tests (mock-first, zero network/LLM).
 *
 * All I/O is injected via `deps`, so these tests never touch DashScope or Apify.
 * Covers: top-video selection, VTT→text, the orchestrator wiring (deps called with the
 * right shapes), engine-fill of temperature/disposition from the canonical map (LLM
 * never decides those), graceful watch degradation, and provenance derivation.
 */

import { describe, it, expect, vi } from "vitest";
import {
  enrichSignature,
  selectTopVideos,
  vttToText,
  prepareWatchUrl,
  type WatchNote,
  type EnrichInput,
  type EnrichDeps,
  type SynthPayload,
} from "../enrich-signature";
import { TEMPERATURE_DISPOSITION } from "../temperature-disposition";
import { ARCHETYPES } from "@/lib/engine/wave3/persona-registry";
import type { ProfileData, VideoData } from "@/lib/scraping/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────────

function makeProfile(): ProfileData {
  return {
    handle: "testcreator",
    displayName: "Test Creator",
    bio: "ADHD productivity & fast systems",
    avatarUrl: "https://example.com/a.jpg",
    verified: true,
    followerCount: 142_000,
    followingCount: 300,
    heartCount: 3_200_000,
    videoCount: 87,
  };
}

function makeVideo(i: number, views: number, saves: number, shares: number): VideoData {
  return {
    platformVideoId: `vid_${i}`,
    videoUrl: `https://www.tiktok.com/@testcreator/video/${i}`,
    caption: `Caption ${i} #adhd #productivity`,
    views,
    likes: Math.round(views * 0.05),
    comments: Math.round(views * 0.01),
    shares,
    saves,
    hashtags: ["adhd", "productivity"],
    durationSeconds: 30,
    postedAt: new Date("2026-06-01"),
    subtitleUrl: `https://www.tiktok.com/subs/${i}.vtt`,
    mediaUrl: `https://api.apify.com/v2/key-value-stores/abc/records/video-${i}`,
  };
}

/** 10 reactors that satisfy the synth contract (shares + weights Σ=1, all slugs once). */
function makeSynth() {
  const personas = ARCHETYPES.map((archetype, idx) => ({
    archetype,
    share: idx === 0 ? 0.1 : 0.1, // even 0.1 × 10 = 1.0
    reaction_frame: `frame for ${archetype}`,
    evidence: `evidence ${idx}`,
  }));
  return {
    creator_persona: {
      content_description: "ADHD productivity systems",
      context: "Audience: founders. Voice: blunt. AVOID: hype.",
      writing_style_sample: "If you want more views, it's called hook alignment...",
      format_signature: "fast-cut talking head with on-screen text",
    },
    audience: {
      follower_tier: "mid",
      maturity: "established" as const,
      temperature_mix: { cold: 0.2, warm: 0.5, hot: 0.3 },
      interest_tags: ["adhd", "productivity", "tools"],
      topic_vocab: ["adhd_hacks", "system_building", "spectacle", "relatable"],
      what_resonates: "step-by-step saves",
      what_falls_flat: "talking-head storytime",
      persona_weights: { fyp: 0.55, niche: 0.3, loyalist: 0.1, cross_niche: 0.05 },
      personas,
    },
    summary: "warm, save-heavy productivity crowd",
  };
}

function makeInput(videos: VideoData[]): EnrichInput {
  return {
    handle: "testcreator",
    profile: makeProfile(),
    videos,
    subCoverage: `${videos.length}/${videos.length}`,
    goalIntent: "grow",
  };
}

const WATCH_NOTE: WatchNote = {
  content: "productivity tip",
  format: "talking head",
  visual_style: "fast cuts",
  audio: "blunt voiceover",
  hook_type: "promise",
  why_it_works: "clear utility",
  creator_voice_1liner: "blunt data-backed founder",
};

// ─── selectTopVideos ───────────────────────────────────────────────────────────────

describe("selectTopVideos", () => {
  it("ranks by (saves+shares)/views and returns at most 5", () => {
    const videos = Array.from({ length: 8 }, (_, i) =>
      makeVideo(i, 10_000, i * 100, i * 10),
    );
    const top = selectTopVideos(videos);
    expect(top.length).toBeLessThanOrEqual(5);
    // Highest engagement (i=7) must be first.
    expect(top[0]!.platformVideoId).toBe("vid_7");
  });

  it("returns all videos when fewer than the min are available", () => {
    const videos = [makeVideo(0, 1000, 50, 5), makeVideo(1, 1000, 10, 1)];
    const top = selectTopVideos(videos);
    expect(top).toHaveLength(2);
  });
});

// ─── vttToText ─────────────────────────────────────────────────────────────────────

describe("vttToText", () => {
  it("strips WEBVTT header, indices, timestamps, and inline tags", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:00.000 --> 00:00:02.000",
      "<c>If you want</c> more views",
      "",
      "2",
      "00:00:02.000 --> 00:00:04.000",
      "it's called hook alignment",
    ].join("\n");
    const text = vttToText(vtt);
    expect(text).toBe("If you want more views it's called hook alignment");
    expect(text).not.toContain("-->");
    expect(text).not.toContain("WEBVTT");
  });

  it("de-dups consecutive identical rolling-caption lines", () => {
    const vtt = ["WEBVTT", "", "00:00:00.000 --> 00:00:01.000", "hello", "00:00:01.000 --> 00:00:02.000", "hello"].join("\n");
    expect(vttToText(vtt)).toBe("hello");
  });
});

// ─── prepareWatchUrl (SSRF guard + Apify token) ───────────────────────────────────

describe("prepareWatchUrl", () => {
  it("appends the Apify token to an apify.com KV record (DashScope needs it)", () => {
    const prev = process.env.APIFY_TOKEN;
    process.env.APIFY_TOKEN = "tok123";
    const out = prepareWatchUrl("https://api.apify.com/v2/key-value-stores/x/records/v1");
    expect(out).toContain("token=tok123");
    process.env.APIFY_TOKEN = prev;
  });

  it("does not double-append a token", () => {
    const prev = process.env.APIFY_TOKEN;
    process.env.APIFY_TOKEN = "tok123";
    const out = prepareWatchUrl("https://api.apify.com/v2/x?token=already");
    expect(out).toContain("token=already");
    expect(out!.match(/token=/g)).toHaveLength(1);
    process.env.APIFY_TOKEN = prev;
  });

  it("rejects non-allowlisted hosts and non-https (SSRF guard) → null", () => {
    expect(prepareWatchUrl("https://evil.example.com/v.mp4")).toBeNull();
    expect(prepareWatchUrl("http://api.apify.com/v.mp4")).toBeNull();
    expect(prepareWatchUrl("not a url")).toBeNull();
  });

  it("passes a TikTok CDN url through without a token", () => {
    const out = prepareWatchUrl("https://v16.tiktokcdn.com/abc.mp4");
    expect(out).toBe("https://v16.tiktokcdn.com/abc.mp4");
  });
});

// ─── enrichSignature orchestration ───────────────────────────────────────────────

describe("enrichSignature", () => {
  function makeDeps(overrides: Partial<EnrichDeps> = {}): EnrichDeps {
    return {
      watchVideo: vi.fn(async () => WATCH_NOTE),
      fetchSubtitle: vi.fn(async () => "If you want more views it's called hook alignment"),
      synthesize: vi.fn(async () => makeSynth()),
      ...overrides,
    };
  }

  it("builds a signature with exactly 10 reactors", async () => {
    const videos = Array.from({ length: 12 }, (_, i) => makeVideo(i, 10_000, i * 80, i * 8));
    const sig = await enrichSignature(makeInput(videos), makeDeps());
    expect(sig.audience.personas).toHaveLength(10);
  });

  it("engine-fills temperature/disposition from the canonical map, NOT the LLM", async () => {
    const videos = Array.from({ length: 12 }, (_, i) => makeVideo(i, 10_000, i * 80, i * 8));
    const sig = await enrichSignature(makeInput(videos), makeDeps());
    for (const p of sig.audience.personas) {
      const canon = TEMPERATURE_DISPOSITION[p.archetype];
      expect(p.temperature).toBe(canon.temperature);
      expect(p.disposition).toBe(canon.disposition);
    }
  });

  it("passes derived persona_weights through untouched (reality-first, P-5)", async () => {
    const sig = await enrichSignature(makeInput([makeVideo(0, 10_000, 400, 100)]), makeDeps());
    expect(sig.audience.persona_weights).toEqual({ fyp: 0.55, niche: 0.3, loyalist: 0.1, cross_niche: 0.05 });
  });

  it("watches at most 5 videos and records videos_watched in provenance", async () => {
    const watch = vi.fn(async () => WATCH_NOTE);
    const videos = Array.from({ length: 12 }, (_, i) => makeVideo(i, 10_000, i * 80, i * 8));
    const sig = await enrichSignature(makeInput(videos), makeDeps({ watchVideo: watch }));
    expect(watch).toHaveBeenCalledTimes(5);
    expect(sig.provenance.videos_watched).toBe(5);
    expect(sig.provenance.videos_analyzed).toBe(12);
  });

  it("degrades gracefully when a watch returns null (counts only survivors)", async () => {
    let n = 0;
    const watch = vi.fn(async () => (n++ === 0 ? null : WATCH_NOTE)); // first fails
    const videos = Array.from({ length: 5 }, (_, i) => makeVideo(i, 10_000, i * 80, i * 8));
    const sig = await enrichSignature(makeInput(videos), makeDeps({ watchVideo: watch }));
    expect(sig.provenance.videos_watched).toBe(4);
  });

  it("feeds the synth payload real engagement ratios + transcripts", async () => {
    const synth = vi.fn(async (_p: SynthPayload) => makeSynth());
    const videos = [makeVideo(0, 10_000, 400, 100)]; // saveRate 4%, shareRate 1%
    await enrichSignature(makeInput(videos), makeDeps({ synthesize: synth }));
    const payload = synth.mock.calls[0]![0];
    expect(payload.videos[0]!.saveRate).toBeCloseTo(4.0, 1);
    expect(payload.videos[0]!.shareRate).toBeCloseTo(1.0, 1);
    expect(payload.videos[0]!.subtitleText).toContain("hook alignment");
    expect(payload.watchNotes).toHaveLength(1);
    expect(payload.goalIntent).toBe("grow");
  });

  it("skips videos with no mediaUrl (no rehost path) and counts only watched", async () => {
    const watch = vi.fn(async () => WATCH_NOTE);
    const videos = Array.from({ length: 4 }, (_, i) => {
      const v = makeVideo(i, 10_000, i * 80, i * 8);
      if (i < 2) delete v.mediaUrl; // 2 of 4 have no downloadable mp4
      return v;
    });
    const sig = await enrichSignature(makeInput(videos), makeDeps({ watchVideo: watch }));
    expect(watch).toHaveBeenCalledTimes(2);
    expect(sig.provenance.videos_watched).toBe(2);
  });

  it("records sub_coverage + handle in provenance", async () => {
    const sig = await enrichSignature(makeInput([makeVideo(0, 1000, 50, 5)]), makeDeps());
    expect(sig.provenance.handle).toBe("testcreator");
    expect(sig.provenance.sub_coverage).toBe("1/1");
  });
});

// ─── Progress staging (2026-07-14) ──────────────────────────────────────────────
//
// The SSE route awaits ONE opaque promise covering watch + synthesis, so it cannot see these
// boundaries from outside. Live (@zachking) the UI therefore sat on "Reading your followers…"
// for 126s while THIS code was watching videos, then flashed "Building your audience profile…"
// for 1s while a DB row was written. These tests pin the announcement to the WORK — a stage must
// fire BEFORE the phase it names, not after it.

describe("enrichSignature — onStage announces each phase as it BEGINS", () => {
  const videos = [makeVideo(0, 10_000, 400, 100), makeVideo(1, 8_000, 200, 50)];

  it("emits watching → synthesizing, each BEFORE its own work runs", async () => {
    const timeline: string[] = [];

    await enrichSignature(makeInput(videos), {
      watchVideo: vi.fn(async () => {
        timeline.push("work:watch");
        return WATCH_NOTE;
      }),
      fetchSubtitle: vi.fn(async () => null),
      synthesize: vi.fn(async () => {
        timeline.push("work:synthesize");
        return makeSynth();
      }),
      onStage: (stage) => timeline.push(`stage:${stage}`),
    });

    // The announcement precedes the work it names — that is the whole contract.
    expect(timeline.indexOf("stage:watching")).toBeGreaterThanOrEqual(0);
    expect(timeline.indexOf("stage:watching")).toBeLessThan(timeline.indexOf("work:watch"));
    expect(timeline.indexOf("stage:synthesizing")).toBeLessThan(
      timeline.indexOf("work:synthesize"),
    );
    // ...and synthesis is announced only AFTER the watching is done — not up front.
    expect(timeline.lastIndexOf("work:watch")).toBeLessThan(
      timeline.indexOf("stage:synthesizing"),
    );
  });

  it("is entirely optional — no onStage, no throw (every existing caller still works)", async () => {
    await expect(
      enrichSignature(makeInput(videos), {
        watchVideo: vi.fn(async () => WATCH_NOTE),
        fetchSubtitle: vi.fn(async () => null),
        synthesize: vi.fn(async () => makeSynth()),
      }),
    ).resolves.toBeTruthy();
  });

  // ─── v2: custom-per-creator persona fields flow through (Audience Sim v2, Stage 1) ─────
  it("carries the v2 custom persona fields (display_name, blurb, axes) + topic_vocab into the signature", async () => {
    const base = makeSynth();
    const custom = {
      ...base,
      audience: {
        ...base.audience,
        topic_vocab: ["sleight_of_hand", "spectacle", "humor"],
        personas: base.audience.personas.map((p, i) => ({
          ...p,
          display_name: `Custom ${i}`,
          blurb: `blurb ${i}`,
          reaction: {
            interests: { spectacle: 0.8 },
            hookSensitivity: 0.5,
            noveltyBias: 0.4,
            skepticism: 0.3,
            attentionSpan: 0.6,
          },
          behavior: {
            watchThrough: 0.5,
            sharePropensity: 0.4,
            commentPropensity: 0.3,
            savePropensity: 0.7,
          },
        })),
      },
    };
    const sig = await enrichSignature(makeInput([makeVideo(0, 10_000, 400, 100)]), {
      watchVideo: vi.fn(async () => WATCH_NOTE),
      fetchSubtitle: vi.fn(async () => null),
      synthesize: vi.fn(async () => custom),
    });
    expect(sig.audience.topic_vocab).toEqual(["sleight_of_hand", "spectacle", "humor"]);
    expect(sig.audience.personas[0]!.display_name).toBe("Custom 0");
    expect(sig.audience.personas[0]!.blurb).toBe("blurb 0");
    expect(sig.audience.personas[0]!.reaction?.hookSensitivity).toBe(0.5);
    expect(sig.audience.personas[0]!.reaction?.interests.spectacle).toBe(0.8);
    expect(sig.audience.personas[0]!.behavior?.savePropensity).toBe(0.7);
  });

  it("is legacy-safe — a synth without v2 persona fields yields personas that omit them (display falls back to archetype)", async () => {
    const sig = await enrichSignature(makeInput([makeVideo(0, 10_000, 400, 100)]), {
      watchVideo: vi.fn(async () => WATCH_NOTE),
      fetchSubtitle: vi.fn(async () => null),
      synthesize: vi.fn(async () => makeSynth()),
    });
    expect(sig.audience.personas[0]!.display_name).toBeUndefined();
    expect(sig.audience.personas[0]!.reaction).toBeUndefined();
    expect(sig.audience.personas[0]!.behavior).toBeUndefined();
  });
});
