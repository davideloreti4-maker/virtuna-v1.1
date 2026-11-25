"""Where the face and the mouth are (X48), five samples a second on the preview copy.

Here: which frames are sampled and when, and the boxes made from a face's landmarks. In the speech
image on Modal, where MediaPipe and its model are: pictures with no face, and the owner's take.
"""

import importlib.util
import math
from pathlib import Path
from statistics import median

import pytest

from helpers import ffmpeg
from media.faces import OUTER_LIPS, POINTS, box, every, frames, sample
from media.probe import probe

# The owner's take's preview copy in the Volume edit-dev-media, mounted in the suite's container.
PREVIEW = Path("/dev-media/takes/take.mp4/preview.mp4")

in_the_image = pytest.mark.skipif(importlib.util.find_spec("mediapipe") is None, reason="MediaPipe and its model are in the speech image on Modal")
with_the_take = pytest.mark.skipif(importlib.util.find_spec("mediapipe") is None or not PREVIEW.exists(),
                                   reason="MediaPipe and the owner's take are in the speech image on Modal")


def numbered(folder: Path, rate: int, seconds: float) -> Path:
    """A grey film whose frame n is lit 2n levels (of 255) above black, losslessly, so each frame says its number."""
    path = folder / f"numbered-{rate}.mp4"
    ffmpeg("-f", "lavfi", "-i", f"color=c=black:s=64x36:r={rate}:d={seconds},format=yuv444p,geq=lum='16+N*2':cb=128:cr=128",
           "-c:v", "libx264", "-qp", "0", "-pix_fmt", "yuv444p", str(path))
    return path


def lit(rgb: bytes) -> float:
    """How lit a grey RGB frame is, as the frame number `numbered` drew: its first pixel's red, back to luma steps of 2."""
    return (rgb[0] * 219 / 255) / 2


# Two seconds at 30 and one at 60: 60 frames each, so every frame's level stays inside limited range.
@pytest.mark.parametrize(("rate", "step", "seconds"), [(30, 6, 2), (60, 12, 1)])
def test_five_samples_a_second_by_frame_number_on_a_200_ms_grid(rate: int, step: int, seconds: int, tmp_path: Path):
    film = numbered(tmp_path, rate, seconds)
    facts = probe(film)
    assert every(facts["fps"]) == step
    taken = list(frames(film, facts, step))
    assert [index for index, _ in taken] == list(range(0, seconds * rate, step))
    # Each sample is the frame of its number, not a neighbour: they are 2 levels apart.
    assert all(abs(lit(rgb) - index) <= 0.75 for index, rgb in taken), [(index, lit(rgb)) for index, rgb in taken]
    assert all(len(rgb) == facts["w"] * facts["h"] * 3 for _, rgb in taken)
    assert [round(index * 1000 / facts["fps"]) for index, _ in taken] == list(range(0, seconds * 1000, 200))


def a_face(left: float, top: float, size: float) -> list[tuple[float, float]]:
    """478 landmarks standing in for a face: spread over a square of `size` from (`left`, `top`), the
    outer lips on a ring in its lower part, the inner lips on a smaller ring inside it but for one, put
    far out to the side, which the mouth's box must not take in."""
    points = [(left + size * (i % 22) / 21, top + size * (i // 22) / 21) for i in range(POINTS)]
    cx, cy = left + size / 2, top + 0.78 * size
    for k, i in enumerate(OUTER_LIPS):
        a = 2 * math.pi * k / len(OUTER_LIPS)
        points[i] = (cx + 0.2 * size * math.cos(a), cy + 0.08 * size * math.sin(a))
    points[78] = (left + 0.05 * size, cy)  # an inner-lip corner, out of place
    return points


def test_the_face_is_all_its_landmarks_and_the_mouth_its_outer_lips():
    found = sample(400, [a_face(0.3, 0.2, 0.4)])
    assert found["ms"] == 400
    assert found["face"] == {"x": 0.3, "y": 0.2, "w": 0.4, "h": 0.4}
    assert found["mouth"] == {"x": 0.42, "y": 0.4800, "w": 0.16, "h": 0.064}


def test_boxes_are_shares_of_the_picture_clamped_and_rounded():
    assert box([(-0.05, 0.123456), (0.5, 1.2)]) == {"x": 0.0, "y": 0.1235, "w": 0.5, "h": 0.8765}
    assert box([(0.33333333, 0.1), (0.66666666, 0.2)]) == {"x": 0.3333, "y": 0.1, "w": 0.3334, "h": 0.1}


def test_of_several_faces_the_largest_is_the_speaker():
    found = sample(0, [a_face(0.05, 0.05, 0.1), a_face(0.3, 0.3, 0.5), a_face(0.7, 0.1, 0.2)])
    assert found["face"] == {"x": 0.3, "y": 0.3, "w": 0.5, "h": 0.5}


def test_no_face_found_is_none():
    assert sample(1200, []) == {"ms": 1200, "face": None, "mouth": None}


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_a_landmark_that_is_not_a_number_is_refused_not_clamped(bad: float):
    with pytest.raises(ValueError, match="not a number"):
        box([(0.2, 0.3), (bad, 0.5)])


def test_a_decode_stopped_early_ends_at_once_and_says_nothing_failed(tmp_path: Path):
    # As when a sample fails: the frames are given up after the first. ffmpeg is stopped there (M1), and
    # its being stopped is no failure of its own; a decode read to its end is never stopped (the test above).
    film = numbered(tmp_path, 30, 2)
    taken = frames(film, probe(film), 6)
    assert next(taken)[0] == 0
    taken.close()
    assert taken.gi_frame is None


# In the speech image.

@in_the_image
@pytest.mark.parametrize("picture", ["color=c=0x6a7f5c:s=540x960:r=30:d=2", "color=c=gray:s=540x960:r=30:d=2,noise=alls=80:allf=t"],
                         ids=["plain colour", "noise"])
def test_a_picture_with_no_face_has_no_face_in_any_sample(picture: str, tmp_path: Path):
    from media.faces import faces

    film = tmp_path / "no-face.mp4"
    ffmpeg("-f", "lavfi", "-i", picture, "-c:v", "libx264", "-pix_fmt", "yuv420p", str(film))
    found = faces(film)
    assert [x["ms"] for x in found] == list(range(0, 2000, 200))
    assert all(x["face"] is None and x["mouth"] is None for x in found), found


def inside(small: dict, large: dict) -> bool:
    return large["x"] <= small["x"] and large["y"] <= small["y"] and small["x"] + small["w"] <= large["x"] + large["w"] + 1e-9 \
        and small["y"] + small["h"] <= large["y"] + large["h"] + 1e-9


def centre(b: dict) -> tuple[float, float]:
    return b["x"] + b["w"] / 2, b["y"] + b["h"] / 2


@with_the_take
def test_the_owners_face_and_mouth_are_found_where_they_are():
    from media.faces import faces

    found = faces(PREVIEW)
    facts = probe(PREVIEW)
    assert [x["ms"] for x in found] == list(range(0, facts["videoMs"], 200))
    # The take, as looked at (`.scratch/stills/faces-*.jpg`, Task 5 run 2): from 3.6 to 5.8 s the camera turns to
    # the laptop while the owner speaks about it, and the face leaves the picture, but for a sliver of it at the
    # edge at 3.6 and 5.8 s. Elsewhere it is on screen.
    on_screen = [x for x in found if x["ms"] <= 3400 or x["ms"] >= 6000]
    seen = [x for x in found if x["face"]]
    with_face = sum(1 for x in on_screen if x["face"])
    assert with_face >= 0.95 * len(on_screen), f"a face in {with_face} of the {len(on_screen)} samples where it is on screen"
    assert not any(x["face"] for x in found if 3800 <= x["ms"] <= 5600), "a face found while the camera shows the laptop"
    # The mouth inside the face holds by construction (its landmarks are among the face's); the lower 40 %
    # and the steadiness below are what say the mouth is where a mouth is.
    assert all(x["mouth"] and inside(x["mouth"], x["face"]) for x in seen)
    # The mouth sits in the lower 40 % of the face.
    assert all((centre(x["mouth"])[1] - x["face"]["y"]) / x["face"]["h"] >= 0.6 for x in seen)
    # The face holds still: its centre moves under 2 % of the picture from one sample to the next, at the median.
    moves = [math.dist(centre(a["face"]), centre(b["face"])) for a, b in zip(found, found[1:]) if a["face"] and b["face"]]
    assert median(moves) < 0.02, median(moves)
