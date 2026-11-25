"""Where a take's picture changes from one shot to the next (X97, `media/scenes.py`), on files made here with ffmpeg.

ffmpeg's scene detection reads the luma only, so each hard change here is to a colour of another brightness.
"""

from pathlib import Path

import pytest

from helpers import ffmpeg
from media.scenes import THRESHOLD, cuts

FRAME_MS = 1000 / 30


def colours(folder: Path, rate: int) -> Path:
    """Five seconds: black, then orange from 1.0 s, navy from 2.5 s and white from 4.0 s, each change a hard cut."""
    path = folder / f"colours{rate}.mp4"
    parts = [("black", 1), ("orange", 1.5), ("navy", 1.5), ("white", 1)]
    graph = ";".join(f"color=c={colour}:size=320x240:rate={rate}:duration={seconds}[{i}]" for i, (colour, seconds) in enumerate(parts))
    ffmpeg("-f", "lavfi", "-i", f"{graph};{''.join(f'[{i}]' for i in range(len(parts)))}concat=n={len(parts)}:v=1:a=0",
           "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(path))
    return path


@pytest.mark.parametrize("rate", [30, 60])
def test_three_hard_colour_changes_give_three_cuts_each_within_a_frame(tmp_path: Path, rate: int):
    found = cuts(colours(tmp_path, rate))
    assert len(found) == 3, found
    assert all(isinstance(ms, int) for ms in found) and found == sorted(found)
    assert all(abs(ms - at) <= FRAME_MS for ms, at in zip(found, [1000, 2500, 4000])), found


def test_slowly_moving_noise_gives_none(tmp_path: Path):
    """A grain picture, softened as a lens softens it, drifting 40 pixels a second across and 20 down: five seconds, one shot."""
    grain = tmp_path / "grain.png"
    ffmpeg("-f", "lavfi", "-i", "color=c=gray:size=960x720,noise=alls=100:allf=u,gblur=sigma=4", "-frames:v", "1", str(grain))
    drifting = tmp_path / "drifting.mp4"
    ffmpeg("-loop", "1", "-framerate", "30", "-i", str(grain), "-vf", "crop=640:360:x='t*40':y='t*20',format=yuv420p", "-t", "5",
           "-c:v", "libx264", "-preset", "ultrafast", str(drifting))
    assert cuts(drifting) == []


def test_grain_that_changes_every_frame_gives_none(tmp_path: Path):
    """A camera's noise: new on every frame, on a grey picture."""
    grainy = tmp_path / "grainy.mp4"
    ffmpeg("-f", "lavfi", "-i", "color=c=gray:size=640x360:rate=30:duration=5,noise=alls=40:allf=t+u", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", str(grainy))
    assert cuts(grainy) == []


def test_a_one_second_cross_fade_gives_at_most_one(tmp_path: Path):
    faded = tmp_path / "faded.mp4"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=2.5", "-f", "lavfi", "-i", "color=c=white:size=640x360:rate=30:duration=2.5",
           "-filter_complex", "[0][1]xfade=transition=fade:duration=1:offset=1.5,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", str(faded))
    assert len(cuts(faded)) <= 1


def test_the_threshold_is_the_plan_s():
    assert THRESHOLD == 10


def test_a_file_ffmpeg_cannot_read_fails_naming_it(tmp_path: Path):
    path = tmp_path / "notes.mp4"
    path.write_text("not a video\n" * 100)
    with pytest.raises(RuntimeError, match=r"notes\.mp4: ffmpeg failed"):
        cuts(path)
