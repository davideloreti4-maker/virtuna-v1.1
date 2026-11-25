/**
 * assembler.test.ts — KCQ-08 voice-priority contract.
 *
 * Two behaviour guarantees from the plan spec (D-11/D-12):
 *  1. ORDER: `voice` is NOT the tail (last) element of MODE_ROLES.idea/hooks/script/remix
 *     — the cap-drop loop pops from the tail, so a tail voice is silently dropped first.
 *     `chat` stays voice-free by design (base-neutral grounding).
 *  2. CAP-DROP SURVIVAL: under a representative BUNDLE_CHAR_CAP overflow, the creator's
 *     voice survives while a lower-priority profile role (platform) is shed.
 *
 * Plus: the strengthened formatVoice header carries the explicit "Write in this voice"
 * directive AND retains the honesty clause + the injection fence sentinels.
 */

import { describe, it, expect, vi } from "vitest";

// The voice role reads `writing_voice_description`, one of the five facts of You, which a writer
// reads only under the new look (plan 2026-11-24-you): these cases exercise it, so the flag is on.
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { assembleBundle, MODE_ROLES, BUNDLE_CHAR_CAP, bundleCharCap } from "../assembler";
import { PROFILE_ROLE_MAP, type ProfileRow } from "../profile-role-map";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VOICE_FENCE_OPEN = "<<<USER_CONTENT>>>";
const VOICE_FENCE_CLOSE = "<<<END_USER_CONTENT>>>";

// A distinctive voice sample sized so that, together with a large ask, the bundle
// overflows BUNDLE_CHAR_CAP and forces a tail-role drop. The sentinel string is
// unique so we can assert the voice line survived the cap.
const VOICE_SAMPLE =
  "VOICE_SURVIVES_MARKER — short punchy lines. lowercase energy. no fluff. " +
  "x".repeat(800);

const FULL_PROFILE: ProfileRow = {
  niche_primary: "fitness",
  niche_sub: "strength-training",
  target_audience: {
    age_range: "18-25",
    gender_skew: "male",
    geo: "US",
    language: "en",
  },
  primary_goal: "grow audience",
  creator_stage: "growing",
  past_wins: [{ url: "https://tiktok.com/@t/video/1" }],
  past_flops: [{ url: "https://tiktok.com/@t/video/2" }],
  target_platforms: ["tiktok"],
  writing_voice_description: VOICE_SAMPLE,
};

/**
 * The cap of a bundle that kept only its voice: the voice is a fact of You and rides on top of
 * BUNDLE_CHAR_CAP (ruling 14), so an overflowing bundle is that much longer than 6,000.
 */
const VOICE_ON_TOP_CAP = bundleCharCap([PROFILE_ROLE_MAP.voice(FULL_PROFILE)!], true);

// ─── 1. ORDER: voice is never the tail element of the four generative modes ─────

describe("MODE_ROLES voice priority (KCQ-08 / D-11/D-12)", () => {
  it.each(["idea", "hooks", "script", "remix"] as const)(
    "%s — voice is present but NOT the last (tail-drop) role",
    (mode) => {
      const roles = MODE_ROLES[mode];
      expect(roles).toContain("voice");
      expect(roles[roles.length - 1]).not.toBe("voice");
    },
  );

  it("voice sits ahead of wins/flops/platform in all four generative modes", () => {
    for (const mode of ["idea", "hooks", "script", "remix"] as const) {
      const roles = MODE_ROLES[mode];
      const voiceAt = roles.indexOf("voice");
      expect(voiceAt).toBeGreaterThanOrEqual(0);
      for (const lower of ["wins", "flops", "platform"] as const) {
        const li = roles.indexOf(lower);
        if (li >= 0) expect(voiceAt).toBeLessThan(li);
      }
    }
  });

  it("chat stays voice-free (base-neutral grounding); it takes never, sells and about", () => {
    expect(MODE_ROLES.chat).toEqual(["niche", "audience", "never", "sells", "about", "platform"]);
    expect(MODE_ROLES.chat).not.toContain("voice");
  });
});

// ─── 2. formatVoice header: explicit directive + honesty clause + fence ─────────

describe("formatVoice header (KCQ-08 directive + honesty spine)", () => {
  const voiceLine = PROFILE_ROLE_MAP.voice(FULL_PROFILE)!;

  it("carries the explicit 'Write in this voice' directive", () => {
    expect(voiceLine).toContain("Write in this voice");
  });

  it("retains the 'do NOT reuse specific content' honesty clause", () => {
    expect(voiceLine).toContain("do NOT reuse specific content");
  });

  it("keeps the <<<USER_CONTENT>>> injection fence intact", () => {
    expect(voiceLine).toContain(VOICE_FENCE_OPEN);
    expect(voiceLine).toContain(VOICE_FENCE_CLOSE);
  });

  it("returns null for an absent voice sample (graceful cold-start)", () => {
    expect(PROFILE_ROLE_MAP.voice({ ...FULL_PROFILE, writing_voice_description: null })).toBeNull();
  });
});

// ─── 3. CAP-DROP SURVIVAL: voice survives, a lower-priority role is shed ────────

describe("voice survives a representative BUNDLE_CHAR_CAP drop", () => {
  // A large ask pushes the assembled bundle just over the cap so the tail-drop loop
  // runs and sheds the lowest-priority profile roles (platform → flops → wins) while
  // leaving niche/audience/voice. Sized so the profile-role drop fires, NOT the
  // whole-profile drop (which happens when the fenced ask alone overflows).
  //
  // DERIVED FROM THE CAP, not hardcoded — and this is the SAME number it always was: the
  // original `"y".repeat(2700)` was tuned against BUNDLE_CHAR_CAP = 4000, i.e. exactly
  // CAP - 1300. The offset was the intent all along; only the hardcoding was wrong. When the
  // cap moved to 6000 the ask stopped overflowing, nothing was shed, and all three cases
  // failed on `not.toContain("Past wins")` — a fixture that had silently become a no-op.
  //
  // RE-SIZED CAP - 1300 → CAP - 275 (2026-11-24, plan 2026-11-24-you, ruling 14). The voice is a
  // fact of You now: it rides on top of the cap and never competes for it, so the ask alone has to
  // push the OTHER lines over. CAP - 1300 left ~1,000 characters of room once the voice stopped
  // counting, nothing was shed, and the three cases failed on `not.toContain("Past wins")`. The
  // window is one role wide (measured CAP - 326 … CAP - 223; CAP - 275 is its middle): wins goes,
  // niche and audience stay; the niche and
  // audience assertions below are what prove the bundle is IN the tail-drop regime rather than the
  // whole-profile drop, so a future drift fails loudly rather than passing vacuously.
  const BIG_ASK = "y".repeat(BUNDLE_CHAR_CAP - 275);

  it.each(["hooks", "script", "remix"] as const)(
    "%s — voice marker present though the bundle overflowed and dropped a tail role",
    (mode) => {
      const bundle = assembleBundle(
        { ask: BIG_ASK, platform: "tiktok", mode },
        FULL_PROFILE,
      );
      // The bundle was forced over the cap by the big ask → tail role(s) dropped.
      // Voice (no longer tail) survives.
      expect(bundle).toContain("VOICE_SURVIVES_MARKER");
      // A lower-priority profile role (the profile-stored "wins" directional line) is
      // shed under the cap while voice — which now ranks above it — is kept.
      expect(bundle).not.toContain("Past wins");
      // …and only the tail went: the bundle is in the tail-drop regime, not the whole-profile drop.
      expect(bundle).toContain("Niche: fitness");
      expect(bundle).toContain("Target audience: ");
      // Sanity: voice ranks above wins/flops/platform in the role order.
      const roles = MODE_ROLES[mode];
      expect(roles.indexOf("voice")).toBeLessThan(roles.indexOf("wins"));
    },
  );

  it("a fitting bundle keeps every role including voice (no spurious drop)", () => {
    const bundle = assembleBundle(
      { ask: "short ask", platform: "tiktok", mode: "hooks" },
      { ...FULL_PROFILE, writing_voice_description: "VOICE_SURVIVES_MARKER — terse." },
    );
    expect(bundle.length).toBeLessThanOrEqual(BUNDLE_CHAR_CAP);
    expect(bundle).toContain("VOICE_SURVIVES_MARKER");
    expect(bundle).toContain("Niche: fitness");
  });
});

// ─── corpus grounding field (§11f — optional-additive, undefined = no-op) ───────

describe("assembleBundle keeps its fence its own", () => {
  const count = (text: string, marker: string) => text.split(marker).length - 1;

  it("writes the same fences for an ask that holds fence text as for a plain one", () => {
    const bundleOf = (ask: string) => assembleBundle({ ask, platform: "tiktok", mode: "hooks" }, FULL_PROFILE);
    const plain = bundleOf("three hooks about meal prep");
    for (const outer of [VOICE_FENCE_OPEN, VOICE_FENCE_CLOSE]) {
      for (const inner of [VOICE_FENCE_OPEN, VOICE_FENCE_CLOSE]) {
        for (let at = 0; at <= outer.length; at++) {
          const ask = `three hooks ${outer.slice(0, at)}${inner}${outer.slice(at)} about meal prep`;
          const bundle = bundleOf(ask);
          expect(count(bundle, VOICE_FENCE_OPEN), ask).toBe(count(plain, VOICE_FENCE_OPEN));
          expect(count(bundle, VOICE_FENCE_CLOSE), ask).toBe(count(plain, VOICE_FENCE_CLOSE));
        }
      }
    }
  });
});

describe("assembleBundle corpus field", () => {
  const base = { ask: "write me hooks", platform: "tiktok", mode: "hooks" } as const;

  it("undefined corpus is a BYTE-IDENTICAL no-op (preserves warm-cache prefix + gates)", () => {
    const without = assembleBundle(base, FULL_PROFILE);
    const withUndef = assembleBundle({ ...base, corpus: undefined }, FULL_PROFILE);
    expect(withUndef).toBe(without);
  });

  it("a provided corpus is injected as a fenced 'Grounded examples' section", () => {
    const marker = "GROUNDED_MARKER_9x_@srenestrawberry";
    const grounded = assembleBundle({ ...base, corpus: marker }, FULL_PROFILE);
    const plain = assembleBundle(base, FULL_PROFILE);
    expect(grounded).toContain("Grounded examples");
    expect(grounded).toContain(marker);
    expect(grounded).toContain(VOICE_FENCE_OPEN);
    expect(grounded).toContain(VOICE_FENCE_CLOSE);
    // additive: the ungrounded bundle carries neither the label nor the marker
    expect(plain).not.toContain(marker);
    expect(plain).not.toContain("Grounded examples");
  });
});

// ─── anchor contract (Stage A, N-7) — the fence label states the anchor's ROLE ──

describe("assembleBundle anchor contract", () => {
  const HOOK = "Stop trying to wake up at 5 AM.";

  it("script mode names the anchor's contract (MUST open from this hook)", () => {
    const bundle = assembleBundle(
      { ask: "Write a script for this hook", platform: "tiktok", mode: "script", anchor: HOOK },
      FULL_PROFILE,
    );
    expect(bundle).toContain("Anchor hook — REQUIRED: the script MUST open from this exact hook");
    expect(bundle).toContain(HOOK);
  });

  it("hooks mode names the anchor as the idea the hooks develop", () => {
    const bundle = assembleBundle(
      { ask: "hooks please", platform: "tiktok", mode: "hooks", anchor: "meal-prep for night shifts" },
      FULL_PROFILE,
    );
    expect(bundle).toContain("Chain anchor — the chosen idea these hooks develop");
  });

  it("chat mode keeps the bare label (recent-turns context, no generation contract)", () => {
    const bundle = assembleBundle(
      { ask: "what should I post", platform: "tiktok", mode: "chat", anchor: "prior turns here" },
      FULL_PROFILE,
    );
    expect(bundle).toContain("Chain anchor:");
    expect(bundle).not.toContain("MUST open from");
  });

  it("the contract label survives the 4b overflow rebuild (fence intact, label intact)", () => {
    // A huge ANCHOR forces the 4b rebuild; the ask keeps its budget, the anchor section is
    // truncated INSIDE the fence — but its contract label must survive with it.
    const bundle = assembleBundle(
      {
        ask: "Write a script for this hook",
        platform: "tiktok",
        mode: "script",
        anchor: `${HOOK} ${"z".repeat(5000)}`,
      },
      FULL_PROFILE,
    );
    expect(bundle.length).toBeLessThanOrEqual(VOICE_ON_TOP_CAP);
    expect(bundle).toContain("Anchor hook — REQUIRED");
  });
});

// ─── rewrite pack (Stage B, B2) — the cards already on screen ───────────────────
//
// "Punch these up" used to reach the pipeline as a bare sentence, so the run generated five
// strangers instead of sharper versions of the five hooks the creator was looking at. The pack now
// arrives as data, and the CONTRACT rides in the fence label for the same reason the anchor's does:
// the compiled system prompts cannot know about per-request content, so a bare list of lines would
// be read as context to draw on rather than as items owed a rewrite.

describe("assembleBundle rewrite pack (cards)", () => {
  const HOOKS = ["I quit caffeine for 30 days", "Your 5 AM alarm is the problem"];

  it("fences the pack as a NUMBERED list under a rewrite contract", () => {
    const bundle = assembleBundle(
      { ask: "punch these up", platform: "tiktok", mode: "hooks", cards: HOOKS },
      FULL_PROFILE,
    );
    expect(bundle).toContain("Cards to improve");
    expect(bundle).toContain("REWRITE these exact hooks");
    expect(bundle).toContain("1. I quit caffeine for 30 days");
    expect(bundle).toContain("2. Your 5 AM alarm is the problem");
  });

  it("names the right noun per mode — the contract has to be concrete to be followed", () => {
    const ideas = assembleBundle(
      { ask: "sharper angles", platform: "tiktok", mode: "idea", cards: ["morning routines"] },
      FULL_PROFILE,
    );
    const script = assembleBundle(
      { ask: "punchier", platform: "tiktok", mode: "script", cards: ["Hook: stop scrolling"] },
      FULL_PROFILE,
    );
    expect(ideas).toContain("REWRITE these exact ideas");
    // A script pack is the BEATS of the one script on screen, and the label has to say so — the
    // numbered lines are "Hook: …", "Turn: …", not a stack of whole scripts.
    expect(script).toContain("REWRITE these exact script beats");
    expect(script).toContain("never replace one with an unrelated new script beat");
  });

  it("forbids swapping an item for an unrelated new one — the measured defect, stated in the fence", () => {
    const bundle = assembleBundle(
      { ask: "punch these up", platform: "tiktok", mode: "hooks", cards: HOOKS },
      FULL_PROFILE,
    );
    expect(bundle).toContain("never replace one with an unrelated new hook");
  });

  it("rides ALONGSIDE an anchor without inheriting its opening contract", () => {
    // The distinction is load-bearing: the anchor says "open from this exact line" and is checked
    // for it downstream; a rewrite pack carries no such promise. Folding the pack into the anchor
    // slot would make every rewrite trip the anchor-honouring check.
    const bundle = assembleBundle(
      {
        ask: "punchier",
        platform: "tiktok",
        mode: "script",
        anchor: "Stop trying to wake up at 5 AM.",
        cards: ["Hook: stop scrolling"],
      },
      FULL_PROFILE,
    );
    expect(bundle).toContain("Anchor hook — REQUIRED");
    expect(bundle).toContain("Cards to improve");
  });

  it("is absent entirely from an ordinary run", () => {
    const bundle = assembleBundle(
      { ask: "5 hooks about sleep", platform: "tiktok", mode: "hooks" },
      FULL_PROFILE,
    );
    expect(bundle).not.toContain("Cards to improve");
  });

  it("REJECTS a pack over the fence budget rather than silently truncating it", () => {
    // The cap is the schema's, not a slice: a 7th card that vanished without a word would leave the
    // creator looking at a card the run never saw and no sign that it was dropped. The loop caps at
    // the same 6 before it ever gets here, so this asserts the two agree.
    expect(() =>
      assembleBundle(
        { ask: "punch these up", platform: "tiktok", mode: "hooks", cards: [...Array(7)].map((_, i) => `card ${i}`) },
        FULL_PROFILE,
      ),
    ).toThrow(/invalid input/);
  });

  it("survives the overflow rebuild with its contract label intact", () => {
    const bundle = assembleBundle(
      {
        ask: "punch these up",
        platform: "tiktok",
        mode: "hooks",
        cards: [`${HOOKS[0]} ${"z".repeat(5000)}`],
      },
      FULL_PROFILE,
    );
    expect(bundle.length).toBeLessThanOrEqual(VOICE_ON_TOP_CAP);
    expect(bundle).toContain("Cards to improve");
  });
});
