"""How a take's picture looks (X97): its brightness, its saturation and its warmth every 500 ms, on the preview copy.

The preview copy is the take upright at a constant 30 or 60 frames a second, 8-bit 4:2:0 in BT.709's limited range
(X44), so a sample is every 15th frame at 30 and every 30th at 60, chosen by frame number as the faces' are
(`media/faces.py`), and its `ms` is round(index × 1000 / fps): exactly on a 500 ms grid. ffmpeg's `signalstats` reads
each sample's averages, the frame first brought to 8-bit 4:2:0 (which the preview copy already is), and they are
scaled so (the controller's resolution, part 3 Task 8), each to three places:
- `luma` = YAVG / 255. In limited range black is 16 and white 235, so a picture reads 0.063 to 0.922;
- `sat` = min(1, SATAVG / 181), SATAVG being the mean distance of each pixel's chroma (U, V) from grey (128, 128) and
  181 ≈ 128·√2 the farthest an 8-bit pair can lie. In limited range the farthest is 158 (0.875); grey is 0, a plain
  orange 0.55, a plain blue 0.62;
- `warmth` = (VAVG − UAVG) / 255, held to −1..1: Cr (red less luma) over Cb (blue less luma). A plain orange reads
  0.54, a plain blue −0.51, grey 0.

The worker's image is Debian 12, whose ffmpeg is 5.1: `select`, `signalstats` and `metadata` are in it as used here.
"""

import re
from pathlib import Path
from typing import TypedDict

from media.probe import probe
from media.tool import run

SAMPLE_MS = 500
CHROMA_MOST = 181  # ≈ 128·√2: the farthest an 8-bit chroma pair lies from grey
STATS = ("YAVG", "SATAVG", "UAVG", "VAVG")
FRAME = re.compile(r"^frame:\d+\s", re.MULTILINE)
STAT = re.compile(r"^lavfi\.signalstats\.(\w+)=(\S+)$", re.MULTILINE)


class PictureSample(TypedDict):
    ms: int
    luma: float  # 0..1
    sat: float  # 0..1
    warmth: float  # -1..1: warm above 0, cool below


def picture(preview: str | Path) -> list[PictureSample]:
    """The picture of `preview` every 500 ms from 0, in order. RuntimeError naming the file with ffmpeg's own words, or
    when ffmpeg reads a sample without its averages."""
    facts = probe(preview)
    step = round(facts["fps"] * SAMPLE_MS / 1000)
    said = run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(preview), "-map", "0:v:0",
                "-vf", f"select=not(mod(n\\,{step})),format=yuv420p,signalstats,metadata=mode=print:file=-", "-f", "null", "-"], preview)
    samples = []
    for i, block in enumerate(FRAME.split(said)[1:]):
        stats = {name: float(value) for name, value in STAT.findall(block)}
        if any(name not in stats for name in STATS):
            raise RuntimeError(f"{preview}: ffmpeg read frame {i * step} without {', '.join(name for name in STATS if name not in stats)}")
        samples.append(sample(round(i * step * 1000 / facts["fps"]), stats))
    return samples


def sample(ms: int, stats: dict[str, float]) -> PictureSample:
    """The sample at `ms` from signalstats' 8-bit averages."""
    return PictureSample(ms=ms, luma=round(stats["YAVG"] / 255, 3), sat=round(min(1.0, stats["SATAVG"] / CHROMA_MOST), 3),
                         warmth=round(max(-1.0, min(1.0, (stats["VAVG"] - stats["UAVG"]) / 255)), 3))
