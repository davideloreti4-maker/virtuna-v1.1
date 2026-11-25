"""A reference's text on screen (X101, `media/text.py`): which moments are read, the lines the reader finds on frames drawn
here with Pillow and encoded as an upload (the stage reads the uploaded file itself, Task 9c), the colours in and around
each and in a ring beyond, and the sheet of its frames.

The reader (RapidOCR and its models), Pillow and numpy are in the speech image on Modal; on this Mac the tests that read run
with them added (`uv run --with rapidocr-onnxruntime==1.4.4 --with pillow --with numpy pytest tests/test_text.py`), and are
skipped where they are not.
"""

import importlib.util
import math
from pathlib import Path

import pytest

from helpers import ffmpeg, turned
from media.probe import probe
from media.text import CELL, MOST, SHEET_CELLS, moments, sheet_moments, text

with_the_reader = pytest.mark.skipif(any(importlib.util.find_spec(m) is None for m in ("rapidocr_onnxruntime", "PIL", "numpy")),
                                     reason="the reader, Pillow and numpy are in the speech image on Modal")

W, H = 1080, 1920
WHITE, YELLOW, DARK, INK = (255, 255, 255), (255, 225, 74), (17, 17, 17), (20, 20, 20)
SIZE = 96  # the type size the words are drawn at, in px of the 1080 × 1920 picture


def distance(a: tuple[int, ...], hex_colour: str) -> float:
    b = tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))
    return math.dist(a, b)


def gradient():
    """A picture going from a muted blue at the top to a warm grey at the bottom."""
    import numpy as np
    from PIL import Image

    t = np.linspace(0, 1, H)[:, None, None]
    top, bottom = np.array([60, 90, 140]), np.array([170, 150, 130])
    return Image.fromarray(np.broadcast_to(top + (bottom - top) * t, (H, W, 3)).astype(np.uint8))


def busy(folder: Path):
    """A picture with something everywhere: ffmpeg's test pattern, bright and many-coloured."""
    from PIL import Image

    path = folder / "busy.png"
    ffmpeg("-f", "lavfi", "-i", f"testsrc2=size={W}x{H}:rate=1:duration=1", "-frames:v", "1", str(path))
    return Image.open(path).convert("RGB")


def words_at(draw, words: list[str], y: int, font, gap: int) -> list[tuple[int, int, int, int]]:
    """Where each word goes on one line centred across the picture, its letters' box at the line's top `y`."""
    widths = [draw.textlength(word, font=font) for word in words]
    x = (W - (sum(widths) + gap * (len(words) - 1))) / 2
    boxes = []
    for word, wide in zip(words, widths):
        boxes.append(tuple(round(v) for v in draw.textbbox((x, y), word, font=font)))
        x += wide + gap
    return boxes


def upload(folder: Path, picture, seconds: float = 2, name: str = "upload.mp4") -> Path:
    """`picture` held for `seconds`, encoded as a phone or an app would upload it."""
    still, made = folder / f"{name}.png", folder / name
    picture.save(still)
    ffmpeg("-loop", "1", "-framerate", "30", "-i", str(still), "-t", str(seconds), "-c:v", "libx264", "-preset", "ultrafast",
           "-crf", "12", "-pix_fmt", "yuv420p", str(made))
    return made


def read(path: Path, ms: int) -> list[dict]:
    """The stage's samples for `path`, its sheet written beside it."""
    return text(path, ms, path.parent)["text"]


def bounds(boxes: list[tuple[int, int, int, int]]) -> tuple[float, float, float, float]:
    """The letters' box of a line as shares of the picture: left, top, right, bottom."""
    return min(b[0] for b in boxes) / W, min(b[1] for b in boxes) / H, max(b[2] for b in boxes) / W, max(b[3] for b in boxes) / H


def within(line: dict, drawn: tuple[float, float, float, float], by: float = 0.015) -> bool:
    box = line["box"]
    found = (box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"])
    return all(abs(a - b) <= by for a, b in zip(found, drawn))


# ── the moments ──────────────────────────────────────────────────────────────────────────────────


def test_every_500_ms_from_250_through_the_first_8_s_then_the_rest_spread_to_40_in_all():
    assert moments(3000) == [250, 750, 1250, 1750, 2250, 2750]
    # 30 s: 16 over the first 8 s, then 24 at the middles of 24 stretches of the 22 s left (916.7 ms each).
    thirty = moments(30_000)
    assert len(thirty) == MOST and thirty[:16] == list(range(250, 8000, 500))
    assert thirty[16:] == [8000 + math.floor((i + 0.5) * 22_000 / 24) for i in range(24)] and thirty[16] == 8458 and thirty[-1] == 29_541
    # 180 s: the same 16, then 24 over the 172 s left, about 7.2 s apart.
    long = moments(180_000)
    assert len(long) == MOST and long[:16] == thirty[:16] and long[16] == 11_583 and long[-1] == 176_416
    assert all(b > a for a, b in zip(long, long[1:]))


def test_a_moment_at_or_past_the_end_is_left_out_and_a_short_rest_is_read_every_500_ms():
    assert moments(250) == [] and moments(251) == [250] and moments(7750) == list(range(250, 7750, 500))
    # 12.7 s: 4.7 s after the first 8 would put 24 moments 196 ms apart, so they go on every 500 ms instead.
    assert moments(12_700) == list(range(250, 12_700, 500))
    # 20 s: 12 s over 24 is exactly 500 ms, so the middles of the stretches, 8250 to 19 750.
    assert moments(20_000) == list(range(250, 20_000, 500))


@with_the_reader
@pytest.mark.parametrize("seconds", [3, 30, 180])
def test_a_file_s_text_is_read_at_its_moments(tmp_path: Path, seconds: int):
    """Small grey files with nothing written: a sample at each moment, none with a line."""
    path = tmp_path / f"grey-{seconds}.mp4"
    ffmpeg("-f", "lavfi", "-i", f"color=c=gray:size=360x640:rate=30:duration={seconds}", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", str(path))
    on_screen = text(path, probe(path)["ms"], tmp_path)
    found = on_screen["text"]
    assert [x["ms"] for x in found] == moments(probe(path)["ms"]) and all(x["lines"] == [] for x in found)
    assert on_screen["sheet"] == {"file": "sheet.jpg", "ms": sheet_moments(moments(probe(path)["ms"]))} and (tmp_path / "sheet.jpg").is_file()


# ── the lines and their colours ──────────────────────────────────────────────────────────────────


@with_the_reader
def test_white_words_with_a_yellow_one_on_a_dark_rounded_box_over_a_gradient(tmp_path: Path):
    from PIL import ImageDraw, ImageFont

    picture = gradient()
    draw = ImageDraw.Draw(picture)
    font = ImageFont.load_default(size=SIZE)
    words = ["make", "videos", "faster"]
    boxes = words_at(draw, words, 1400, font, gap=30)
    left, top, right, bottom = bounds(boxes)
    draw.rounded_rectangle([left * W - 40, top * H - 30, right * W + 40, bottom * H + 30], radius=40, fill=DARK)
    x = (W - (sum(draw.textlength(word, font=font) for word in words) + 30 * 2)) / 2  # as `words_at` placed them
    for word, colour in zip(words, [WHITE, YELLOW, WHITE]):
        draw.text((x, 1400), word, font=font, fill=colour)
        x += draw.textlength(word, font=font) + 30

    made = upload(tmp_path, picture)
    found = read(made, 2000)
    assert [x["ms"] for x in found] == [250, 750, 1250, 1750]
    for sample in found:
        [line] = sample["lines"]
        assert line["text"] == "make videos faster" and line["score"] >= 0.9
        assert within(line, (left, top, right, bottom)), (line["box"], (left, top, right, bottom))
        hexes = [c["hex"] for c in line["colours"]]
        assert any(distance(WHITE, x) <= 30 for x in hexes) and any(distance(YELLOW, x) <= 30 for x in hexes), line["colours"]
        # The ring lies on the box: one flat dark colour.
        assert len(line["around"]) == 1 and line["around"][0]["share"] == 1.0 and distance(DARK, line["around"][0]["hex"]) <= 30, line["around"]
        assert all(set(c) == {"hex", "share", "from", "to"} and 0 <= c["from"] <= c["to"] <= 1 for c in line["colours"])
        assert [c["share"] for c in line["colours"]] == sorted((c["share"] for c in line["colours"]), reverse=True)
        assert all(c["share"] >= 0.03 for c in line["colours"] + line["around"] + line["beyond"])
    # The same file gives the same lines and colours every time.
    assert read(made, 1000) == found[:2]


@with_the_reader
def test_white_letters_with_a_dark_edge_over_a_busy_picture_have_no_flat_ring(tmp_path: Path):
    from PIL import ImageDraw, ImageFont

    picture = busy(tmp_path)
    draw = ImageDraw.Draw(picture)
    font = ImageFont.load_default(size=SIZE)
    line = "watch this first"
    box = draw.textbbox((0, 0), line, font=font, stroke_width=8)
    x, y = (W - (box[2] - box[0])) / 2 - box[0], 500
    draw.text((x, y), line, font=font, fill=WHITE, stroke_width=8, stroke_fill=(0, 0, 0))
    drawn = draw.textbbox((x, y), line, font=font)

    [sample] = read(upload(tmp_path, picture, seconds=0.5), 500)
    [found] = [each for each in sample["lines"] if each["text"] == line]
    assert within(found, (drawn[0] / W, drawn[1] / H, drawn[2] / W, drawn[3] / H)), (found["box"], drawn)
    assert any(distance(WHITE, c["hex"]) <= 30 for c in found["colours"]), found["colours"]
    assert found["around"][0]["share"] < 0.8, found["around"]


@with_the_reader
def test_a_dark_word_on_a_yellow_box_beside_white_words_fills_its_stretch_of_the_line(tmp_path: Path):
    from PIL import ImageDraw, ImageFont

    picture = gradient()
    draw = ImageDraw.Draw(picture)
    font = ImageFont.load_default(size=SIZE)
    words = ["this", "one", "works"]
    gap, y = 34, 1100
    widths = [draw.textlength(word, font=font) for word in words]
    x = (W - (sum(widths) + gap * 2)) / 2
    for word, wide in zip(words, widths):
        if word == "one":
            letters = draw.textbbox((x, y), word, font=font)
            draw.rounded_rectangle([letters[0] - 16, letters[1] - 14, letters[2] + 16, letters[3] + 14], radius=18, fill=YELLOW)
            draw.text((x, y), word, font=font, fill=INK)
        else:
            draw.text((x, y), word, font=font, fill=WHITE, stroke_width=6, stroke_fill=(0, 0, 0))
        x += wide + gap

    [sample] = read(upload(tmp_path, picture, seconds=0.5), 500)
    [found] = sample["lines"]
    assert found["text"] == "this one works"
    yellow = [c for c in found["colours"] if distance(YELLOW, c["hex"]) <= 30]
    assert yellow and yellow[0]["share"] / (yellow[0]["to"] - yellow[0]["from"]) >= 0.45, found["colours"]


# ── the ring beyond (Task 9c): a box behind the words ends; a flat scene does not ────────────────────────────────────


def flat(colour: tuple[int, int, int]):
    from PIL import Image

    return Image.new("RGB", (W, H), colour)


@with_the_reader
@pytest.mark.parametrize(("scene", "colour"), [("a flat dark wall", (40, 38, 36)), ("flat skin", (205, 160, 135))], ids=["wall", "skin"])
def test_white_words_over_a_flat_scene_have_the_same_flat_colour_beyond(tmp_path: Path, scene: str, colour: tuple[int, int, int]):
    """Plain white words over a flat scene: the ring round the letters is flat, and so is the ring beyond, the same colour.
    (Read as a box on 3 of Task 11's 5 references before the ring beyond.)"""
    from PIL import ImageDraw, ImageFont

    picture = flat(colour)
    draw = ImageDraw.Draw(picture)
    font = ImageFont.load_default(size=SIZE)
    line = "plain words here"
    box = draw.textbbox((0, 0), line, font=font)
    draw.text(((W - (box[2] - box[0])) / 2 - box[0], 900), line, font=font, fill=WHITE)
    [sample] = read(upload(tmp_path, picture, seconds=0.5), 500)
    [found] = sample["lines"]
    assert found["text"] == line, scene
    assert found["around"][0]["share"] >= 0.8 and found["beyond"][0]["share"] >= 0.8, (found["around"], found["beyond"])
    assert distance(colour, found["around"][0]["hex"]) <= 30 and distance(colour, found["beyond"][0]["hex"]) <= 30


@with_the_reader
def test_white_words_on_a_real_dark_box_have_its_colour_round_them_and_the_picture_beyond(tmp_path: Path):
    """The box reaches 40 px past the letters at each side and 30 above and below; the ring beyond starts one box height
    out, so it lies on the picture (here a gradient), not on the box."""
    from PIL import ImageDraw, ImageFont

    picture = gradient()
    draw = ImageDraw.Draw(picture)
    font = ImageFont.load_default(size=SIZE)
    line = "boxed words here"
    box = draw.textbbox((0, 0), line, font=font)
    x, y = (W - (box[2] - box[0])) / 2 - box[0], 900
    letters = draw.textbbox((x, y), line, font=font)
    draw.rounded_rectangle([letters[0] - 40, letters[1] - 30, letters[2] + 40, letters[3] + 30], radius=30, fill=DARK)
    draw.text((x, y), line, font=font, fill=WHITE)
    [sample] = read(upload(tmp_path, picture, seconds=0.5), 500)
    [found] = sample["lines"]
    assert found["around"][0]["share"] >= 0.8 and distance(DARK, found["around"][0]["hex"]) <= 30, found["around"]
    assert all(distance(DARK, c["hex"]) > 48 for c in found["beyond"]), found["beyond"]


@with_the_reader
def test_the_ring_beyond_is_clipped_to_the_picture_and_empty_past_it(tmp_path: Path):
    """Words at the very top: what of the ring beyond is on the picture is read; a ring all past it has no colours."""
    from media.text import ring_colours
    import numpy as np

    picture = np.full((200, 100, 3), 90, dtype=np.uint8)
    assert ring_colours(picture, (10, 0, 90, 20), 20, 3) == [{"hex": "#5a5a5a", "share": 1.0}]
    assert ring_colours(picture, (0, 0, 100, 200), 300, 5) == []


# ── the sheet (Task 9c) ──────────────────────────────────────────────────────────────────────────────────────────────


def test_the_sheet_takes_twelve_moments_spread_evenly_the_first_and_the_last_among_them():
    at = moments(30_000)
    chosen = sheet_moments(at)
    assert len(chosen) == SHEET_CELLS == 12 and chosen[0] == at[0] and chosen[-1] == at[-1] and chosen == sorted(set(chosen))
    assert chosen == [at[round(i * 39 / 11)] for i in range(12)]
    assert sheet_moments(at[:5]) == at[:5]


@with_the_reader
def test_the_sheet_is_twelve_frames_four_across_each_a_quarter_of_the_stage_letterboxed(tmp_path: Path):
    """A 16:9 upload of 10 s: twelve frames, 1080 × 1440, each picture scaled into its 270 × 480 cell with black above and
    below; a JPEG at quality 85."""
    from PIL import Image

    path = tmp_path / "wide.mp4"
    ffmpeg("-f", "lavfi", "-i", "color=c=0xc8c8c8:size=1280x720:rate=30:duration=10", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", str(path))
    on_screen = text(path, probe(path)["ms"], tmp_path)
    assert len(on_screen["sheet"]["ms"]) == 12 and on_screen["sheet"]["ms"][0] == 250
    with Image.open(tmp_path / "sheet.jpg") as sheet:
        assert (sheet.format, sheet.size) == ("JPEG", (4 * CELL[0], 3 * CELL[1]))
        pixels = sheet.convert("L")
        # The cell's picture is 270 × 152, centred: black from its top to 164, grey in its middle.
        assert pixels.getpixel((135, 40)) < 20 and pixels.getpixel((135, 240)) > 170 and pixels.getpixel((135, 440)) < 20


@with_the_reader
def test_an_upload_stored_on_its_side_is_read_upright(tmp_path: Path):
    """A phone's take is stored on its side and turned to be shown: the stage reads the file itself, upright."""
    from PIL import ImageDraw, ImageFont

    picture = flat((60, 60, 60))
    draw = ImageDraw.Draw(picture)
    font = ImageFont.load_default(size=SIZE)
    draw.text((200, 900), "turned words", font=font, fill=WHITE)
    landscape = upload(tmp_path, picture.rotate(90, expand=True), seconds=0.5, name="landscape.mp4")
    turned(landscape, tmp_path / "upright.mp4")
    assert (probe(tmp_path / "upright.mp4")["w"], probe(tmp_path / "upright.mp4")["h"]) == (W, H)
    [sample] = read(tmp_path / "upright.mp4", 500)
    assert [line["text"] for line in sample["lines"]] == ["turned words"]
