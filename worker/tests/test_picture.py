"""How a take's picture looks (X97, `media/picture.py`): its brightness, saturation and warmth every 500 ms, on files made
here with ffmpeg."""

from pathlib import Path

import pytest

from helpers import ffmpeg
from media.picture import picture


def coloured(folder: Path, colour: str, seconds: float = 2, rate: int = 30) -> Path:
    path = folder / f"{colour}-{rate}.mp4"
    ffmpeg("-f", "lavfi", "-i", f"color=c={colour}:size=320x240:rate={rate}:duration={seconds}", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", str(path))
    return path


def test_a_grey_picture_has_no_saturation_and_no_warmth(tmp_path: Path):
    found = picture(coloured(tmp_path, "gray"))
    assert found and all(x["sat"] <= 0.02 and abs(x["warmth"]) <= 0.02 for x in found), found
    assert all(0.45 <= x["luma"] <= 0.55 for x in found), found


def test_orange_is_warm_and_blue_is_cool(tmp_path: Path):
    orange, blue = picture(coloured(tmp_path, "orange")), picture(coloured(tmp_path, "blue"))
    assert all(x["warmth"] > 0.2 and x["sat"] > 0.3 for x in orange), orange
    assert all(x["warmth"] < -0.2 and x["sat"] > 0.3 for x in blue), blue
    assert all(x["luma"] > y["luma"] for x, y in zip(orange, blue))  # orange is the brighter


@pytest.mark.parametrize("rate", [30, 60])
def test_a_sample_every_500_ms_from_0(tmp_path: Path, rate: int):
    found = picture(coloured(tmp_path, "gray", seconds=5, rate=rate))
    assert [x["ms"] for x in found] == list(range(0, 5000, 500))


def test_each_sample_is_the_frame_at_its_time_its_values_in_range_to_three_places(tmp_path: Path):
    """Black for a second and a half, then white: the samples at 0 to 1000 ms dark, those from 1500 ms bright."""
    path = tmp_path / "black-white.mp4"
    ffmpeg("-f", "lavfi", "-i", "color=c=black:size=320x240:rate=30:duration=1.5[a];color=c=white:size=320x240:rate=30:duration=1.5[b];[a][b]concat=n=2:v=1:a=0",
           "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(path))
    found = picture(path)
    assert [x["luma"] < 0.2 for x in found] == [True, True, True, False, False, False], found
    for x in found:
        assert set(x) == {"ms", "luma", "sat", "warmth"}
        assert 0 <= x["luma"] <= 1 and 0 <= x["sat"] <= 1 and -1 <= x["warmth"] <= 1
        assert all(round(x[key], 3) == x[key] for key in ("luma", "sat", "warmth"))


def test_a_file_ffmpeg_cannot_read_fails_naming_it(tmp_path: Path):
    path = tmp_path / "notes.mp4"
    path.write_text("not a video\n" * 100)
    with pytest.raises(RuntimeError, match=r"notes\.mp4: ff(mpeg|probe) failed"):
        picture(path)
