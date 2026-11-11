/**
 * compile.test.ts — the compiler, judged by OpenFilm's own reader.
 *
 * The load-bearing assertion is `readFilmFile(...).problems` being empty, read by the same code the renderer and
 * the in-page player use. It checks a film's form (attributes, ids, times, fades against their clip's length); it
 * does NOT check two clips overlapping on a track, a clip longer than its file, or a path outside the folder. Those,
 * with frame-floored `at`s and nothing past the film's end, are `filmFaults` (film-rules.ts), run on the fixture and
 * on the edge cases below; one test breaks a film by hand to see each rule fire. The expected film.html is also kept
 * as a file snapshot, so any change to the output shows up as a diff to read.
 *
 * Nothing of ours is mocked. The reader is the real one from the pinned package.
 */
import { readFilmFile } from "openfilm/film-doc";
import { describe, expect, it } from "vitest";
import { EditSpecError } from "../check";
import { compile, type Compiled } from "../compile";
import { cuesOf } from "../compile/captions";
import { boxOf } from "../compile/main";
import type { EditSpec } from "../spec";
import { frameMs } from "../time";
import { filmFaults } from "./film-rules";
import { file, fixture } from "./fixture";

/** A clip as the reader gives it: `src` is the file alone, the `#t=` window is `time`. */
type Clip = { id: string; src: string; at?: number; time?: number[]; speed?: number; overrides?: { at?: string; text?: string; fade?: number[]; style?: Record<string, string> }[] };

/** The film as OpenFilm reads it: its problems and every clip by id, with the index of its track (0 is on top). */
function read(text: string): { problems: string[]; clips: Map<string, Clip & { track: number }>; keyframes: string[] } {
  const result = readFilmFile(text);
  const clips = new Map<string, Clip & { track: number }>();
  const tracks = (result.value?.tracks ?? []) as unknown as { clips?: Clip[] }[];
  tracks.forEach((track, index) => {
    for (const clip of track.clips ?? []) clips.set(clip.id, { ...clip, track: index });
  });
  const keyframes = (result.value as unknown as { keyframes?: Record<string, unknown> } | undefined)?.keyframes ?? {};
  return { problems: result.problems, clips, keyframes: Object.keys(keyframes) };
}

const get = (clips: Map<string, Clip & { track: number }>, id: string): Clip & { track: number } => {
  const clip = clips.get(id);
  if (!clip) throw new Error(`the film has no clip "${id}"`);
  return clip;
};

/** Where a clip ends on the film, in whole milliseconds: its start plus its part of the file at its speed. */
const endMs = (clip: Clip): number => {
  const [t0 = 0, t1 = 0] = clip.time ?? [];
  return Math.round(((clip.at ?? 0) + (t1 - t0) / (clip.speed ?? 1)) * 1000);
};

describe("compile", () => {
  const out = compile(fixture(), { file });
  const film = read(out.files["film.html"]);

  it("makes a film OpenFilm's reader accepts with no problems", () => {
    expect(film.problems).toEqual([]);
  });

  it("keeps the rules the reader cannot check: no overlap on a track, every clip inside its file and the film, every file in the folder", () => {
    expect(filmFaults(fixture(), out)).toEqual([]);
  });

  it("has a guard for those rules that finds each one broken by hand", () => {
    /** The fixture's film with `from`, which it holds exactly once, written as `to`. */
    const broken = (from: string, to: string): Compiled => {
      const html = out.files["film.html"];
      expect(html.split(from)).toHaveLength(2);
      return { ...out, files: { ...out.files, "film.html": html.replace(from, to) } };
    };
    const cases: [from: string, to: string, fault: RegExp][] = [
      ['id="seg-s2" src="assets/take.mp4#t=1.866,3.633" at="1.866"', 'id="seg-s2" src="assets/take.mp4#t=1.866,3.633" at="1.5"', /seg-s2 starts at 1\.5 s, before seg-s1 ends/],
      ['src="kit/v1/sfx/kick.m4a#t=0,0.45"', 'src="kit/v1/sfx/kick.m4a#t=0,0.5"', /^snd-k1 .* past the file's length/],
      ['src="kit/v1/sfx/kick.m4a#t=0,0.45"', 'src="kit/v1/sfx/kick.m4a#t=0,0.451"', /^snd-k1 .* plays its file to 0\.451 s, past its end at 0\.45 s/], // the 1 ms the engine lets pass
      ['src="assets/photo.jpg#t=0,1"', 'src="assets/sticker.png#t=0,1"', /^lay-l1 .* not one of the files the compile lists/],
      ['src="captions.vtt"', 'src="subs.vtt"', /^track 0: its captions read "subs.vtt"/],
      ['src="assets/take.mp4#t=0,1.866"', 'src="https://cdn.invalid/take.mp4#t=0,1.866"', /^seg-s1 .* not under assets\/ or kit\/v1\//],
      ['at="1.866" volume="0.6"', 'at="1.8665" volume="0.6"', /^at="1\.8665" is not the floored millisecond of a frame/],
      ['at="1.866" volume="0.6"', 'at="1.867" volume="0.6"', /^at="1\.867" is not the floored millisecond of a frame/], // rounded, not floored
      ['src="kit/v1/text.html#t=0,1.6"', 'src="kit/v1/text.html#t=0,2"', /^txt-t2 .* after the film's end/],
    ];
    for (const [from, to, fault] of cases) expect(filmFaults(fixture(), broken(from, to))).toEqual([expect.stringMatching(fault)]);
  });

  it("is the same bytes for the same document", () => {
    expect(compile(fixture(), { file })).toEqual(out);
  });

  it("matches the film kept on file", async () => {
    await expect(out.files["film.html"]).toMatchFileSnapshot("./__snapshots__/fixture.film.html");
    await expect(out.files["captions.vtt"]).toMatchFileSnapshot("./__snapshots__/fixture.captions.vtt");
  });

  it("says the film's length and which files the folder needs, leaving kit files out", () => {
    expect(out.frames).toBe(298);
    expect(out.kit).toBe("v1");
    expect(out.assets).toEqual([
      { id: "take", file: "assets/take.mp4" },
      { id: "broll", file: "assets/broll.mp4" },
      { id: "photo", file: "assets/photo.jpg" },
      { id: "song", file: "assets/song.mp3" },
    ]);
    expect(get(film.clips, "snd-k1").src).toBe("kit/v1/sfx/kick.m4a");
  });

  it("starts every segment on its frame, floored to the millisecond", () => {
    expect(get(film.clips, "seg-s1").at ?? 0).toBe(0);
    expect(get(film.clips, "seg-s2").at).toBe(frameMs(56) / 1000);
    expect(get(film.clips, "seg-s4").at).toBe(frameMs(163) / 1000);
    expect(get(film.clips, "seg-s5").at).toBe(frameMs(208) / 1000);
    expect(get(film.clips, "seg-s2").time).toEqual([1.866, 3.633]); // 1.866 + 1.567 s, plus the dissolve's 0.2 s tail
  });

  it("dissolves by overlapping on two tracks, and only the upper clip fades", () => {
    const outgoing = get(film.clips, "seg-s2");
    const incoming = get(film.clips, "seg-s3");
    expect(incoming.track).toBeLessThan(outgoing.track); // a lower index is drawn on top
    expect(incoming.at).toBe(frameMs(103 - 6) / 1000); // six frames before the cut
    expect(incoming.time?.[0]).toBe(0.8); // 1000 ms in-point less the 200 ms lead-in
    expect(incoming.overrides).toEqual([{ fade: [0.4, 0] }]); // 12 frames
    expect(outgoing.overrides).toBeUndefined();
  });

  it("fits a clip's fades in the clip, which flooring its source can leave a few ms short of its frames", () => {
    /* s3 slowed to 0.3 and 22 frames long, a dip to black on both sides: its frames last 733 ms, its 219 ms of source 730 */
    const dip = fixture();
    dip.main[1]!.cutOut = { kind: "fade", style: "dip-black", len: 22 };
    const s3 = dip.main[2]!;
    s3.len = 22;
    s3.speed = 0.3;
    s3.cutOut = { kind: "fade", style: "dip-black", len: 22 };
    const cover = structuredClone(dip);
    cover.main[2]!.fit = "cover";
    /* s3 on main B, taking a dissolve in and giving one out, slowed to 0.25: its two fades are the whole clip */
    const through = fixture();
    through.main[1]!.cutOut = { kind: "fade", style: "dissolve", len: 10 };
    const b = through.main[2]!;
    b.len = 10;
    b.speed = 0.25;
    b.cutOut = { kind: "fade", style: "dissolve", len: 10 };

    const cases: [EditSpec, string[]][] = [[cover, ["seg-s3"]], [dip, ["seg-s3", "blur-s3"]], [through, ["seg-s3", "blur-s3"]]];
    const films = cases.map(([spec, ids]) => {
      const compiled = compile(spec, { file });
      const result = read(compiled.files["film.html"]);
      expect(result.problems).toEqual([]);
      expect(filmFaults(spec, compiled)).toEqual([]);
      for (const id of ids) {
        const clip = get(result.clips, id);
        const [fadeIn = 0, fadeOut = 0] = clip.overrides?.[0]?.fade ?? [];
        const [t0 = 0, t1 = 0] = clip.time ?? [];
        expect(fadeIn + fadeOut).toBeLessThanOrEqual((t1 - t0) / (clip.speed ?? 1) + 1e-9);
      }
      return result;
    });
    expect(get(films[2]!.clips, "seg-s3").track).toBeLessThan(get(films[2]!.clips, "seg-s2").track); // on main B
  });

  it("puts a wipe page over its cut, centred, in its colour", () => {
    const wipe = get(film.clips, "wipe-s3");
    expect(wipe.src).toBe("kit/v1/wipes/shutter.html");
    expect(wipe.time).toEqual([0, 0.8]); // the page's own 24 frames
    expect(wipe.at).toBe(frameMs(163 - 12) / 1000);
    expect(wipe.overrides).toEqual([{ at: "html", style: { "--color": "#ff6363" } }]);
  });

  it("shows a landscape clip whole over a blurred copy of itself", () => {
    expect(boxOf({ w: 1280, h: 720 } as never, { zoom: 1, x: 0, y: 0 }, true)).toEqual({ left: 0, top: 656, width: 1080, height: 608 });
    expect(boxOf({ w: 1280, h: 720 } as never, { zoom: 1, x: 0, y: 0 }, false)).toEqual({ left: -1166, top: 0, width: 3413, height: 1920 });
    expect(film.clips.has("blur-s3")).toBe(true);
    /* directly beneath its own clip and above the outgoing one, so picture and fill dissolve in together */
    expect(get(film.clips, "blur-s3").track).toBe(get(film.clips, "seg-s3").track + 1);
    expect(get(film.clips, "blur-s3").track).toBeLessThan(get(film.clips, "seg-s2").track);
    expect(get(film.clips, "blur-s3").overrides).toEqual(get(film.clips, "seg-s3").overrides);
    expect(out.files["film.html"]).toContain("filter: blur(40px) brightness(.7)");
  });

  it("punches in around the framing's point", () => {
    expect(boxOf({ w: 1080, h: 1920 } as never, { zoom: 1.3, x: 0, y: -0.24 }, false)).toEqual({ left: -162, top: -219, width: 1404, height: 2496 });
  });

  it("gives a still its length, a move its keyframes and a filter its CSS", () => {
    expect(get(film.clips, "seg-s4").src).toBe("assets/photo.jpg");
    expect(get(film.clips, "seg-s4").time).toEqual([0, 1.5]);
    expect(film.keyframes).toEqual(["mv-push-in-50"]);
    expect(out.files["film.html"]).toContain("animation: mv-push-in-50 var(--clip-length) linear both");
    expect(out.files["film.html"]).toContain("filter: grayscale(1) contrast(1.08)");
  });

  it("carries a text's words and look in the clip, so the reader gives them back", () => {
    const text = get(film.clips, "txt-t1");
    expect(text.src).toBe("kit/v1/text.html");
    expect(text.time).toEqual([0, 1.866]);
    expect(text.overrides?.[0]?.text).toBe("POV: back in the booth");
    expect(text.overrides?.[0]?.style?.["--fill"]).toBe("#ffffff");
    expect(text.overrides?.[0]?.style?.["--len"]).toBe("1.866");
  });

  it("cuts off what runs past the film's end", () => {
    /** The fixture with a text, a layer and a sound that end on the film's end (frame 298), or run `past` frames beyond it. */
    const ending = (past: number): EditSpec => {
      const spec = fixture();
      spec.texts[1]!.len = 48 + past; // t2: from frame 250
      spec.layers[0]!.at = 280; // l1: from frame 280
      spec.layers[0]!.len = 18 + past;
      spec.sounds[1]!.len = 298 + past; // m1: from frame 0
      return spec;
    };
    const cut = compile(ending(40), { file });
    expect(cut).toEqual(compile(ending(0), { file }));
    const clips = read(cut.files["film.html"]).clips;
    for (const id of ["txt-t2", "lay-l1", "snd-m1"]) expect(endMs(get(clips, id))).toBe(frameMs(298));
    expect(get(clips, "txt-t2").time).toEqual([0, (frameMs(298) - frameMs(250)) / 1000]);
    /* the film's length as the engine reckons it, its latest clip's end, is its frames */
    expect(Math.max(...[...clips.values()].map(endMs))).toBe(frameMs(cut.frames));
    expect(filmFaults(ending(40), cut)).toEqual([]);

    /* a wipe on a cut 5 frames before the end: the shutter's 24 frames, centred on the cut, would run 7 past it */
    const wiped = fixture();
    wiped.main[3]!.cutOut = { kind: "wipe", id: "shutter" };
    wiped.main[4]!.len = 5;
    const short = compile(wiped, { file });
    const shortClips = read(short.files["film.html"]).clips;
    expect(short.frames).toBe(213);
    expect(endMs(get(shortClips, "wipe-s4"))).toBe(frameMs(213));
    expect(Math.max(...[...shortClips.values()].map(endMs))).toBe(frameMs(213));
    expect(filmFaults(wiped, short)).toEqual([]);
  });

  it("ends a sound when its file does, and fades the music out", () => {
    expect(get(film.clips, "snd-k1").time).toEqual([0, 0.45]); // 14 frames asked, the file is 450 ms
    expect(get(film.clips, "snd-m1").overrides).toEqual([{ fade: [0, 1] }]); // 30 frames
  });

  it("stacks layers by z: of two that overlap, the higher is nearer the top, and at equal z the later in the document", () => {
    const layered = (layers: [id: string, at: number, len: number, z: number][]): EditSpec => {
      const spec = fixture();
      const base = spec.layers[0]!;
      spec.layers = layers.map(([id, at, len, z]) => ({ ...base, id, at, len, z }));
      return spec;
    };
    /** Every two layers that overlap on the film and are stacked the wrong way up. */
    const upsideDown = (spec: EditSpec): string[] => {
      const { clips } = read(compile(spec, { file }).files["film.html"]);
      const place = (id: string): { track: number; from: number; to: number } => {
        const clip = get(clips, `lay-${id}`);
        const [t0 = 0, t1 = 0] = clip.time ?? [];
        return { track: clip.track, from: clip.at ?? 0, to: (clip.at ?? 0) + (t1 - t0) / (clip.speed ?? 1) };
      };
      const out: string[] = [];
      spec.layers.forEach((upper, i) => spec.layers.forEach((lower, j) => {
        if (!(upper.z > lower.z || (upper.z === lower.z && i > j))) return; // equal z: painter's order, the later on top
        const a = place(upper.id);
        const b = place(lower.id);
        if (a.from < b.to && b.from < a.to && a.track > b.track) out.push(`${upper.id} (z ${upper.z}) is below ${lower.id} (z ${lower.z})`);
      }));
      return out;
    };
    const stepped = layered([["hi", 0, 10, 3], ["mid", 5, 10, 2], ["lo", 12, 8, 1]]);
    expect(upsideDown(stepped)).toEqual([]);
    const mixed = layered([["a", 5, 10, 2], ["top", 0, 10, 3], ["b", 12, 8, 2], ["floor", 0, 30, -1], ["late", 25, 5, 5]]);
    expect(upsideDown(mixed)).toEqual([]);
    for (const spec of [stepped, mixed]) expect(filmFaults(spec, compile(spec, { file }))).toEqual([]);
    expect(compile(structuredClone(mixed), { file })).toEqual(compile(mixed, { file }));
  });

  it("keeps the head the same across an edit, apart from the keyframes", () => {
    const edited = fixture();
    edited.main[0]!.len = 40;
    edited.texts[0]!.text = "changed";
    const head = (text: string): string => text.slice(0, text.indexOf("</head>"));
    expect(head(compile(edited, { file }).files["film.html"])).toBe(head(out.files["film.html"]));
  });

  it("refuses a document that fails the checks", () => {
    const broken = fixture();
    broken.main[0]!.asset = "nope";
    expect(() => compile(broken, { file })).toThrow(EditSpecError);
  });
});

describe("captions", () => {
  it("are worked out from the words on the film, with the corrections applied", () => {
    const cues = cuesOf(fixture());
    const lines = cues.map((cue) => cue.words.map((w) => w.text).join(" "));
    expect(lines).toEqual([
      "Hello guys, we", "are back in",           // s1: the take's first 1.866 s
      "the booth again.",                         // s2
      "Virtuna App will", "soon be available.",   // s5, "Bertuna" corrected
    ]);
  });

  it("stay inside the segment that says them, one line at a time", () => {
    const cues = cuesOf(fixture());
    cues.forEach((cue, i) => {
      expect(cue.end).toBeGreaterThan(cue.start);
      const next = cues[i + 1];
      if (next) expect(cue.end).toBeLessThanOrEqual(next.start);
      for (const word of cue.words) expect(word.at >= cue.start && word.at < cue.end).toBe(true);
    });
    expect(cues[2]?.start).toBe(frameMs(56)); // "the" starts 6 ms before the cut in the take: held to the segment's start
    expect(cues[3]?.start).toBe(frameMs(208));
  });

  it("end where the film ends, a voiceover's too", () => {
    /** The fixture with a voiceover file of 20 words, one every 290 ms, and a voiceover of 120 frames at each frame given. */
    const voiced = (...frames: number[]): EditSpec => {
      const spec = fixture();
      spec.assets.vo = {
        id: "vo", kind: "audio", origin: "uploaded", at: { bucket: "takes", path: "u1/vo.m4a" }, ms: 6000, sound: true,
        words: Array.from({ length: 20 }, (_, i) => ({ t0: i * 290, t1: i * 290 + 270, text: `w${i}` })),
      };
      frames.forEach((at, i) => spec.sounds.push({ id: `v${i}`, pin: null, at, len: 120, role: "voiceover", asset: "vo", inMs: 0, volume: 1, fadeIn: 0, fadeOut: 0 }));
      return spec;
    };
    const end = frameMs(298);
    const past = voiced(270); // its 120 frames run 92 past the film's end
    expect(cuesOf(past).filter((cue) => cue.start >= end || cue.end > end)).toEqual([]);
    expect(cuesOf(voiced(270, 298, 320))).toEqual(cuesOf(past)); // one starting at the film's end, one after it: no cue
    for (const spec of [past, voiced(270, 298, 320)]) expect(filmFaults(spec, compile(spec, { file }))).toEqual([]);
  });

  it("follow a trim without being made again, and a hidden word is gone", () => {
    const spec = fixture();
    spec.main[4]!.inMs = 9050; // s5 now starts at "App"
    spec.captions.fixes.take!["20"] = null;
    const lines = cuesOf(spec).map((cue) => cue.words.map((w) => w.text).join(" "));
    expect(lines.slice(3)).toEqual(["will soon be", "available.", "Stay"]); // a sentence end closes a line
  });

  it("write a caption track only when they are on and there is something to show", () => {
    const off = fixture();
    off.captions.on = false;
    const film = compile(off, { file });
    expect(film.files["captions.vtt"]).toBeUndefined();
    expect(film.files["film.html"]).not.toContain("<track");
    expect(readFilmFile(film.files["film.html"]).problems).toEqual([]);
  });

  it("escape what WebVTT would read as markup", () => {
    const spec = fixture();
    spec.captions.fixes.take!["0"] = "<Hi> & co";
    expect(compile(spec, { file }).files["captions.vtt"]).toContain("&lt;Hi&gt; &amp; co");
  });

  it("keep every word on its cue's one line, so a line break can neither end a cue nor add one", () => {
    for (const fix of ["Hi\n\nthere", "x\n\nc9\n00:00:00.000 --> 00:00:09.000\nINJECTED"]) {
      const spec = fixture();
      spec.captions.fixes.take!["0"] = fix;
      const out = compile(spec, { file });
      const cues = cuesOf(spec);
      const blocks = out.files["captions.vtt"]!.replace(/\n$/, "").split("\n\n").slice(2); // after WEBVTT and STYLE
      expect(blocks).toHaveLength(cues.length);
      for (const block of blocks) expect(block.split("\n")).toHaveLength(3); // its id, its times, its words
      for (const cue of cues) for (const word of cue.words) expect(word.text).not.toMatch(/[\r\n]/);
      expect(readFilmFile(out.files["film.html"]).problems).toEqual([]);
    }
    /* a word with nothing left once its white space is gone is hidden, as a word fixed to null is */
    const blank = fixture();
    blank.captions.fixes.take!["0"] = " \n\t ";
    const hidden = fixture();
    hidden.captions.fixes.take!["0"] = null;
    expect(cuesOf(blank)).toEqual(cuesOf(hidden));
  });
});
