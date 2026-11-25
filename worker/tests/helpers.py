"""What the tests share: making files with ffmpeg (never downloading them) and reading them with ffprobe."""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def ffprobe(*args: str) -> str:
    return subprocess.run(["ffprobe", "-v", "error", *args], check=True, capture_output=True, text=True).stdout


def streams(path: Path, kind: str) -> list[dict]:
    """The streams of one kind ("video" or "audio") as ffprobe gives them."""
    out = json.loads(ffprobe("-show_streams", "-of", "json", str(path)))
    return [s for s in out["streams"] if s["codec_type"] == kind]


def tags(path: Path) -> dict[str, str]:
    """The file's own metadata (title, comment, date...), names in lower case."""
    out = json.loads(ffprobe("-show_entries", "format_tags", "-of", "json", str(path)))
    return {k.lower(): v for k, v in out["format"].get("tags", {}).items()}


def frame_times(path: Path, keys_only: bool = False) -> list[float]:
    """When each picture of a file is shown, in seconds; only the keyframes when asked."""
    skip = ["-skip_frame", "nokey"] if keys_only else []
    out = ffprobe("-select_streams", "v:0", *skip, "-show_entries", "frame=pts_time", "-of", "csv=p=0", str(path))
    return sorted(float(line.strip(",")) for line in out.split())


def picture(size: str, rate: int | str, seconds: float) -> list[str]:
    return ["-f", "lavfi", "-i", f"testsrc2=size={size}:rate={rate}:duration={seconds}"]


def tone(seconds: float) -> list[str]:
    return ["-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=48000:duration={seconds}"]


H264 = ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
AAC = ["-c:a", "aac"]


def not_a_video(folder: Path) -> Path:
    """A text file named like a video."""
    path = folder / "notes.mp4"
    path.write_text("not a video\n" * 100)
    return path


def cut_off(video: Path, folder: Path) -> Path:
    """The first 64 KB of a video whose index is at its end, as an upload that stopped halfway."""
    path = folder / "cut.mp4"
    path.write_bytes(video.read_bytes()[: 64 * 1024])
    return path


@dataclass(frozen=True)
class Take:
    """A test file and what its copies should be."""

    path: Path
    full: tuple[int, int]
    preview: tuple[int, int]
    rate: int
    sound: bool


# How this ffmpeg says a picture is turned: `-display_rotation`, which ffmpeg 8 has and 5.1 (Debian 12,
# the worker's image) lacks; there the `rotate` tag, which 5.1's ffmpeg tool turns into a display matrix when it copies
# the stream, anticlockwise (`rotate=90` was read back as a quarter turn anticlockwise, measured on 5.1.9) and 8 ignores.
HAS_DISPLAY_ROTATION = "-display_rotation" in subprocess.run(
    ["ffmpeg", "-hide_banner", "-h", "long"], capture_output=True, text=True
).stdout


def turned(landscape: Path, path: Path) -> None:
    """`landscape` as a phone stores a take filmed upright: on its side, turned a quarter clockwise to be shown."""
    if HAS_DISPLAY_ROTATION:
        ffmpeg("-display_rotation", "270", "-i", str(landscape), "-c", "copy", str(path))
    else:
        ffmpeg("-i", str(landscape), "-c", "copy", "-metadata:s:v:0", "rotate=270", str(path))


NAMES = ["h264_30", "hevc_hlg_60", "vfr", "rotated", "silent"]


def talking_head(folder: Path, picture: list[str], seconds: float = 3, name: str = "head.mp4") -> Path:
    """The plan's stand-in for a talking head: a still picture, and a stereo 1 kHz tone at -23 dBFS (so -23 LUFS)."""
    path = folder / name
    wave = "0.0707946*sin(2*PI*1000*t)"
    ffmpeg(*picture, "-f", "lavfi", "-i", f"aevalsrc={wave}|{wave}:s=48000:d={seconds}", "-t", str(seconds),
           "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k",
           "-movflags", "+faststart", str(path))
    return path


def a_still(folder: Path) -> list[str]:
    still = folder / "still.png"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=1:duration=1", "-frames:v", "1", str(still))
    return ["-loop", "1", "-framerate", "30", "-i", str(still)]
