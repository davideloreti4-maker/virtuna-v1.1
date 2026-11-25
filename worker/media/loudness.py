"""A file's loudness by ffmpeg's ebur128 (EBU R 128, ITU-R BS.1770): the worker's one reading of it.

`measure` runs ebur128 once and reads what it says: the summary (integrated loudness, loudness range,
true peak) and the momentary loudness it logs every 100 ms, each over the 400 ms before its time `t`.
The posted film's levelling (`render/finish.py`) and a take's analysis both read it here.

`loudness` is a take's loudness as the analysis stores it (N5), measured on the full copy, since
that is what the film plays: integrated loudness, true peak, and a level every 500 ms, the momentary
loudness of the 400 ms centred on its `ms` (ebur128's line at `t = (ms + 200) / 1000`). Where those
400 ms would reach past the sound's start or end (the first level, and the last), the level is that
of the nearest 400 ms inside the sound: ebur128 says nothing for its first 300 ms, and a take that
starts loud is not to read as starting silent. Nothing reads under -70, BS.1770's absolute gate,
which is silence (and JSON has no minus infinity).

The worker's images are Debian 12, whose ffmpeg is 5.1: only options it has are used here.
"""

import json
import re
from bisect import bisect_left
from decimal import Decimal
from pathlib import Path
from typing import TypedDict

from media.tool import report, run

FLOOR = -70.0  # LUFS and dBTP: silence
LEVEL_MS = 500  # a level every half second
MOMENTARY_MS = 400  # what each of ebur128's momentary readings hears, before its time


class Measure(TypedDict):
    lufs: float  # integrated loudness; ebur128 gives -70 for silence
    lra: float  # loudness range, LU
    truePeak: float  # dBTP (-inf for digital silence)
    momentary: list[tuple[float, float]]  # (t, LUFS) every 100 ms: the 400 ms before t, in seconds


class Level(TypedDict):
    ms: int
    lufs: float


class Loudness(TypedDict):
    lufs: float
    truePeak: float
    levels: list[Level]


LINE = re.compile(r"\bt:\s*(\S+)\s+TARGET:.*?\sM:\s*(\S+)")


def measure(path: str | Path) -> Measure:
    """The sound of `path` (its first sound stream) by ebur128 with true peaks, to a tenth. RuntimeError
    naming the file when ffmpeg cannot read it or it has no sound."""
    return read(report(["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
                        "-af", "ebur128=peak=true", "-f", "null", "-"], path), path)


def read(said: str, path: str | Path) -> Measure:
    """`measure`'s reading of what ffmpeg wrote (`said`) when ebur128 heard `path`."""
    cut = said.rfind("Summary:")
    if cut < 0:
        raise RuntimeError(f"{path}: ebur128 gave no summary: {said.strip()[-500:]}")
    lines, summary = said[:cut], said[cut:]

    def number(pattern: str) -> float:
        found = re.search(pattern, summary)
        if not found:
            raise RuntimeError(f"{path}: ebur128 gave no {pattern!r}: {summary.strip()}")
        return float(found.group(1))

    momentary = [(float(t), float(m)) for t, m in LINE.findall(lines)]
    # ebur128 logs a line every 100 ms of sound. None for more than a level's worth is a log this cannot
    # read (another ffmpeg's), not a sound without loudness.
    if not momentary and (ms := sound_ms(path)) > LEVEL_MS:
        raise RuntimeError(f"{path}: ebur128 gave no momentary loudness for {ms} ms of sound; ffmpeg said: "
                           + " | ".join(said.strip().splitlines()[-6:]))
    return Measure(lufs=number(r"I:\s+(-?[\d.]+|-inf) LUFS"), lra=number(r"LRA:\s+(-?[\d.]+) LU\b"),
                   truePeak=number(r"Peak:\s+(-?[\d.]+|-inf) dBFS"), momentary=momentary)


def sound_ms(path: str | Path) -> int:
    """How long the first sound of `path` is, in whole ms, as ffprobe gives it (its stream's, else the file's)."""
    found = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration:format=duration",
                            "-of", "json", str(path)], path))
    seconds = next((s["duration"] for s in found.get("streams", []) if s.get("duration")), found.get("format", {}).get("duration", "0"))
    return int(Decimal(seconds) * 1000)


def loudness(path: str | Path) -> Loudness:
    """A take's loudness as the analysis stores it (see the module): `path` is its full copy."""
    found = measure(path)
    times = [t for t, _ in found["momentary"]]
    levels: list[Level] = []
    if times:
        # ebur128's first full reading is its fourth line, at 400 ms; its last, the sound's end.
        first, end_ms = min(3, len(times) - 1), round(times[-1] * 1000)
        for ms in range(0, end_ms + 1, LEVEL_MS):
            at = min(max((ms + MOMENTARY_MS // 2) / 1000, times[first]), times[-1])
            levels.append(Level(ms=ms, lufs=floored(found["momentary"][nearest(times, at)][1])))
    return Loudness(lufs=floored(found["lufs"]), truePeak=floored(found["truePeak"]), levels=levels)


def nearest(times: list[float], at: float) -> int:
    """The index of the time in `times` (in order) nearest `at`."""
    i = bisect_left(times, at)
    return min((j for j in (i - 1, i) if 0 <= j < len(times)), key=lambda j: abs(times[j] - at))


def floored(value: float) -> float:
    """`value`, or -70 where it is lower (or not a number: ebur128's -inf and nan)."""
    return value if value > FLOOR else FLOOR
