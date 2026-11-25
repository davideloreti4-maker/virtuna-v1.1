"""Where the face and the mouth are in a take (X48): five samples a second, on the preview copy.

The preview copy is the take upright at constant 30 or 60 pictures a second (X44), so a sample is
every 6th frame at 30 and every 12th at 60, chosen by frame number as ffmpeg decodes them to RGB,
and its `ms` is `round(index × 1000 / fps)`: exactly on a 200 ms grid.

Each is given to MediaPipe's Face Landmarker (its Tasks API, in the video mode, each sample's `ms` as
its time), which finds up to three faces and 478 landmarks on each. The largest face by area is kept:
in a talking head, the speaker. Its box is the box of all its landmarks; the mouth's is the box of its
outer lips (`OUTER_LIPS`). Both are shares of the picture as shown, clamped to it and rounded to 4
decimals. A sample with no face found has neither. The confidences are MediaPipe's defaults (0.5).

MediaPipe and its model are in the speech image (`media/models.py`, `worker/app.py`); the rest is
plain Python and ffmpeg.
"""

import math
import subprocess
import tempfile
from collections.abc import Iterator, Sequence
from pathlib import Path
from typing import TypedDict

from media.models import FACES_MODEL
from media.probe import Facts, probe
from media.refusal import Refusal

PER_SECOND = 5
MOST_FACES = 3
POINTS = 478  # the Face Landmarker's landmarks on a face (its mesh's 468 and the irises' 10)
# The outer edge of the lips in the Face Landmarker's mesh, as its FaceLandmarksConnections.FACE_LANDMARKS_LIPS
# draws them (mediapipe 1.2.3): the lower lip from the right corner (61) to the left (291), then the upper
# lip back. The inner edge (78, 95, 88, …) is left out: an open mouth is the lips' whole box.
OUTER_LIPS = (61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185)


class Box(TypedDict):
    """A box as shares of the picture as shown: its left, its top, its width and its height."""

    x: float
    y: float
    w: float
    h: float


class FaceSample(TypedDict):
    ms: int
    face: Box | None
    mouth: Box | None


def faces(preview: str | Path) -> list[FaceSample]:
    """The face and mouth five times a second in a preview copy, in order. Needs MediaPipe: the speech image."""
    import numpy as np
    from mediapipe import Image, ImageFormat
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions, RunningMode

    facts = probe(preview)
    options = FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=FACES_MODEL), running_mode=RunningMode.VIDEO,
                                    num_faces=MOST_FACES)
    found: list[FaceSample] = []
    # A landmarker for each take: in the video mode its times must only go forward.
    with FaceLandmarker.create_from_options(options) as landmarker:
        for index, rgb in frames(preview, facts, every(facts["fps"])):
            ms = round(index * 1000 / facts["fps"])
            picture = Image(image_format=ImageFormat.SRGB, data=np.frombuffer(rgb, dtype=np.uint8).reshape(facts["h"], facts["w"], 3))
            result = landmarker.detect_for_video(picture, ms)
            found.append(sample(ms, [[(point.x, point.y) for point in face] for face in result.face_landmarks]))
    return found


def every(fps: float) -> int:
    """Frames from one sample to the next: 6 at 30 a second, 12 at 60."""
    return round(fps / PER_SECOND)


def frames(path: str | Path, facts: Facts, step: int) -> Iterator[tuple[int, bytes]]:
    """Every `step`th frame of `path` from the first, with its number, as RGB (`facts`' width × height × 3
    bytes, row by row from the top). ffmpeg chooses them by frame number and passes their times through,
    so none is repeated or dropped. RuntimeError naming the file with ffmpeg's own words."""
    size = facts["w"] * facts["h"] * 3
    command = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path), "-map", "0:v:0",
               "-vf", f"select=not(mod(n\\,{step}))", "-fps_mode", "passthrough", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    with tempfile.TemporaryFile() as said, subprocess.Popen(command, stdout=subprocess.PIPE, stderr=said) as decoding:
        read_to_the_end = False
        try:
            index = 0
            while chunk := decoding.stdout.read(size):
                if len(chunk) < size:
                    raise RuntimeError(f"{path}: ffmpeg gave {len(chunk)} bytes of a frame of {size}")
                yield index, chunk
                index += step
            read_to_the_end = True
        finally:
            if not read_to_the_end:  # stopped early (a failure, or the caller done): ffmpeg is not left running
                decoding.kill()
        if decoding.wait() != 0:
            said.seek(0)
            raise RuntimeError(f"{path}: ffmpeg failed ({decoding.returncode}): {said.read().decode(errors='replace').strip()}")


def sample(ms: int, found: list[Sequence[tuple[float, float]]]) -> FaceSample:
    """The sample at `ms` from the faces found there, each as its landmarks' (x, y) in shares of the
    picture: the largest face's box and its mouth's, or neither when none was found."""
    if not found:
        return FaceSample(ms=ms, face=None, mouth=None)
    face, points = max(((box(points), points) for points in found), key=lambda pair: pair[0]["w"] * pair[0]["h"])
    return FaceSample(ms=ms, face=face, mouth=box([points[i] for i in OUTER_LIPS]))


def box(points: Sequence[tuple[float, float]]) -> Box:
    """The box of `points` (shares), clamped to the picture and rounded to 4 decimals, its edges first so
    that it never reaches past the picture."""
    xs, ys = [shared(x) for x, _ in points], [shared(y) for _, y in points]
    return Box(x=min(xs), y=min(ys), w=round(max(xs) - min(xs), 4), h=round(max(ys) - min(ys), 4))


def shared(value: float) -> float:
    """`value` clamped to the picture and rounded; ValueError for one that is not a number (NaN or infinite)."""
    if not math.isfinite(value):
        raise Refusal(f"a landmark at {value}: not a number")
    return round(min(max(value, 0.0), 1.0), 4)
