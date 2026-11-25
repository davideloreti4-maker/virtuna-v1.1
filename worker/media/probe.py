"""What ffprobe says about a take: its length per stream, its size as shown, its frame rate and colours.

Facts are measured once, here on the worker, and stored (N5). The app reads them as JSON, so the
keys are camelCase.
"""

import json
from decimal import Decimal
from pathlib import Path
from typing import TypedDict

from media.refusal import Refusal
from media.tool import run


class Facts(TypedDict):
    """Lengths are ffprobe's stream durations, which leave out where a stream starts (`start_time`).
    So `ms` is where a file ends only for one whose streams start at 0, as the copies do.
    """

    videoMs: int  # the picture's length
    audioMs: int | None  # the sound's length; None when there is no sound
    ms: int  # the shorter of the two
    w: int  # width as shown, after rotation
    h: int  # height as shown, after rotation
    fps: float  # the average frame rate
    codec: str  # the picture's codec, as ffprobe names it
    hdr: bool  # filmed in HDR (PQ or HLG)
    sound: bool
    rotation: int  # how far the picture is turned clockwise to be shown: 0, 90, 180 or 270


HDR_TRANSFERS = {"smpte2084", "arib-std-b67"}  # PQ and HLG
# ffprobe's name for the one demuxer it reads both MP4 and QuickTime (MOV) with.
MP4_OR_QUICKTIME = "mov,mp4,m4a,3gp,3g2,mj2"


def container(path: str | Path) -> tuple[str, str]:
    """The file's container as ffprobe names it, and its long name ("QuickTime / MOV", "Matroska / WebM")."""
    info = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "format=format_name,format_long_name", "-of", "json", str(path)], path))
    return info["format"]["format_name"], info["format"].get("format_long_name", info["format"]["format_name"])


def probe(path: str | Path) -> Facts:
    """The facts of a file.

    Raises RuntimeError with ffprobe's own words when it cannot read the file, and ValueError when
    it finds no picture, no length or no frame rate.
    """
    info = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], path))
    video = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if video is None:
        raise Refusal(f"{path}: no picture in this file")

    # A stream's own length when the file gives one (MP4 and MOV do), else the whole file's (Matroska).
    file_length = info["format"].get("duration")
    video_ms = _ms(video.get("duration") or file_length, path)
    audio_ms = _ms(audio.get("duration") or file_length, path) if audio else None
    num, den = map(int, video.get("avg_frame_rate", "0/0").split("/"))
    if not (num and den):
        raise Refusal(f"{path}: ffprobe gives no frame rate")
    rotation = _rotation(video)
    w, h = video["width"], video["height"]
    if rotation in (90, 270):
        w, h = h, w

    return Facts(
        videoMs=video_ms,
        audioMs=audio_ms,
        ms=video_ms if audio_ms is None else min(video_ms, audio_ms),
        w=w,
        h=h,
        fps=round(num / den, 3),
        codec=video["codec_name"],
        hdr=video.get("color_transfer") in HDR_TRANSFERS,
        sound=audio is not None,
        rotation=rotation,
    )


def _ms(seconds: str | None, path: str | Path) -> int:
    """Whole milliseconds, rounded down, so a length is never said to be longer than it is.

    Decimal, because ffprobe's "1.001000" as a float times 1000 is 1000.999...
    """
    if seconds is None:
        raise Refusal(f"{path}: ffprobe gives no length")
    return int(Decimal(seconds) * 1000)


def _rotation(video: dict) -> int:
    """Clockwise degrees. ffprobe gives the display matrix's angle counter-clockwise, -180 to 180."""
    for side in video.get("side_data_list", []):
        if "rotation" in side:
            return round(-float(side["rotation"]) / 90) * 90 % 360
    return 0


def stored_ms(full: Facts, preview: Facts) -> int:
    """The length a take is given in an edit (X45): the shorter of the two copies, as ffprobe gives them.

    A copy is as long as its shorter stream, but for a sound that ends more than a frame before the
    picture: then it is as long as its picture. Measured on the owner's take and the test files
    (plan, Task 3): Chromium reports the longer stream, WebKit the picture's length or the sound's
    less about 23 ms, whichever is longer. Where the sound ends early, both browsers and the renderer
    show the picture to its end, and the renderer's film is silent after the sound. So the stored
    length is never longer than what either browser says, and a film never asks for a moment past
    a file's end.
    """
    return min(plays_ms(full), plays_ms(preview))


def plays_ms(copy: Facts) -> int:
    """How long a file plays, as a take is stored (`stored_ms`): its shorter stream, or its picture when the
    sound ends more than a frame before it."""
    audio_ms, video_ms = copy["audioMs"], copy["videoMs"]
    if audio_ms is not None and video_ms - audio_ms > 1000 / copy["fps"]:
        return video_ms
    return copy["ms"]
