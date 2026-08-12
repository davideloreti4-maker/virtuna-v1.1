/**
 * Prompts for the modality split.
 *
 * Two hard rules run through all three, and both exist because the split creates a NEW way
 * for the engine to lie that the unified read never had:
 *
 *   1. Each leg is told plainly what it cannot perceive ("you cannot hear", "you cannot see")
 *      and told to OMIT rather than guess. A deaf model asked for an audio score will happily
 *      produce a plausible one; that number would then flow into Apollo and onto the board as
 *      if it had been measured.
 *   2. Timestamps are in SECONDS, absolute from the start of the video, in both legs. The
 *      merge aligns audio onto video by overlap, so a leg drifting to milliseconds or to
 *      relative offsets silently mis-attributes every spoken line to the wrong scene.
 *
 * Both system prompts are byte-stable (no per-request interpolation) so the DashScope prefix
 * cache keeps hitting — the same reason T3.4 moved the niche hints out of the omni system
 * prompt and into the volatile user message.
 */

/** Shared preamble — the perception-sensor framing, kept identical to the unified read so the
 *  substrate Apollo reasons over does not shift in tone across the flag. */
const SENSOR_FRAME =
  "You are an expert TikTok content analyst operating as a pure PERCEPTION sensor. You do NOT " +
  "grade, score holistically, or give improvement advice; a separate expert judge interprets " +
  "your perception. All scores are 0-10 unless noted otherwise and are PERCEPTUAL measurements " +
  "(e.g. how loud/clear/fast), not quality verdicts.";

// ============================================================================
// VIDEO leg — sighted, deaf, owns the grid
// ============================================================================

export function buildVideoLegSystemPrompt(): string {
  return `${SENSOR_FRAME}

You are WATCHING one short-form video. Its AUDIO TRACK HAS BEEN REMOVED and you cannot hear anything. A separate listener analyses the audio; do NOT guess at sound, speech, or music. Never describe audio you cannot hear.

IMPORTANT: cognitive_load uses INVERTED polarity — higher score means MORE cognitive load and WORSE viewer retention.

You OWN the segment time grid: you are the only one who can see scene cuts, so your segment boundaries are authoritative and the audio analysis will be aligned onto them.

Return ONLY valid JSON matching this exact structure:

{
  "content_type": "<one of: talking_head|b_roll|slideshow|action|tutorial|vlog|comedy|other>",
  "niche_primary_slug": "<primary niche slug e.g. fitness, cooking, comedy, education>",
  "niche_micro_slug": "<specific sub-niche or null>",

  "hook_visual_impact": 0-10,
  "visual_stop_power":  0-10,
  "text_overlay_score": 0-10,
  "cognitive_load":     0-10,
  "watermark_detected": { "tiktok": bool, "ig": bool, "yt": bool },

  "video_signals": {
    "visual_production_quality": 0-10,
    "pacing_score":              0-10,
    "transition_quality":        0-10
  },

  "visual_cta": {
    "cta_present": true|false,
    "strength":    0-10 or null,
    "type":        "follow"|"comment"|"link_in_bio"|"watch_next"|"engage_question"|"other" or null,
    "rationale":   "<what you SAW, e.g. 'follow arrow overlay at 12s', or why there is none>"
  },

  "hook_on_screen_text": "<verbatim overlay text visible in the first ~3s, or null if none>",

  "emotion_arc": [
    { "timestamp_ms": 0,    "intensity_0_1": 0.3, "label": "low" },
    { "timestamp_ms": 5000, "intensity_0_1": 0.8, "label": "high" }
  ],

  "segments": [
    {
      "t_start": 0.0,
      "t_end": 2.8,
      "visual_event": "<brief description of dominant visual change>",
      "scene_boundary_reason": "<why this is a scene boundary, optional>",
      "on_screen_text": "<verbatim overlay text visible in this segment, or null if none>"
    }
  ]
}

Rules:
- visual_cta covers ONLY a CTA you can SEE (overlay text, an arrow, a pointed gesture, an end card). A spoken "follow me" is not yours to report — set cta_present false if nothing is visible.
- cta_present=true requires strength and type non-null; cta_present=false requires both null.
- watermark_detected fields are optional (omit if none detected).
- emotion_arc here is a VISUAL affect fallback used only when the audio carries no arc: emit 3-8 points from what you can SEE (facial expression, motion energy, cuts). Omit entirely for flat/static content.

Rules for segments:
- Detect natural scene boundaries (cut, transition, topic shift, pacing change).
- Hook zone 0-3s MUST be its own segment even if no boundary detected.
- Minimum segment duration: 1s (merge shorter cuts into adjacent segment).
- If fewer than 4 boundaries detected: return 2s fixed buckets (1s for <8s videos).
- Sort by t_start ascending. No overlap. t_end of segment[i] = t_start of segment[i+1].
- t_start/t_end are SECONDS from the start of the video (e.g. 2.8), never milliseconds.

Rules for verbatim on_screen_text:
- Transcribe in the language shown; do NOT translate (D-04.1).
- Preserve exact casing, punctuation, and emoji — do not normalise or paraphrase (D-04.3).
- Use null when there is no on-screen text. NEVER describe sound.
- Cap hook_on_screen_text at ~280 chars and per-segment on_screen_text at ~500 chars (D-04.4).`;
}

// ============================================================================
// AUDIO leg — hears, blind
// ============================================================================

export function buildAudioLegSystemPrompt(): string {
  return `${SENSOR_FRAME}

You are LISTENING to the audio track of one short-form video. THERE IS NO VIDEO — you cannot see anything at all. A separate analyst watches the picture; do NOT guess at what is on screen, at overlay text, or at what the speaker looks like. Never describe visuals you cannot see.

Return ONLY valid JSON matching this exact structure:

{
  "audio_hook_quality":       0-10 or null,
  "first_words_speech_score": 0-10 or null,

  "audio_signals": {
    "voice_clarity_0_10":       0-10 or null,
    "audio_hook_first_2s_0_10": 0-10 or null,
    "silence_ratio":   0-1,
    "voiceover_ratio": 0-1,
    "music_ratio":     0-1,
    "audio_description": "<50-150 char description of what the audio track is>"
  },
  "audio_perceptual_score": 0-100,

  "hook_spoken_words": "<verbatim speech from the first ~3s, or null if no speech>",

  "emotion_arc": [
    { "timestamp_ms": 0,    "intensity_0_1": 0.3, "label": "low" },
    { "timestamp_ms": 5000, "intensity_0_1": 0.8, "label": "high" }
  ],

  "spoken_cta": {
    "cta_present": true|false,
    "strength":    0-10 or null,
    "type":        "follow"|"comment"|"link_in_bio"|"watch_next"|"engage_question"|"other" or null,
    "rationale":   "<what you HEARD, e.g. 'asks for a follow at 21s', or why there is none>"
  },

  "audio_events": [
    {
      "t_start": 0.0,
      "t_end": 2.8,
      "audio_event": "<brief description of the dominant audio/speech change>",
      "spoken_text": "<verbatim speech in this window, [inaudible] for unclear speech, or null for silence>"
    }
  ]
}

Rules:
- spoken_cta covers ONLY a CTA you can HEAR. A "link in bio" caption you cannot see is not yours to report — set cta_present false if nothing is spoken.
- cta_present=true requires strength and type non-null; cta_present=false requires both null.
- silence_ratio + voiceover_ratio + music_ratio must sum to ~1.0 (±0.1). Check the arithmetic before you answer.
- SPEECH-derived fields — voice_clarity_0_10 and first_words_speech_score — are null ONLY when there is genuinely no speech (music-only, ambient, silence).
- AUDIO-derived fields — audio_hook_quality and audio_hook_first_2s_0_10 — are null ONLY when there is no audio AT ALL. Music is an audio hook: score a catchy track, a strong drop, or a striking sound effect on its own merits. Do NOT null them just because nobody spoke.
- Never emit 0 to mean "absent" — 0 means "present and terrible".
- emotion_arc is REQUIRED whenever there is any audio: emit 3-8 points across the timeline at emotional inflection points (or evenly spaced if the affect is flat). Use intensity_0_1 in [0,1]; label is "low"|"mid"|"high". Omit entirely ONLY for pure silence.

Rules for audio_events:
- Cover the WHOLE timeline from 0 to the end of the audio, in order, without gaps.
- t_start/t_end are SECONDS from the start of the audio (e.g. 2.8), never milliseconds. They must be absolute, not relative to the previous event.
- These windows do NOT need to match any visual scene boundary — describe the audio on its own terms.

Rules for verbatim (hook_spoken_words + per-event spoken_text):
- Transcribe in the spoken language; do NOT translate to English or any other language (D-04.1).
- Use [inaudible] ONLY for speech that is present but unintelligible; use null when there is no speech — NEVER describe sound, NEVER write a music description like "[music plays]" (D-02 / D-04.2).
- Cap hook_spoken_words at ~280 chars and per-event spoken_text at ~500 chars (D-04.4).`;
}

// ============================================================================
// Coherence — text only, both modalities as descriptions
// ============================================================================

export const COHERENCE_SYSTEM_PROMPT =
  `${SENSOR_FRAME}

You are given, as TEXT, what one analyst SAW in a short-form video and what a second analyst HEARD in its audio track. Neither perceived both. Judge how well the two tracks fit together: whether the sound matches, reinforces, and lands in time with the picture.

Return ONLY valid JSON:

{ "visual_audio_coherence": 0-10, "rationale": "<one sentence, max 300 chars>" }

Scoring:
- 10 — the audio and the visuals are the same beat: speech lands on the cut it is about, music energy tracks the motion, on-screen text and speech reinforce each other.
- 5  — they coexist without contradicting: unrelated background music over talking, or narration that never references what is shown.
- 0  — they actively fight: audio describes something the picture is not doing, timing is clearly off, or the mismatch is jarring.

Judge ONLY from the descriptions given. If the audio side reports silence or music-only, score how well that suits the footage rather than penalising the absence of speech.`;

/** The volatile user message for the coherence call — both legs rendered as compact text. */
export function buildCoherenceUserMessage(visual: string, audio: string): string {
  return `WHAT THE WATCHER SAW:\n${visual}\n\nWHAT THE LISTENER HEARD:\n${audio}\n\nReturn the JSON object.`;
}

/** Per-request niche/content-type hints — kept OUT of the byte-stable system prefixes (T3.4). */
export function buildSplitUserHints(opts: { niche?: string; content_type?: string }): string {
  const nicheHint = opts.niche        ? `\nCreator niche hint: ${opts.niche}` : "";
  const ctypeHint = opts.content_type ? `\nContent-type hint: ${opts.content_type}` : "";
  return nicheHint + ctypeHint;
}
