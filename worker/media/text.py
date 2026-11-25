"""A reference's text on screen (X101, part 3 Task 9b): what a plain text reader finds on its frames, and the colours in
and around each line, so the app reads the reference's captions and title from measures, not from a model's guess.

References only: a creator's own take has no `text` (`media/analyse.py`).

- **Moments** (`moments`): every 500 ms from 250 ms through the first 8 s, where a title and the first captions are;
  then the rest of the reference spread evenly, so there are at most 40 in all: 24 more at the middles of 24 equal
  stretches of what follows, or, where that would put them closer than 500 ms, every 500 ms on from 8250 ms. A moment
  at or past the end is left out.
- **Frames**: the uploaded file's own (Task 9c: a reference has no full copy), brought to a constant 30 or 60 a second
  from 0 as the copies are (X44), turned upright and to SDR BT.709 by the copies' own filters (`transcode._sdr`), the frame
  on screen at each moment (number floor(ms × fps / 1000)), scaled so its long side is 1280, all in one run of ffmpeg, as
  RGB.
- **The reader**: RapidOCR (`rapidocr-onnxruntime`, its PP-OCRv4 models shipped inside the package, on ONNX Runtime,
  CPU only), its orientation step off (a video's text stands upright). A line it scores under `MIN_SCORE` is dropped.
  Each line's `box` is the bounds of the reader's four corners, as shares of the picture to four places.
- **Colours** (`colours_of`): the pixels of a line's box quantised by Pillow's fast octree to `BOX_COLOURS`, and those of a
  ring just outside it (`RING_SHARE` of its height thick, at least `RING_MIN_PX`, clipped to the picture) to
  `RING_COLOURS`; and of a second ring, `beyond` (Task 9c), as thick, one box height further out, quantised the same: a box
  behind the words ends, so its colour is in the first ring and not the second, where a flat scene's (a curtain, skin, a
  desk) is in both. A quantiser splits even a flat area into as many colours as it is given, and a video's flat area is
  never quite flat, so a colour within `MERGE_RGB` of a larger one is counted in it (the larger's place in the list,
  the pair's weighted mean as its colour). Kept: those holding at least `MIN_SHARE` of the pixels, by share. Each line
  colour's `from` and `to` are the 5th and 95th percentile of its pixels' x, as shares of the box's width. The same
  frame gives the same colours every time.
- **The sheet** (`sheet_of`, Task 9c): twelve of the frames read, spread evenly over the moments (the first always among
  them), each scaled into 270 × 480 (letterboxed when the picture is not 9:16), four across, one JPEG at quality 85: what
  Qwen judges, so the app need not draw stills of a reference.

The worker's image is Debian 12, whose ffmpeg is 5.1: `select`, `scale`'s colour options and `-fps_mode` are in it as
used here. RapidOCR and its models are in the speech image (`worker/app.py`, `TEXT_PACKAGES`).
"""

import math
import subprocess
import tempfile
from collections.abc import Iterator
from pathlib import Path
from typing import TypedDict

from media.probe import probe
from media.transcode import _sdr, fit, frame_rate

STEP_MS = 500
FIRST_MS = 250
DENSE_MS = 8000  # every 500 ms over the first 8 s
MOST = 40  # moments in all
LONG_SIDE = 1280  # holds the accuracy of the full size on ground-truth film 1 (Task 9b's report), in half the time
MIN_SCORE = 0.5  # the reader's own score of a line, 0 to 1; below it a line is dropped
MOST_LETTERS = 200
BOX_COLOURS = 6
RING_COLOURS = 3
MIN_SHARE = 0.03
RING_SHARE = 0.15
RING_MIN_PX = 3
# Colours this near are one: a box behind words over a moving picture spreads less (with 40, film 1's pill read one flat
# ring on 41 of its 45 caption rows, film 3's label title on 16 of 18), while white, the kit's yellow and a dark lie 150+ apart.
MERGE_RGB = 40
SPREAD = (5, 95)  # the percentiles of a colour's x that are its `from` and `to`
SHEET_FILE = "sheet.jpg"
SHEET_CELLS = 12
CELL = (270, 480)  # each frame on the sheet: a quarter of the stage, as the app's own sheets were (`store.CELL`)
ACROSS = 4
SHEET_QUALITY = 85


class Box(TypedDict):
    x: float
    y: float
    w: float
    h: float


class Colour(TypedDict):
    hex: str
    share: float


# A colour of a line's box, with where its pixels lie across the box (`from` is a keyword, hence this form).
LineColour = TypedDict("LineColour", {"hex": str, "share": float, "from": float, "to": float})


class Line(TypedDict):
    box: Box
    text: str
    score: float
    colours: list[LineColour]
    around: list[Colour]
    beyond: list[Colour]


class TextSample(TypedDict):
    ms: int
    lines: list[Line]


def moments(ms: int) -> list[int]:
    """The moments of a reference `ms` long whose text is read, in order (see above)."""
    dense = list(range(FIRST_MS, min(DENSE_MS, ms), STEP_MS))
    rest = ms - DENSE_MS
    if rest <= 0:
        return dense
    left = MOST - len(dense)
    if rest / left < STEP_MS:
        return dense + list(range(DENSE_MS + FIRST_MS, ms, STEP_MS))[:left]
    return dense + [DENSE_MS + math.floor((i + 0.5) * rest / left) for i in range(left)]


class Sheet(TypedDict):
    file: str
    ms: list[int]  # the moments on it, in cell order


class OnScreen(TypedDict):
    text: list[TextSample]
    sheet: Sheet


def text(source: str | Path, ms: int, out_dir: str | Path) -> OnScreen:
    """The text on the reference `source` (the file as uploaded), `ms` long, at each of its moments, in order (a moment with
    none has no lines), and its sheet, written into `out_dir` as sheet.jpg. RuntimeError naming the file with ffmpeg's own
    words."""
    import numpy as np
    from rapidocr_onnxruntime import RapidOCR

    facts = probe(source)
    reader = RapidOCR(use_cls=False, text_score=0.0, print_verbose=False)
    at = moments(min(ms, facts["videoMs"]))
    rate = frame_rate(facts["fps"])
    w, h = fit(facts["w"], facts["h"], LONG_SIDE)
    on_sheet = set(sheet_moments(at))
    found, pictures = [], []
    for moment, rgb in zip(at, frames(source, [frame_at(moment, rate) for moment in at], w, h, rate=rate, hdr=facts["hdr"])):
        picture = np.frombuffer(rgb, dtype=np.uint8).reshape(h, w, 3)
        found.append(TextSample(ms=moment, lines=lines_of(picture, reader)))
        if moment in on_sheet:
            pictures.append((moment, picture))
    (Path(out_dir) / SHEET_FILE).write_bytes(sheet_of([picture for _, picture in pictures]))
    return OnScreen(text=found, sheet=Sheet(file=SHEET_FILE, ms=[moment for moment, _ in pictures]))


def frame_at(ms: int, fps: float) -> int:
    """The number of the frame on screen at `ms` in a picture of constant `fps` from 0."""
    return math.floor(ms * round(fps) / 1000)


def frames(path: str | Path, numbers: list[int], w: int, h: int, *, rate: int, hdr: bool = False) -> Iterator[bytes]:
    """The frames of `path`, brought to a constant `rate` from 0, numbered `numbers` (in order, none twice), each `w` × `h`
    RGB (row by row from the top), upright and SDR as the copies are, in one run of ffmpeg; fewer when the file ends before
    the last. RuntimeError naming the file with ffmpeg's own words."""
    if not numbers:
        return
    size = w * h * 3
    chosen = "+".join(f"eq(n\\,{n})" for n in numbers)
    graph = f"fps={rate}:start_time=0,select={chosen},{_sdr(hdr, w, h)},scale=in_color_matrix=bt709:in_range=tv:out_range=pc"
    command = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path), "-map", "0:v:0", "-vf", graph,
               "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    with tempfile.TemporaryFile() as said, subprocess.Popen(command, stdout=subprocess.PIPE, stderr=said) as decoding:
        read_to_the_end = False
        try:
            while chunk := decoding.stdout.read(size):
                if len(chunk) < size:
                    raise RuntimeError(f"{path}: ffmpeg gave {len(chunk)} bytes of a frame of {size}")
                yield chunk
            read_to_the_end = True
        finally:
            if not read_to_the_end:  # stopped early (a failure, or the caller done): ffmpeg is not left running
                decoding.kill()
        if decoding.wait() != 0:
            said.seek(0)
            raise RuntimeError(f"{path}: ffmpeg failed ({decoding.returncode}): {said.read().decode(errors='replace').strip()}")


def sheet_moments(at: list[int]) -> list[int]:
    """The moments whose frames go on the sheet: all of them up to `SHEET_CELLS`, else that many spread evenly, the first and
    the last among them."""
    if len(at) <= SHEET_CELLS:
        return list(at)
    return [at[round(i * (len(at) - 1) / (SHEET_CELLS - 1))] for i in range(SHEET_CELLS)]


def sheet_of(pictures: list) -> bytes:
    """`pictures` (H × W × 3 RGB arrays) on one JPEG: each scaled into `CELL` (letterboxed in black), `ACROSS` to a row."""
    import io

    from PIL import Image

    across = min(ACROSS, len(pictures)) or 1
    down = max(1, -(-len(pictures) // ACROSS))
    sheet = Image.new("RGB", (across * CELL[0], down * CELL[1]))
    for i, picture in enumerate(pictures):
        frame = Image.fromarray(picture)
        scale = min(CELL[0] / frame.width, CELL[1] / frame.height)
        fitted = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.LANCZOS)
        x, y = (i % ACROSS) * CELL[0] + (CELL[0] - fitted.width) // 2, (i // ACROSS) * CELL[1] + (CELL[1] - fitted.height) // 2
        sheet.paste(fitted, (x, y))
    out = io.BytesIO()
    sheet.save(out, "JPEG", quality=SHEET_QUALITY)
    return out.getvalue()


def lines_of(picture, reader) -> list[Line]:
    """The lines the reader finds on `picture` (an H × W × 3 RGB array) that it scores at least `MIN_SCORE`, top to bottom
    as it gives them, each with its colours."""
    found, _ = reader(picture[:, :, ::-1])  # the reader takes BGR, as OpenCV does
    lines = []
    for corners, said, score in found or []:
        if score < MIN_SCORE or not said.strip():
            continue
        xs, ys = [x for x, _ in corners], [y for _, y in corners]
        bounds = (min(xs), min(ys), max(xs), max(ys))
        colours, around, beyond = colours_of(picture, bounds)
        lines.append(Line(box=share_box(bounds, picture.shape[1], picture.shape[0]), text=said.strip()[:MOST_LETTERS],
                          score=round(float(score), 2), colours=colours, around=around, beyond=beyond))
    return lines


def share_box(bounds: tuple[float, float, float, float], w: int, h: int) -> Box:
    """`bounds` (left, top, right, bottom in pixels) as shares of a `w` × `h` picture, clamped to it, to four places: its
    edges first, so that it never reaches past the picture."""
    left, top, right, bottom = (round(min(max(value / size, 0.0), 1.0), 4) for value, size in zip(bounds, (w, h, w, h)))
    return Box(x=left, y=top, w=round(right - left, 4), h=round(bottom - top, 4))


def colours_of(picture, bounds: tuple[float, float, float, float]) -> tuple[list[LineColour], list[Colour], list[Colour]]:
    """The colours of the box `bounds` (pixels) of `picture`, of the ring just outside it and of the ring beyond (see above)."""
    import numpy as np

    rows, cols = picture.shape[:2]
    left, top = max(0, math.floor(bounds[0])), max(0, math.floor(bounds[1]))
    right, bottom = min(cols, math.ceil(bounds[2])), min(rows, math.ceil(bounds[3]))
    if right <= left or bottom <= top:
        return [], [], []
    box = picture[top:bottom, left:right]
    index, palette = quantised(box.reshape(-1, 3), BOX_COLOURS)
    xs = np.tile(np.arange(right - left), bottom - top)
    colours = []
    for group, (rgb, count) in merged(index, palette):
        share = count / index.size
        if share < MIN_SHARE:
            continue
        spread = np.percentile(xs[np.isin(index, group)], SPREAD) / max(1, right - left - 1)
        colours.append(LineColour({"hex": hex_of(rgb), "share": round(share, 3), "from": round(float(spread[0]), 3), "to": round(float(spread[1]), 3)}))

    thick = max(RING_MIN_PX, math.ceil(RING_SHARE * (bottom - top)))
    around = ring_colours(picture, (left, top, right, bottom), 0, thick)
    beyond = ring_colours(picture, (left, top, right, bottom), bottom - top, thick)
    return sorted(colours, key=lambda c: -c["share"]), around, beyond


def ring_colours(picture, box: tuple[int, int, int, int], gap: int, thick: int) -> list[Colour]:
    """The colours of a ring `thick` pixels wide round `box` (left, top, right, bottom), `gap` pixels out from it, clipped
    to the picture; none when nothing of it is on the picture."""
    import numpy as np

    rows, cols = picture.shape[:2]
    left, top, right, bottom = box
    inner = (left - gap, top - gap, right + gap, bottom + gap)
    outer = (max(0, inner[0] - thick), max(0, inner[1] - thick), min(cols, inner[2] + thick), min(rows, inner[3] + thick))
    if outer[2] <= outer[0] or outer[3] <= outer[1]:
        return []
    mask = np.ones((outer[3] - outer[1], outer[2] - outer[0]), dtype=bool)
    cut = (max(inner[0], outer[0]), max(inner[1], outer[1]), min(inner[2], outer[2]), min(inner[3], outer[3]))
    if cut[2] > cut[0] and cut[3] > cut[1]:
        mask[cut[1] - outer[1]:cut[3] - outer[1], cut[0] - outer[0]:cut[2] - outer[0]] = False
    pixels = picture[outer[1]:outer[3], outer[0]:outer[2]][mask]
    if not pixels.size:
        return []
    index, palette = quantised(pixels, RING_COLOURS)
    return sorted((Colour(hex=hex_of(rgb), share=round(count / index.size, 3)) for _, (rgb, count) in merged(index, palette)
                   if count / index.size >= MIN_SHARE), key=lambda c: -c["share"])


def quantised(pixels, most: int):
    """`pixels` (N × 3, RGB) quantised by Pillow's fast octree to at most `most` colours: each pixel's colour index (N) and
    the palette (rows of RGB)."""
    import numpy as np
    from PIL import Image

    strip = Image.fromarray(np.ascontiguousarray(pixels.reshape(1, -1, 3)))
    paletted = strip.quantize(colors=most, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    index = np.asarray(paletted, dtype=np.int32).reshape(-1)
    palette = np.asarray(paletted.getpalette()[: 3 * (int(index.max()) + 1)], dtype=np.float64).reshape(-1, 3)
    return index, palette


def merged(index, palette) -> list[tuple[list[int], tuple[tuple[float, float, float], int]]]:
    """The palette's colours that are used, largest first, each within `MERGE_RGB` of a larger one counted in it: each
    group's palette indices, its colour (the weighted mean) and its count."""
    import numpy as np

    counts = np.bincount(index, minlength=len(palette))
    order = sorted((i for i in range(len(palette)) if counts[i] > 0), key=lambda i: (-counts[i], i))
    groups: list[list] = []  # [indices, rgb sum weighted, count]
    for i in order:
        colour = palette[i]
        for group in groups:
            mean = group[1] / group[2]
            if float(np.sqrt(((mean - colour) ** 2).sum())) <= MERGE_RGB:
                group[0].append(i)
                group[1] = group[1] + colour * counts[i]
                group[2] += int(counts[i])
                break
        else:
            groups.append([[i], colour * counts[i], int(counts[i])])
    return [(indices, (tuple(total / count), count)) for indices, total, count in groups]


def hex_of(rgb) -> str:
    return "#" + "".join(f"{min(255, max(0, round(float(c)))):02x}" for c in rgb)
