/**
 * The audio-mix invariant — the guard that goes where the code actually runs.
 *
 * The cases below are not invented. They are the four back-to-back reads measured on
 * 2026-08-05 against one 28.6s clip whose audio is 97.6% speech (ffmpeg silencedetect found
 * 0.69s of silence in 28.57s), same prompt, temperature 0, seeded. Run 2 is the reason this
 * guard is not simply a sum check: it sums to exactly 1.00 and is still nonsense.
 */
import { describe, it, expect } from "vitest";
import {
  AUDIO_MIX_TOLERANCE,
  audioMixViolation,
  blankAudioMix,
  hasSpeechEvidence,
} from "../qwen/audio-mix";

/** The clip is a two-hander comedy skit; every read of it transcribed the opening line. */
const SPOKE = { first_words_speech_score: 9, spoken_words: "My best friend is Emily Rose Johnson." };
/** A genuinely silent / music-only track: no speech score, no verbatim. */
const SILENT = { first_words_speech_score: null, spoken_words: null };

describe("audioMixViolation — the four measured reads", () => {
  it("run 1 (unified, correct) passes: 0.05 / 0.90 / 0.05", () => {
    expect(audioMixViolation(
      { silence_ratio: 0.05, voiceover_ratio: 0.9, music_ratio: 0.05 }, SPOKE,
    )).toBeNull();
  });

  it("run 2 (unified) is caught: sums to 1.00 but calls a pure-dialogue skit 95% music", () => {
    const reason = audioMixViolation(
      { silence_ratio: 0.05, voiceover_ratio: 0, music_ratio: 0.95 }, SPOKE,
    );
    // The sum check alone would wave this through — 0.05 + 0 + 0.95 === 1.0 exactly.
    expect(0.05 + 0 + 0.95).toBe(1);
    expect(reason).toMatch(/voiceover_ratio is 0 on a read that reports speech/);
  });

  it("run 3 (unified) is caught by the sum: 0.05 / 0 / 0 = 0.05", () => {
    expect(audioMixViolation(
      { silence_ratio: 0.05, voiceover_ratio: 0, music_ratio: 0 }, SPOKE,
    )).toMatch(/sum to 0\.05, not ~1\.0/);
  });

  it("run 4 (split audio leg, correct on all four runs) passes: 0.05 / 0.95 / 0", () => {
    expect(audioMixViolation(
      { silence_ratio: 0.05, voiceover_ratio: 0.95, music_ratio: 0 }, SPOKE,
    )).toBeNull();
  });
});

describe("audioMixViolation — what it must NOT flag", () => {
  it("a music-only track with 0 voice is legitimate when nothing attests to speech", () => {
    expect(audioMixViolation(
      { silence_ratio: 0.1, voiceover_ratio: 0, music_ratio: 0.9 }, SILENT,
    )).toBeNull();
  });

  it("an already-blanked mix is honest and must not trigger another retry", () => {
    expect(audioMixViolation(
      { silence_ratio: null, voiceover_ratio: null, music_ratio: null }, SPOKE,
    )).toBeNull();
  });

  it("accepts drift inside the stated ±0.1 tolerance", () => {
    const sum = 1 - AUDIO_MIX_TOLERANCE / 2;
    expect(audioMixViolation(
      { silence_ratio: 0.05, voiceover_ratio: sum - 0.05, music_ratio: 0 }, SPOKE,
    )).toBeNull();
  });
});

describe("audioMixViolation — partial and malformed", () => {
  it("rejects a PARTIAL triple: null is only ever honest when all three are", () => {
    expect(audioMixViolation(
      { silence_ratio: 0.05, voiceover_ratio: null, music_ratio: 0.95 }, SPOKE,
    )).toMatch(/partially absent/);
  });

  it("rejects a mix that overshoots 1.0", () => {
    expect(audioMixViolation(
      { silence_ratio: 0.5, voiceover_ratio: 0.9, music_ratio: 0.3 }, SPOKE,
    )).toMatch(/sum to 1\.70/);
  });
});

describe("hasSpeechEvidence — read from the response, never from the ratios", () => {
  it("a verbatim transcript alone is evidence", () => {
    expect(hasSpeechEvidence({ first_words_speech_score: null, spoken_words: "hello there" })).toBe(true);
  });

  it("a speech score alone is evidence, including a score of 0 (present but terrible)", () => {
    expect(hasSpeechEvidence({ first_words_speech_score: 0, spoken_words: null })).toBe(true);
  });

  it("whitespace is not a transcript", () => {
    expect(hasSpeechEvidence({ first_words_speech_score: null, spoken_words: "   " })).toBe(false);
  });

  it("undefined fields (absent, not null) are not evidence", () => {
    expect(hasSpeechEvidence({ first_words_speech_score: undefined, spoken_words: undefined })).toBe(false);
  });
});

describe("blankAudioMix", () => {
  it("nulls all three ratios together and leaves every other observation intact", () => {
    const signals = {
      voice_clarity_0_10: 9,
      audio_hook_first_2s_0_10: 9,
      silence_ratio: 0.05,
      voiceover_ratio: 0,
      music_ratio: 0.95,
      audio_description: "Two men trading punchlines about their best friends.",
    };
    const out = blankAudioMix(signals);
    expect(out.silence_ratio).toBeNull();
    expect(out.voiceover_ratio).toBeNull();
    expect(out.music_ratio).toBeNull();
    // The model being wrong about proportions is not evidence it misheard the content.
    expect(out.voice_clarity_0_10).toBe(9);
    expect(out.audio_hook_first_2s_0_10).toBe(9);
    expect(out.audio_description).toBe(signals.audio_description);
  });

  it("does not mutate its input", () => {
    const signals = { silence_ratio: 0.05, voiceover_ratio: 0, music_ratio: 0.95 };
    blankAudioMix(signals);
    expect(signals.voiceover_ratio).toBe(0);
  });

  it("produces a value the guard then reads as honest, not as a fresh violation", () => {
    const blanked = blankAudioMix({ silence_ratio: 0.05, voiceover_ratio: 0, music_ratio: 0 });
    expect(audioMixViolation(blanked, SPOKE)).toBeNull();
  });
});
