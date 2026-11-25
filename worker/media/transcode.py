"""The take's two copies, its poster and its sound for speech (X44), as ffmpeg command lines built from its facts.

The full copy is what a render reads: H.264 High, CRF 18, 30 or 60 pictures a second, SDR, long side
at most 1920, AAC, a keyframe every second. The preview copy is what the Player plays while editing: long side at most 960,
CRF 28, a keyframe every half second so it jumps fast. Every take is transcoded, because HEVC and
variable frame rates make the engine fall back to a seek that is not frame-exact, and iPhones film
HDR by default.

The worker's image is Debian 12, whose ffmpeg is 5.1: only options and filters it has are used here.
"""

from pathlib import Path
from typing import TypedDict

from media.probe import Facts
from media.tool import run

FULL_LONG_SIDE = 1920
PREVIEW_LONG_SIDE = 960

# Both copies say they are BT.709 in limited range, as they are once converted. Said twice, on the
# pictures (TAGS) and to the encoder (BT709): ffmpeg 8 takes the pictures' word over the options.
TAGS = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
BT709 = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"]
SOUND = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
# No metadata: no output carries the place a take was filmed, the phone's details, or a title,
# comment or date (the 16 kHz sound goes to an outside service).
NO_METADATA = ["-map_metadata", "-1"]
# Fast start: the index at the front, so a browser can play before the whole file is there.
MP4 = [*NO_METADATA, "-movflags", "+faststart"]


class Copies(TypedDict):
    full: Path | None  # None for a reference (Task 9c): nothing renders it
    preview: Path
    poster: Path | None  # None for a reference
    sound16k: Path | None  # 16 kHz mono WAV for the speech steps; None when the take has no sound


def frame_rate(fps: float) -> int:
    """60 for a take filmed at 50 pictures a second or more, 30 for anything else."""
    return 60 if fps >= 50 else 30


def fit(w: int, h: int, long_side: int) -> tuple[int, int]:
    """The size with its long side at most `long_side`, never larger than it was, in even pixels (H.264 needs them)."""
    scale = min(1, long_side / max(w, h))
    return round(w * scale) // 2 * 2, round(h * scale) // 2 * 2


def transcode(source: str | Path, facts: Facts, out_dir: str | Path, *, reference: bool = False) -> Copies:
    """Makes the copies of `source` in `out_dir`: full.mp4, preview.mp4, poster.jpg and sound16k.wav. For a reference
    (Task 9c), only what its analysis reads: preview.mp4 and sound16k.wav; it is never rendered, so it has no full copy and
    no poster."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    full, preview, poster, speech = out / "full.mp4", out / "preview.mp4", out / "poster.jpg", out / "sound16k.wav"
    rate = frame_rate(facts["fps"])
    full_w, full_h = fit(facts["w"], facts["h"], FULL_LONG_SIDE)
    preview_w, preview_h = fit(facts["w"], facts["h"], PREVIEW_LONG_SIDE)
    if reference:
        return _preview_only(source, facts, rate, (preview_w, preview_h), preview, speech)

    # One decode for all outputs. ffmpeg turns the picture upright before the graph (its default),
    # so the sizes are the shown ones. Picture and sound both count from 0: `start_time=0` repeats
    # the first picture and `first_pts=0` adds silence when one starts later than the other, so a
    # word timed on the 16 kHz sound lands on the same moment of the copies.
    graph = [
        f"[0:v:0]fps={rate}:start_time=0,{_sdr(facts['hdr'], full_w, full_h)},{TAGS},setsar=1,split[full][p]",
        f"[p]scale={preview_w}:{preview_h},setsar=1[preview]",
    ]
    if facts["sound"]:
        # The sound for speech is brought to 16 kHz in one channel by a resampler of its own, after
        # the split: ffmpeg 5.1 gives a split one format for all it feeds, and given the speech
        # output's, it made the copies' sound 16 kHz in one channel too (plan, Task 3 box 4).
        graph += ["[0:a:0]aresample=async=1:first_pts=0,asplit=3[a_full][a_preview][a_all]",
                  "[a_all]aresample=16000,aformat=channel_layouts=mono[a_speech]"]

    def sound(label: str) -> list[str]:
        return ["-map", label, *SOUND] if facts["sound"] else []

    # Keyframes every second in the full copy (the render starts slices of 120 frames anywhere) and
    # every half second in the preview (the Player jumps), none at scene cuts, so exactly that far apart.
    _ffmpeg(
        source,
        "-i", str(source), "-filter_complex", ";".join(graph),
        "-map", "[full]", *_picture(18, every=rate), *sound("[a_full]"), *MP4, str(full),
        "-map", "[preview]", *_picture(28, every=rate // 2), *sound("[a_preview]"), *MP4, str(preview),
        *(["-map", "[a_speech]", "-c:a", "pcm_s16le", *NO_METADATA, str(speech)]
          if facts["sound"] else []),
    )

    # The poster: the full copy at one second, or at the middle of a picture shorter than two (its
    # picture's: the sound may end sooner). ffmpeg 5.1 can end well and write nothing when asked past
    # the end, so the file itself is checked, and one left in `out_dir` from before is deleted first.
    at = 1.0 if facts["videoMs"] >= 2000 else facts["videoMs"] / 2000
    about = f"{full}, the poster at {at:.3f} s"
    poster.unlink(missing_ok=True)
    _ffmpeg(about, "-ss", f"{at:.3f}", "-i", str(full), "-frames:v", "1", "-q:v", "2", "-update", "1", str(poster))
    if not poster.exists() or poster.stat().st_size == 0:
        raise RuntimeError(f"{about}: ffmpeg wrote no picture")

    return Copies(full=full, preview=preview, poster=poster, sound16k=speech if facts["sound"] else None)


def _preview_only(source: str | Path, facts: Facts, rate: int, size: tuple[int, int], preview: Path, speech: Path) -> Copies:
    """A reference's copies: the preview copy, made from the take directly as a take's is (the same picture filters, the
    same encoder), and its sound for speech; one decode for both."""
    w, h = size
    graph = [f"[0:v:0]fps={rate}:start_time=0,{_sdr(facts['hdr'], w, h)},{TAGS},setsar=1[preview]"]
    if facts["sound"]:
        graph += ["[0:a:0]aresample=async=1:first_pts=0,asplit=2[a_preview][a_all]",
                  "[a_all]aresample=16000,aformat=channel_layouts=mono[a_speech]"]
    _ffmpeg(
        source,
        "-i", str(source), "-filter_complex", ";".join(graph),
        "-map", "[preview]", *_picture(28, every=rate // 2), *(["-map", "[a_preview]", *SOUND] if facts["sound"] else []), *MP4, str(preview),
        *(["-map", "[a_speech]", "-c:a", "pcm_s16le", *NO_METADATA, str(speech)] if facts["sound"] else []),
    )
    return Copies(full=None, preview=preview, poster=None, sound16k=speech if facts["sound"] else None)


def _sdr(hdr: bool, w: int, h: int) -> str:
    """Filters that bring the picture to `w` by `h` in 8-bit BT.709."""
    if hdr:
        # PQ or HLG: into linear light, tone-mapped (Hable) into SDR's range, then BT.709. An HDR
        # file always names its colours, which zscale needs.
        return (
            f"zscale=w={w}:h={h}:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
            "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
        )
    # SDR: converted to BT.709's matrix in limited range, from whatever the file names
    # (a file that names nothing is read as BT.601, ffmpeg's rule).
    return f"scale={w}:{h}:out_color_matrix=bt709:out_range=tv,format=yuv420p"


def _picture(crf: int, every: int) -> list[str]:
    """H.264 High at `crf`, a keyframe every `every` pictures and only there."""
    keyframes = ["-g", str(every), "-keyint_min", str(every), "-sc_threshold", "0"]
    return ["-c:v", "libx264", "-profile:v", "high", "-crf", str(crf), *keyframes, "-pix_fmt", "yuv420p", *BT709]


def _ffmpeg(about: str | Path, *args: str) -> None:
    run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *args], about)
