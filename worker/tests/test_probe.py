import json
import sys

import pytest

from helpers import AAC, H264, cut_off, ffmpeg, not_a_video, picture, tone
from media.probe import probe, stored_ms
from media.tool import run
from media.transcode import transcode


@pytest.mark.parametrize(
    "name, codec, fps, hdr, sound, rotation, w, h, video_ms",
    [
        ("h264_30", "h264", 30.0, False, True, 0, 1280, 720, 2000),
        ("hevc_hlg_60", "hevc", 60.0, True, True, 0, 2560, 1440, 2000),
        # 50 pictures over a little less than 2 s; how much less depends on the encoder.
        ("vfr", "h264", pytest.approx(25.5, abs=1), False, True, 0, 640, 360, pytest.approx(1950, abs=50)),
        ("rotated", "h264", 30.0, False, True, 90, 720, 1280, 2000),
        ("silent", "h264", 30.0, False, False, 0, 640, 480, 2000),
    ],
)
def test_facts_of_each_kind_of_take(takes, name, codec, fps, hdr, sound, rotation, w, h, video_ms):
    facts = probe(takes[name].path)

    assert (facts["codec"], facts["fps"], facts["hdr"], facts["sound"]) == (codec, fps, hdr, sound)
    assert (facts["rotation"], facts["w"], facts["h"]) == (rotation, w, h)
    assert facts["videoMs"] == video_ms
    if sound:
        assert facts["audioMs"] >= 2000
        assert facts["ms"] == min(facts["videoMs"], facts["audioMs"])
    else:
        assert facts["audioMs"] is None
        assert facts["ms"] == facts["videoMs"]


def test_lengths_are_whole_milliseconds_rounded_down(tmp_path):
    # 1001 pictures at 1000 a second: 1.001 s, which a float times 1000 makes 1000.9999...
    path = tmp_path / "odd.mp4"
    ffmpeg(*picture("64x64", 1000, 1.001), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path))

    assert probe(path)["videoMs"] == 1001


def test_a_file_without_stream_lengths_takes_the_files_length(tmp_path):
    # Matroska gives no length per stream, only for the whole file.
    path = tmp_path / "take.mkv"
    ffmpeg(*picture("320x240", 30, 2), *tone(2), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path))

    facts = probe(path)

    assert 2000 <= facts["videoMs"] <= 2050
    assert 2000 <= facts["audioMs"] <= 2050


def test_a_file_without_a_picture_is_refused(tmp_path):
    path = tmp_path / "sound.m4a"
    ffmpeg(*tone(1), "-c:a", "aac", str(path))

    with pytest.raises(ValueError, match="no picture"):
        probe(path)


def test_a_file_that_is_not_a_video_is_refused_in_ffprobes_words(tmp_path):
    path = not_a_video(tmp_path)

    with pytest.raises(RuntimeError, match="Invalid data found when processing input") as refused:
        probe(path)
    assert str(path) in str(refused.value)


def test_a_cut_off_video_is_refused_in_ffprobes_words(takes, tmp_path):
    path = cut_off(takes["h264_30"].path, tmp_path)

    with pytest.raises(RuntimeError, match="moov atom not found") as refused:
        probe(path)
    assert str(path) in str(refused.value)


def copy(video_ms: int, audio_ms: int | None, fps: float = 30.0) -> dict:
    """A copy's facts as far as its stored length goes."""
    return {"videoMs": video_ms, "audioMs": audio_ms, "ms": video_ms if audio_ms is None else min(video_ms, audio_ms), "fps": fps}


# Measured 2026-11-20 (plan, Task 3): each copy's streams as `probe` gives them, and the length
# Chromium and WebKit report for the same file in a <video>. Chromium gives the longer stream;
# WebKit the picture's length or the sound's less about 23 ms, whichever is longer. Where the sound
# ends before the picture, both browsers and the renderer show the picture to its end (box 4).
MEASURED = [
    # (what, full copy's facts, preview copy's facts, Chromium, WebKit, stored), in ms, the same for both copies
    ("the owner's take", copy(12700, 12714), copy(12700, 12714), 12714, 12700, 12700),
    ("H.264 at 30 fps", copy(2000, 2005), copy(2000, 2005), 2005, 2000, 2000),
    ("variable frame rate", copy(1966, 2005), copy(1966, 2005), 2005, 1982.3, 1966),
    ("no sound", copy(2000, None), copy(2000, None), 2000, 2000, 2000),
    ("sound starting late", copy(2000, 2014), copy(2000, 2014), 2014, 2000, 2000),
    ("sound ending 1 s early", copy(3000, 2005), copy(3000, 2005), 3000, 3000, 3000),
]


@pytest.mark.parametrize("what, full, preview, chromium, webkit, stored", MEASURED, ids=[m[0] for m in MEASURED])
def test_the_stored_length_is_never_longer_than_any_reader_says(what, full, preview, chromium, webkit, stored):
    ms = stored_ms(full, preview)

    assert ms == stored
    assert ms <= min(chromium, webkit, full["videoMs"], preview["videoMs"])


def test_the_stored_length_is_the_shorter_copy():
    full, preview = copy(2000, 2005), copy(1990, 2005)

    assert stored_ms(full, preview) == stored_ms(preview, full) == 1990


@pytest.mark.parametrize("video_ms, audio_ms, fps, stored", [
    (3000, 2005, 30, 3000),  # the sound ends long before the picture: the picture's length
    (3000, 2966, 30, 3000),  # by 34 ms, more than a frame at 30 a second
    (3000, 2967, 30, 2967),  # by 33 ms, within a frame: the sound's
    (3000, 2984, 60, 2984),  # by 16 ms, within a frame at 60 a second
    (3000, 2983, 60, 3000),  # by 17 ms, more than one
    (1966, 2005, 30, 1966),  # the picture is the shorter: its length, however far
])
def test_a_sound_that_ends_more_than_a_frame_early_leaves_the_picture_its_length(video_ms, audio_ms, fps, stored):
    assert stored_ms(copy(video_ms, audio_ms, fps), copy(video_ms, audio_ms, fps)) == stored


def test_a_take_whose_sound_ends_early_is_stored_as_long_as_its_picture(tmp_path):
    # Sound for the first 2 s of a 3 s picture: the copies keep both as they are, and the take is 3 s long.
    source = tmp_path / "early.mp4"
    ffmpeg(*picture("320x240", 30, 3), *tone(2), *H264, *AAC, str(source))

    out = transcode(source, probe(source), tmp_path / "out")
    full, preview = probe(out["full"]), probe(out["preview"])

    for facts in (full, preview):
        assert facts["videoMs"] == 3000
        assert 2000 <= facts["audioMs"] <= 2050
    assert stored_ms(full, preview) == 3000


ODD_BYTES = r"""import sys
sys.stdout.buffer.write(b'{"title": "caf\xe9"}')
sys.stderr.buffer.write(b'caf\xe9 broke')
sys.exit(int(sys.argv[1]))
"""


def test_a_tool_s_odd_bytes_are_kept_as_replacement_characters_not_a_decoding_error():
    """13: a tag in a take's metadata may hold bytes that are not UTF-8 (ffprobe 8 replaces them itself; 5.1, the image's,
    is not known to). What the tool wrote is read with those bytes replaced, its output and its failure's words alike."""
    assert json.loads(run([sys.executable, "-c", ODD_BYTES, "0"], "take.mov")) == {"title": "caf\ufffd"}
    with pytest.raises(RuntimeError, match=r"^take\.mov: .* failed \(3\): caf\ufffd broke$"):
        run([sys.executable, "-c", ODD_BYTES, "3"], "take.mov")
