/**
 * seed-remix-blueprint.ts — write ONE real remix_blueprints row + both frame sets, so the shoot
 * sheet can be exercised end to end without a billed run.
 *
 * ⚠️ THIS WRITES TO THE SHARED PROD DATABASE. dev and prod are one Supabase project. It exists
 * because the only blueprint row in prod is `from_fixed_buckets: true` — it renders the
 * "we couldn't read this video's timing" branch and no beats — so there has never been a real
 * shoot sheet to look at, and phase 3's extraction has never run in production.
 *
 * ⚠️ THE STILLS AND THE EMBED ARE DIFFERENT VIDEOS, on purpose and stated here rather than hidden.
 * The mp4 this extracts from is an orphaned `omni-split/` artifact and no table records its
 * permalink, so its real source URL is unknowable. Inventing one would put a fabricated
 * attribution in a table. Instead `--source` takes a REAL corpus TikTok URL, which is what makes
 * the embed half genuinely exercisable. The row is a plumbing fixture, not a coherent remix.
 *
 * ALWAYS clean up after: `--drop <id>` removes the row and every frame under its prefix.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/seed-remix-blueprint.ts \
 *     --email e2e-test@virtuna.local \
 *     --path "omni-split/59455-447571480576291.mp4" \
 *     --source "https://www.tiktok.com/@maritimeinsight.id/video/7671258420019744021"
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/seed-remix-blueprint.ts --drop <blueprintId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createServiceClient } from "@/lib/supabase/service";
import { extractBeatFrames } from "@/lib/remix/beat-frames";
import { insertBlueprint } from "@/lib/remix/blueprint-repo";
import { SCRUB_PREFIX } from "@/lib/engine/filmstrip/storage";
import type { SourceBlueprint } from "@/lib/engine/remix/blueprint";
import type { AdaptedBeat } from "@/lib/engine/remix/decode-types";

const argv = process.argv.slice(2);
const arg = (flag: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const DROP = arg("--drop");
const EMAIL = arg("--email") ?? "e2e-test@virtuna.local";
const PATH = arg("--path") ?? "omni-split/59455-447571480576291.mp4";
const SOURCE = arg("--source");

/** The probe mp4's real length, so the beats and the scrub grid describe the actual video. */
const DURATION_S = 28.57;

/** Beats over the real video: uneven, a hook cut at the 3s boundary, one long tail. */
const BEATS: SourceBlueprint["beats"] = [
  { index: 0, t_start: 0, t_end: 2.9, duration_s: 2.9, spoken_span_s: 2.9, role: "hook",
    spoken: "Girls talking about their best friend versus guys.",
    on_screen_text: "girls vs guys", visual_event: "talking head, hood up, front yard",
    audio_event: "cold open, no music", cuts: 1, weakness: null },
  { index: 1, t_start: 2.9, t_end: 9.4, duration_s: 6.5, spoken_span_s: 6.5, role: "setup",
    spoken: "She's literally the funniest person I've ever met in my entire life.",
    on_screen_text: null, visual_event: "same frame, wide gestures", audio_event: "",
    cuts: 2, weakness: null },
  { index: 2, t_start: 9.4, t_end: 17.8, duration_s: 8.4, spoken_span_s: 8.4, role: "turn",
    spoken: "Yeah he's alright.",
    on_screen_text: null, visual_event: "hard cut — costume swap to the tank top, flat delivery",
    audio_event: "", cuts: 3, weakness: null },
  { index: 3, t_start: 17.8, t_end: DURATION_S, duration_s: DURATION_S - 17.8, spoken_span_s: null,
    role: "close", spoken: null, on_screen_text: null,
    visual_event: "cuts back and forth, ends on the deadpan", audio_event: "", cuts: 4,
    weakness: null },
];

const SCRIPT: AdaptedBeat[][] = [
  [
    { index: 0, spoken: "Designers reviewing a Figma file versus engineers.", on_screen_text: "design vs eng", shot: "waist-up, phone at eye level, one take" },
    { index: 1, spoken: "This spacing is doing something really special here, genuinely moved me.", on_screen_text: "", shot: "same frame, big gestures, no cut" },
    { index: 2, spoken: "Ship it.", on_screen_text: "", shot: "hard cut, change one layer of clothing, flat delivery" },
    { index: 3, spoken: "Cut between the two twice more and end on the deadpan.", on_screen_text: "", shot: "hold the last frame a beat longer than feels right" },
  ],
];

async function main() {
  const supabase = createServiceClient();

  if (DROP) {
    const { data: flat } = await supabase.storage.from("filmstrips").list(DROP, { limit: 100 });
    const { data: sub } = await supabase.storage.from("filmstrips").list(`${DROP}/${SCRUB_PREFIX}`, { limit: 100 });
    const paths = [
      ...(flat ?? []).filter((f) => f.name.endsWith(".jpg")).map((f) => `${DROP}/${f.name}`),
      ...(sub ?? []).filter((f) => f.name.endsWith(".jpg")).map((f) => `${DROP}/${SCRUB_PREFIX}/${f.name}`),
    ];
    if (paths.length > 0) await supabase.storage.from("filmstrips").remove(paths);
    const { error } = await supabase.from("remix_blueprints").delete().eq("id", DROP);
    if (error) throw new Error(`row delete failed: ${error.message}`);
    console.log(`dropped blueprint ${DROP} and ${paths.length} frame(s)`);
    return;
  }

  if (!SOURCE) throw new Error('pass --source "<a REAL post URL>" — see the header');

  const { data: users, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (userErr) throw new Error(`user lookup failed: ${userErr.message}`);
  const user = users.users.find((u) => u.email === EMAIL);
  if (!user) throw new Error(`no user ${EMAIL}`);

  const blueprintId = `seed${Date.now().toString(36)}`.slice(0, 12);
  const blueprint: SourceBlueprint = {
    duration_s: DURATION_S,
    words_per_second: 2.8,
    has_speech: true,
    from_fixed_buckets: false,
    beats: BEATS,
  };

  await insertBlueprint(supabase, {
    id: blueprintId,
    user_id: user.id,
    thread_id: null,
    source_video_id: SOURCE,
    blueprint,
    script: SCRIPT,
    clip_uris: [],
  });
  console.log(`inserted blueprint ${blueprintId} for ${EMAIL}`);

  const signed = await supabase.storage.from("videos").createSignedUrl(PATH, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`could not sign ${PATH}`);

  const persisted = await extractBeatFrames(signed.data.signedUrl, blueprintId, BEATS, DURATION_S);
  console.log(`frames: ${persisted.beatFrames} beat + ${persisted.scrubFrames} scrub`);
  console.log(`\nblueprintId: ${blueprintId}`);
  console.log(`clean up with: --drop ${blueprintId}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
