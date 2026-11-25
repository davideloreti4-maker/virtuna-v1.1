"""A take's analysis (X39): the take in, its copies and one analysis.json out, beside them in `out_dir`.

Seven stages, one after another (Whisper takes every core, so stages side by side would fight over them):
1. `copies`: the take refused unless it is an MP4 or QuickTime file (uploads are those two only), and
   refused when it is longer than ten minutes (X56), or three for a reference (X98), as soon as it is
   probed, before any copy is made; its facts, its two copies, its poster and its 16 kHz sound
   (`media/transcode.py`), the copies' facts and the length it is stored with (X45). A take cut short
   (an upload that stopped with the index at the front whole: ffprobe gives the whole length, and
   ffmpeg makes copies of what is there without failing) fails here, when the copies play more than a
   second less than the take says it lasts, stream by stream;
2. `words`: its words timed on its sound and its pauses, agreed (X54, `media/words.py`). A take with no
   speech, or no sound, has no words and no pauses, and no text model runs. A reference is never heard: no
   listening model or aligner runs, and it keeps only its pauses (X103);
3. `faces`: the face and the mouth five times a second, on the preview copy (X48, `media/faces.py`);
4. `cuts`: where the picture changes from one shot to the next, on the preview copy (X97, `media/scenes.py`);
5. `picture`: its brightness, saturation and warmth every 500 ms, on the preview copy (X97, `media/picture.py`);
6. `text`: a reference's only: the text on screen at up to 40 moments and the colours in and around each line, on the
   file as uploaded, and the sheet of its frames Qwen judges (X101, Task 9c, `media/text.py`). A creator's own take skips
   it, and its analysis has no `text`;
7. `loudness`: a take's only: the full copy's, as the film plays it (`media/loudness.py`); none for a take without sound.

A reference (X98, part 3) is analysed to be read into a style and dropped: in any language, at most three minutes, not
heard (X103), with its text read (X101), and lighter than a take (Task 9c): it is never rendered, so its copies are the
preview and the sound for speech only (no full copy, no poster), its loudness is not measured (`loudness` None), and its
`files` name the preview, the sound and `sheet.jpg`, the only one stored (`store.analyse_job`).

`on_progress(stage, share)` is told each stage's start and end, `share` being the whole analysis's:
it only goes forward and ends at exactly 1. Each stage's part of the whole is its measured time: a take's on the owner's
take (`WEIGHTS`, the shares as they were before part 3's text stage), a reference's on a reference-length file
(`REFERENCE_WEIGHTS`). How often a job's row is written is the outer layer's (X41, Task 6).

The analysis is JSON as the app reads it: camelCase, whole ms, shares as floats (`Analysis`).
"""

import json
from collections.abc import Callable
from itertools import accumulate
from pathlib import Path
from typing import NotRequired, TypedDict

from media import faces, picture, scenes, text, words
from media.faces import FaceSample
from media.loudness import Loudness, loudness
from media.pauses import Pause
from media.picture import PictureSample
from media.probe import MP4_OR_QUICKTIME, Facts, container, plays_ms, probe, stored_ms
from media.refusal import Refusal
from media.text import Sheet, TextSample
from media.transcode import transcode
from media.words import Word, language_of

STAGES = ("copies", "words", "faces", "cuts", "picture", "text", "loudness")
REFERENCE_ONLY = ("text",)
TAKE_ONLY = ("loudness",)
# Each stage's part of the whole, by its time on the owner's 12.7 s take in `analyse` on Modal (8 cores, Scribe's
# path, as the product runs; worker plan, Task 5, run 4b): the copies 7.63 s, the words 12.88 s (Scribe, then the
# aligner, loaded in the run), the faces 3.11 s, the loudness 0.29 s. Without a key the words took 27.21 s (Whisper).
# The cuts 0.35 s and the picture 0.58 s (part 3, Task 8: `analyse_demo` on the same take, the same machine, where the
# copies took 7.30 s, the words 10.04 s, the faces 2.46 s and the loudness 0.30 s).
WEIGHTS = {"copies": 0.31, "words": 0.52, "faces": 0.13, "cuts": 0.01, "picture": 0.02, "loudness": 0.01}
# A reference's own (X103, Task 9c): not heard, copied lighter, its text read on the upload, no loudness. By its stages'
# times on a reference-length file (68.5 s, 1080 × 1920, two of the ground-truth films end to end) in `analyse_demo
# --reference` on Modal: the copies 11.91 s, the words (its pauses only) 2.59 s, the faces 3.56 s, the cuts 0.59 s, the
# picture 0.89 s, the text 18.50 s; 38.0 s in all (95.7 s before Task 9c, the copies alone 63.5 s).
REFERENCE_WEIGHTS = {"copies": 0.31, "words": 0.07, "faces": 0.09, "cuts": 0.02, "picture": 0.02, "text": 0.49}
SHORT_MS = 1000  # the most the copies may play less than the take says, before it is cut short
LONGEST_MS = 10 * 60 * 1000  # a take is at most ten minutes (X56); the app checks it again once the take is ready (X76)
LONGEST_REFERENCE_MS = 3 * 60 * 1000  # a reference is at most three minutes (X98)


class TakeFacts(TypedDict):
    source: Facts  # the take as uploaded
    full: NotRequired[Facts]  # a take's only: a reference has no full copy (Task 9c)
    preview: Facts


class Files(TypedDict):
    """The files' names in `out_dir`, beside analysis.json: what exists."""

    full: NotRequired[str]  # a take's only
    preview: str
    poster: NotRequired[str]  # a take's only
    sound16k: str | None  # None when the take has no sound
    sheet: NotRequired[str]  # a reference's only: the frames Qwen judges (Task 9c)


class Analysis(TypedDict):
    facts: TakeFacts
    ms: int  # the length the take is stored with (X45)
    files: Files
    language: str | None  # ISO 639-1; None when nothing was said and none was given, and for a reference (X103)
    words: list[Word]
    untimed: int  # for the record, as `words` gives them
    apart: int
    gaveWay: int
    trimmed: int
    dropped: int
    pauses: list[Pause]
    faces: list[FaceSample]
    cuts: list[int]  # the ms of each scene change, in order; [] for one continuous shot
    picture: list[PictureSample]  # every 500 ms from 0
    text: NotRequired[list[TextSample]]  # a reference's only (X101)
    sheet: NotRequired[Sheet]  # a reference's only: its sheet's file and the moments on it, in cell order (Task 9c)
    loudness: Loudness | None  # None when the take has no sound, and for a reference
    fellBack: int | None  # Scribe's answer when Whisper heard the words in its place (M4)


def analyse(source: str | Path, out_dir: str | Path, key: str | None = None, on_progress: Callable[[str, float], None] | None = None,
            *, language: str | None = None, threads: int = 0, reference: bool = False) -> Analysis:
    """The analysis of the take at `source`, its files and analysis.json written into `out_dir`.

    `key`, an ElevenLabs key, has Scribe hear the words (X46); `language` (ISO 639-1), when given, is the
    take's; `threads` are the speech models' (0 leaves them theirs); `reference`, the take is a reference (X98), not
    heard (X103). Raises ValueError for a language with no aligner, given (before anything runs, a reference's too) or
    detected in a take (X55), and for a take cut short; RuntimeError naming the file for what a tool
    could not do. A take that is not an MP4 or QuickTime file, or that is longer than ten minutes (a reference
    three), fails before its copies are made (ValueError)."""
    if language is not None:
        language = language_of(language)
    tell = on_progress or (lambda stage, share: None)
    span = shares(reference)
    out = Path(out_dir)

    def stage(name: str, work: Callable):
        tell(name, span[name][0])
        done = work()
        tell(name, span[name][1])
        return done

    def copies():
        name, long_name = container(source)
        if name != MP4_OR_QUICKTIME:  # uploads are these two only (Task 6)
            raise Refusal(f"{Path(source).name} is not an MP4 or QuickTime file (it is {long_name})")
        facts = probe(source)
        not_too_long(source, facts, reference=reference)
        out.mkdir(parents=True, exist_ok=True)
        made = transcode(source, facts, out, reference=reference)
        preview = probe(made["preview"])
        if reference:  # no full copy: the preview is held to the take as the full copy is, and gives the length
            whole(source, facts, preview)
            return TakeFacts(source=facts, preview=preview), made, plays_ms(preview)
        full = probe(made["full"])
        whole(source, facts, full)
        return TakeFacts(source=facts, full=full, preview=preview), made, stored_ms(full, preview)

    facts, made, ms = stage("copies", copies)
    sound = made["sound16k"]
    heard = stage("words", lambda: words.words(sound, language, key, threads=threads, reference=reference) if sound else words.nothing(None if reference else language))
    found = stage("faces", lambda: faces.faces(made["preview"]))
    changes = stage("cuts", lambda: scenes.cuts(made["preview"]))
    looks = stage("picture", lambda: picture.picture(made["preview"]))
    on_screen = dict(stage("text", lambda: text.text(source, ms, out))) if reference else {}
    level = None if reference else stage("loudness", lambda: loudness(made["full"]) if sound else None)
    if reference:
        files = Files(preview=made["preview"].name, sound16k=sound.name if sound else None, sheet=on_screen["sheet"]["file"])
    else:
        files = Files(full=made["full"].name, preview=made["preview"].name, poster=made["poster"].name, sound16k=sound.name if sound else None)

    analysis = Analysis(
        facts=facts, ms=ms,
        files=files,
        language=heard["language"], words=heard["words"], untimed=heard["untimed"], apart=heard["apart"], gaveWay=heard["gaveWay"],
        trimmed=heard["trimmed"], dropped=heard["dropped"], pauses=heard["pauses"], faces=found, cuts=changes, picture=looks, **on_screen,
        loudness=level, fellBack=heard["fellBack"],
    )
    (out / "analysis.json").write_text(json.dumps(analysis, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    return analysis


def stages(reference: bool = False) -> tuple[str, ...]:
    """The stages that run, in order: a take's leave out a reference's own (`REFERENCE_ONLY`), a reference's a take's own
    (`TAKE_ONLY`)."""
    left_out = TAKE_ONLY if reference else REFERENCE_ONLY
    return tuple(name for name in STAGES if name not in left_out)


def shares(reference: bool = False) -> dict[str, tuple[float, float]]:
    """Each stage's start and end as shares of the whole analysis, by `WEIGHTS` (a take's) or `REFERENCE_WEIGHTS`,
    over the stages that run: the last ends at exactly 1."""
    running, weights = stages(reference), REFERENCE_WEIGHTS if reference else WEIGHTS
    ends = list(accumulate(weights[name] for name in running))
    starts = [0.0, *ends[:-1]]
    return {name: (round(a / ends[-1], 4), 1.0 if name == running[-1] else round(b / ends[-1], 4)) for name, a, b in zip(running, starts, ends)}


def whole(source: str | Path, facts: Facts, full: Facts) -> None:
    """ValueError when a stream of the full copy plays more than a second less than the take says it
    lasts: the take was cut short. Each stream against its own copy, the picture and, when there is
    one, the sound (X57, as amended): a take whose sound ends long before its picture is not cut short,
    and one cut short is, whichever stream is the longer. RuntimeError when the take has sound and its full
    copy none: the copy's failure, not the take's (never seen)."""
    if facts["sound"] and full["audioMs"] is None:
        raise RuntimeError(f"{Path(source).name}: its full copy has no sound, though the take has")
    streams = [("picture", facts["videoMs"], full["videoMs"])] + ([("sound", facts["audioMs"], full["audioMs"])] if facts["sound"] else [])
    for stream, declared, plays in streams:
        if declared - plays > SHORT_MS:
            raise Refusal(f"{Path(source).name} is cut short: its {stream} declares {declared / 1000:.1f} s, plays {plays / 1000:.1f} s")


def not_too_long(source: str | Path, facts: Facts, *, reference: bool = False) -> None:
    """ValueError when the take is longer than ten minutes (X56), or a reference than three (X98): "<name> is longer than
    10 minutes (it is M:SS)", in whole seconds rounded up, so it never reads 10:00. Its length is the one it would be
    stored with (`plays_ms`, X45), so the app's own check of the stored length (X76) agrees with it but for a few ms of
    the copies' encoding."""
    ms, longest = plays_ms(facts), LONGEST_REFERENCE_MS if reference else LONGEST_MS
    if ms > longest:
        s = -(-ms // 1000)
        raise Refusal(f"{Path(source).name} is longer than {longest // 60_000} minutes (it is {s // 60}:{s % 60:02d})")
