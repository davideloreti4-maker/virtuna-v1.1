"""The posted film's last steps: its sound brought to the level platforms play at (X49), and its cover.

The sound is measured (ffmpeg's ebur128, read by `media/loudness.py`: integrated loudness, loudness range, true peak), then
brought to -14 LUFS by one gain over the whole film, so a voice comes out louder or softer and
keeps its rise and fall. A voice's peaks stand 15 to 20 dB over its loudness, more than -14 LUFS
under -1.5 dBTP leaves room for, so a limiter holds them: the sound is taken to 192 kHz, where the
peaks between samples are samples too (a true peak), limited at -1.5 dBTP with a 5 ms look-ahead
whose delay is taken back out, and brought back to 48 kHz. It touches only the loudest moments, but
on a voice those are many: on the owner's 90 s film it took up to 7 dB off the loudest syllables,
and the film came out at -14.8 LUFS with its loudness range 0.9 LU narrower (worker plan, Task 2).
Half a decibel is left for the AAC encode, which puts peaks back up. The posted file is measured,
and where its true peak is over -1 dBTP (dense sound, such as noise or music, put back up by more
than half a decibel), the levelling is done once more with the ceiling lowered by the overshoot and
0.2 dB, and measured again: once, never a loop. Both measures are given, and whether it ran. Bursts
of pink noise went from +0.2 to -2.1 dBTP so; a voice and tones did not need it (worker plan, Task 2).

Where that film (the base) measures more than 1 LU under -14 (X49's band runs from -15.0 to -14.0; a
whole take with its pauses came out at -15.1 here and -15.3 on Modal), it is levelled once more with the
gain raised by twice its shortfall to -14.9, at most 2 dB, with the same limiter and ceiling. Twice,
because on the owner's take the limiter took a quarter to a half of a raise (+0.2 dB moved it 0.1 LU,
+0.4 dB 0.3, +1.0 dB 0.7; worker plan, Task 2, the H4 scan): a rule measured on that one take. Of the
two films, the one that holds -1 dBTP and lies nearer the band is posted (inside it counts as on it; on
a tie, the base): the AAC encode's peak jumps with the gain (one gain in five posted over -1 dBTP in the
scan), a guard on the raised film would only take the loudness back down, and a raise the limiter takes
little of can land over the band's top. So at most three encodes, never a loop, and a film can still post
under the band.

The picture is copied untouched, but for one word in it: the engine encodes BT.709 colours and calls
their transfer BT.709, where the pixels are sRGB's, and Safari then draws the film 7.6 levels off.
Called sRGB's, Chrome and Safari both draw it within 1.4 levels of the stills (worker plan, Task 2).
The posted file keeps no metadata: the engine writes its own name into what it makes.

The worker's image is Debian 12, whose ffmpeg is 5.1: only options it has are used here.
"""

from pathlib import Path
from typing import TypedDict

from media.loudness import FLOOR, Measure, measure
from media.tool import run
from media.transcode import MP4

LUFS = -14.0
BAND = -15.0  # LUFS, the least the posted file should measure (X49: up to 1 LU under -14)
RAISE_TO = -14.9  # LUFS, where the band pass aims
MOST_RAISE = 2.0  # dB: a film far under the band is not limited harder than this to reach it
CEILING = -1.5  # dBTP, where the limiter holds the peaks
PEAK = -1.0  # dBTP, the most the posted file may measure
GUARD = 0.2  # dB under the overshoot, when the levelling is done again
ATTACK_MS, RELEASE_MS = 5, 50  # the look-ahead, and how fast it lets go: measured on the owner's voice, see the plan
SOUND = ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2"]
# The picture copied, saying in the stream and in the file's colour box that its colours are BT.709's
# (primaries 1, matrix 1) and its transfer sRGB's (13).
PICTURE = ["-c:v", "copy", "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=13:matrix_coefficients=1",
           "-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-colorspace", "bt709"]


class Level(TypedDict):
    lufs: float | None  # the posted file's integrated loudness; None for a film with no sound at all
    truePeak: float | None  # its true peak, dBTP
    lra: float | None  # its loudness range, LU
    lraBefore: float | None  # the joined sound's, before: one gain keeps it
    lufsFirst: float | None  # the first levelling's integrated loudness
    truePeakFirst: float | None  # the first levelling's true peak
    guarded: bool  # whether that was over -1 dBTP, and the levelling done once more
    lufsBase: float | None  # the base's integrated loudness: the first levelling's, or the guard's when it ran
    truePeakBase: float | None  # the base's true peak
    raised: float | None  # the dB the band pass added, when the base was under -15 LUFS and it ran; None when it did not
    raisedPosted: bool  # whether the band pass's film was posted (it held -1 dBTP and lay nearer the band), not the base


def level(in_mp4: str | Path, out_mp4: str | Path) -> Level:
    """Writes `in_mp4` to `out_mp4` with its sound at -14 LUFS, and gives what the posted file measures."""
    before = measure(in_mp4)
    if before["lufs"] <= FLOOR:  # BS.1770's absolute gate: silence
        # Silence has no loudness to bring anywhere: the film is posted as it is.
        _ffmpeg(in_mp4, "-i", str(in_mp4), "-map", "0:v:0", "-map", "0:a:0", *PICTURE, "-c:a", "copy", *MP4, str(out_mp4))
        return Level(lufs=None, truePeak=None, lra=None, lraBefore=None, lufsFirst=None, truePeakFirst=None, guarded=False,
                     lufsBase=None, truePeakBase=None, raised=None, raisedPosted=False)
    gain, ceiling = LUFS - before["lufs"], CEILING
    first = base = _level(in_mp4, out_mp4, gain, ceiling)
    if first["truePeak"] > PEAK:
        ceiling = CEILING - (first["truePeak"] - PEAK) - GUARD
        base = _level(in_mp4, out_mp4, gain, ceiling)
    posted, raised = base, None
    if base["lufs"] < BAND:
        raised = round(min(MOST_RAISE, 2 * (RAISE_TO - base["lufs"])), 2)
        trial = Path(out_mp4).with_name(f"{Path(out_mp4).stem}.raised.mp4")
        band = _level(in_mp4, trial, gain + raised, ceiling)
        if band["truePeak"] <= PEAK and (base["truePeak"] > PEAK or off_band(band["lufs"]) < off_band(base["lufs"])):
            trial.replace(out_mp4)
            posted = band
        else:
            trial.unlink()
    return Level(lufs=posted["lufs"], truePeak=posted["truePeak"], lra=posted["lra"], lraBefore=before["lra"],
                 lufsFirst=first["lufs"], truePeakFirst=first["truePeak"], guarded=base is not first,
                 lufsBase=base["lufs"], truePeakBase=base["truePeak"], raised=raised, raisedPosted=posted is not base)


def off_band(lufs: float) -> float:
    """How far a loudness lies outside X49's band, -15.0 to -14.0 LUFS (0 inside it), in the measure's tenths."""
    return round(max(BAND - lufs, lufs - LUFS, 0.0), 1)


def _level(in_mp4: str | Path, out_mp4: str | Path, gain: float, ceiling: float) -> Measure:
    """Writes the posted file with one gain and the limiter at `ceiling` dBTP, and measures it."""
    # alimiter's `latency` takes its look-ahead back out, so the sound keeps its place against the picture.
    limiter = f"alimiter=limit={10 ** (ceiling / 20):.6f}:attack={ATTACK_MS}:release={RELEASE_MS}:level=0:latency=1"
    _ffmpeg(
        in_mp4,
        "-i", str(in_mp4), "-map", "0:v:0", "-map", "0:a:0", *PICTURE,
        "-af", f"volume={gain:.2f}dB,aresample=192000,{limiter},aresample=48000", *SOUND, *MP4, str(out_mp4),
    )
    return measure(out_mp4)


def cover(png: str | Path, jpg: str | Path) -> None:
    """The cover: one frame of the film as a JPEG, with no metadata."""
    _ffmpeg(png, "-i", str(png), "-frames:v", "1", "-q:v", "2", "-update", "1", "-map_metadata", "-1", str(jpg))
    if not Path(jpg).exists() or Path(jpg).stat().st_size == 0:
        raise RuntimeError(f"{png}: ffmpeg wrote no cover")


def _ffmpeg(about: str | Path, *args: str) -> None:
    run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *args], about)
