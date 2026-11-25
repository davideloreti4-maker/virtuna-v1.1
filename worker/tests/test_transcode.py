import math
import struct
import subprocess
import wave
from pathlib import Path

import pytest

from helpers import AAC, H264, NAMES, cut_off, ffmpeg, frame_times, not_a_video, picture, streams, tags, tone, turned
from media.probe import probe
from media.transcode import fit, frame_rate, transcode


@pytest.fixture(scope="session")
def copies(takes, tmp_path_factory):
    """Each take's copies, made once for the whole run."""
    return {name: transcode(t.path, probe(t.path), tmp_path_factory.mktemp(name)) for name, t in takes.items()}


def top_boxes(path: Path) -> list[str]:
    """The names of an MP4's top-level boxes, in the order they are in the file."""
    names = []
    with path.open("rb") as f:
        while header := f.read(8):
            size, kind = struct.unpack(">I4s", header)
            if size == 1:
                size = struct.unpack(">Q", f.read(8))[0] - 8
            names.append(kind.decode("latin-1"))
            if size == 0:
                break
            f.seek(size - 8, 1)
    return names


def check_copy(path: Path, take, size: tuple[int, int], crf: str) -> None:
    """What both copies share: H.264 High in SDR at a constant rate, AAC or no sound, fast start."""
    [v] = streams(path, "video")
    assert (v["codec_name"], v["profile"], v["pix_fmt"]) == ("h264", "High", "yuv420p")
    assert f"crf={crf}".encode() in path.read_bytes()
    assert (v["color_transfer"], v["color_primaries"], v["color_space"], v["color_range"]) == ("bt709", "bt709", "bt709", "tv")
    assert (v["width"], v["height"]) == size
    assert v["avg_frame_rate"] == v["r_frame_rate"] == f"{take.rate}/1"
    times = frame_times(path)
    assert times[0] == 0
    assert all(abs(b - a - 1 / take.rate) < 1e-4 for a, b in zip(times, times[1:]))

    facts = probe(path)
    assert (facts["rotation"], facts["w"], facts["h"], facts["hdr"]) == (0, *size, False)

    audio = streams(path, "audio")
    if take.sound:
        [a] = audio
        assert (a["codec_name"], a["sample_rate"], a["channels"], float(a["start_time"])) == ("aac", "48000", 2, 0)
    else:
        assert audio == []

    boxes = top_boxes(path)
    assert boxes.index("moov") < boxes.index("mdat")


def every(seconds: float, ms: int) -> list[float]:
    """Moments `seconds` apart from 0 up to a file `ms` long."""
    return [i * seconds for i in range(math.ceil(ms / (seconds * 1000)))]


@pytest.mark.parametrize("name", NAMES)
def test_the_full_copy_has_a_keyframe_every_second(takes, copies, name):
    take = takes[name]
    full = copies[name]["full"]
    check_copy(full, take, take.full, "18.0")

    # The render starts slices of 120 frames anywhere; a keyframe every second keeps each start cheap.
    assert frame_times(full, keys_only=True) == every(1, probe(full)["videoMs"])


@pytest.mark.parametrize("name", NAMES)
def test_the_preview_copy_has_a_keyframe_every_half_second(takes, copies, name):
    take = takes[name]
    preview = copies[name]["preview"]
    check_copy(preview, take, take.preview, "28.0")

    assert frame_times(preview, keys_only=True) == every(0.5, probe(preview)["videoMs"])


@pytest.mark.parametrize("name", NAMES)
def test_the_poster_is_a_picture_of_the_full_copy(takes, copies, name):
    [p] = streams(copies[name]["poster"], "video")
    assert (p["codec_name"], (p["width"], p["height"])) == ("mjpeg", takes[name].full)


@pytest.mark.parametrize("name", NAMES)
def test_the_sound_for_speech(takes, copies, name):
    sound = copies[name]["sound16k"]
    if not takes[name].sound:
        assert sound is None
        return
    [a] = streams(sound, "audio")
    assert (a["codec_name"], a["sample_rate"], a["channels"]) == ("pcm_s16le", "16000", 1)


@pytest.mark.parametrize("name", NAMES)
def test_a_reference_gets_its_preview_copy_and_its_sound_for_speech_only(takes, copies, tmp_path, name):
    """Task 9c: a reference is never rendered, so no full copy and no poster; its preview copy is as a take's."""
    take = takes[name]
    made = transcode(take.path, probe(take.path), tmp_path, reference=True)
    assert made["full"] is None and made["poster"] is None
    assert sorted(path.name for path in tmp_path.iterdir()) == sorted(["preview.mp4", *(["sound16k.wav"] if take.sound else [])])
    check_copy(made["preview"], take, take.preview, "28.0")
    assert frame_times(made["preview"], keys_only=True) == every(0.5, probe(made["preview"])["videoMs"])
    assert abs(probe(made["preview"])["videoMs"] - probe(copies[name]["preview"])["videoMs"]) <= 1000 / take.rate
    if take.sound:
        [a] = streams(made["sound16k"], "audio")
        assert (a["codec_name"], a["sample_rate"], a["channels"]) == ("pcm_s16le", "16000", 1)
    else:
        assert made["sound16k"] is None


def brightness(jpg: Path) -> float:
    """The mean of a picture's grey levels, 0 to 255."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(jpg), "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                         check=True, capture_output=True).stdout
    return sum(raw) / len(raw)


@pytest.mark.parametrize("seconds, white_from, white_to", [(3, 0.8, 1.2), (1.2, 0.5, 0.7)])
def test_the_poster_is_at_one_second_or_the_middle_of_a_short_take(tmp_path, seconds, white_from, white_to):
    # Black all through but white around the moment the poster should show:
    # 1 s for a 3 s take (its middle would be black), 0.6 s for a 1.2 s take (its 1 s would be black).
    source = tmp_path / "flash.mp4"
    flash = f"color=black:size=320x240:rate=30:duration={seconds},drawbox=color=white:t=fill:enable='between(t,{white_from},{white_to})'"
    ffmpeg("-f", "lavfi", "-i", flash, "-c:v", "libx264", "-pix_fmt", "yuv420p", str(source))

    poster = transcode(source, probe(source), tmp_path / "out")["poster"]

    assert brightness(poster) > 200


def test_a_phone_take_is_turned_the_way_it_is_shown(tmp_path):
    # 45: stored on its side with a white square in its top left corner, and tagged to be turned a quarter clockwise to be
    # shown (as a phone stores a take filmed upright). Turned that way, the square is in the top right corner of the copy;
    # turned the other way (90 and 270 make the same size), it would be in the bottom left.
    stored = tmp_path / "stored.mp4"
    ffmpeg("-f", "lavfi", "-i", "color=black:size=320x180:rate=30:duration=1,drawbox=x=0:y=0:w=60:h=60:color=white:t=fill",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", str(stored))
    turned(stored, tmp_path / "upright.mp4")
    full = transcode(tmp_path / "upright.mp4", probe(tmp_path / "upright.mp4"), tmp_path / "out")["full"]
    w, h = probe(full)["w"], probe(full)["h"]
    assert (w, h) == (180, 320)
    grey = subprocess.run(["ffmpeg", "-v", "error", "-i", str(full), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                          check=True, capture_output=True).stdout
    corner = {name: sum(grey[(y + dy) * w + x + dx] for dy in range(20) for dx in range(20)) / 400
              for name, (x, y) in {"top left": (5, 5), "top right": (w - 25, 5), "bottom left": (5, h - 25), "bottom right": (w - 25, h - 25)}.items()}
    assert corner["top right"] > 200 and max(v for k, v in corner.items() if k != "top right") < 50, corner


def test_the_poster_is_placed_by_the_pictures_length(tmp_path):
    # A picture of 3 s, white around 1 s, whose sound ends at 1.5 s: a poster is a picture, so it is
    # at 1 s, where the middle of the sound (0.75 s) would be black.
    source = tmp_path / "flash.mp4"
    flash = "color=black:size=320x240:rate=30:duration=3,drawbox=color=white:t=fill:enable='between(t,0.8,1.2)'"
    ffmpeg("-f", "lavfi", "-i", flash, *tone(1.5), *H264, *AAC, str(source))
    facts = probe(source)
    assert facts["ms"] < 2000 <= facts["videoMs"]

    poster = transcode(source, facts, tmp_path / "out")["poster"]

    assert brightness(poster) > 200


def test_the_sound_starts_where_the_picture_does(tmp_path):
    # The sound starts half a second after the picture. Words are timed on the 16 kHz sound and
    # shown over the full copy, so both must count from the same moment: the gap is kept as silence.
    source = tmp_path / "late.mp4"
    ffmpeg(*picture("320x240", 30, 2), "-itsoffset", "0.5", *tone(1.5), "-c:v", "libx264", "-pix_fmt", "yuv420p",
           "-c:a", "aac", str(source))

    out = transcode(source, probe(source), tmp_path / "out")

    with wave.open(str(out["sound16k"])) as w:
        samples = struct.unpack(f"<{w.getnframes()}h", w.readframes(w.getnframes()))
    assert len(samples) / 16000 >= 1.98
    assert max(abs(s) for s in samples[: int(0.4 * 16000)]) < 50
    assert max(abs(s) for s in samples[int(0.6 * 16000) : 16000]) > 1000
    for copy in (out["full"], out["preview"]):
        [a] = streams(copy, "audio")
        assert float(a["start_time"]) == 0


def level(path: Path, channel: int, band: str) -> float:
    """The mean level of one channel of a file's sound, in dB, in a band: "low" under 2 kHz, "high" over 6 kHz."""
    cut = "lowpass=f=2000," * 3 if band == "low" else "highpass=f=6000," * 3
    log = subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
                          "-af", f"pan=mono|c0=c{channel},{cut}volumedetect", "-f", "null", "-"], check=True, capture_output=True, text=True).stderr
    return float(log.split("mean_volume: ")[1].split(" dB")[0])


def test_the_copies_keep_the_takes_two_channels_and_its_high_notes(tmp_path):
    # A low tone on the left, a high one (12 kHz) on the right. The 16 kHz sound for speech comes from
    # the same decode in one channel: the copies' sound must not be brought down to it (ffmpeg 5.1 did:
    # both channels the same, nothing over 8 kHz).
    source = tmp_path / "two.mp4"
    sound = "aevalsrc=0.5*sin(2*PI*440*t)|0.5*sin(2*PI*12000*t):s=48000:d=2"
    ffmpeg(*picture("320x240", 30, 2), "-f", "lavfi", "-i", sound, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", str(source))

    out = transcode(source, probe(source), tmp_path / "out")

    for copy in (out["full"], out["preview"]):
        # A tone of peak 0.5 is -9 dB (the filters take 0.5 dB off the high one); what does not belong
        # in a band is 40 dB under it or more.
        assert level(copy, 0, "low") == pytest.approx(-9, abs=1.5), copy
        assert level(copy, 1, "high") == pytest.approx(-9, abs=1.5), copy
        assert level(copy, 0, "high") < -49 and level(copy, 1, "low") < -49, copy


@pytest.mark.parametrize("fps, rate", [(23.976, 30), (25, 30), (29.97, 30), (30, 30), (48, 30), (50, 60), (59.94, 60), (60, 60), (120, 60)])
def test_the_frame_rate_is_30_or_60(fps, rate):
    assert frame_rate(fps) == rate


@pytest.mark.parametrize("w, h, long_side, size", [
    (720, 1280, 1920, (720, 1280)),
    (3840, 2160, 1920, (1920, 1080)),
    (1081, 1921, 1920, (1080, 1920)),
    (641, 361, 1920, (640, 360)),
    (720, 1280, 960, (540, 960)),
    (480, 640, 960, (480, 640)),
])
def test_copies_fit_the_long_side_in_even_pixels_and_never_grow(w, h, long_side, size):
    assert fit(w, h, long_side) == size


def test_the_copies_carry_none_of_the_takes_metadata(tmp_path):
    # The 16 kHz sound goes to an outside service later: no title, comment or date travels with it.
    source = tmp_path / "tagged.mp4"
    ffmpeg(*picture("320x240", 30, 1), *tone(1), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
           "-metadata", "title=Private title", "-metadata", "comment=Private comment", "-metadata", "date=2026-11-20",
           str(source))
    assert {"title", "comment", "date"} <= tags(source).keys()

    out = transcode(source, probe(source), tmp_path / "out")

    for made in (out["full"], out["preview"], out["sound16k"]):
        assert not {"title", "comment", "date"} & tags(made).keys(), made


@pytest.mark.parametrize("bad, words", [("not a video", "Invalid data found when processing input"), ("cut off", "moov atom not found")])
def test_a_broken_file_is_refused_in_ffmpegs_words(takes, tmp_path, bad, words):
    good = takes["h264_30"].path
    path = not_a_video(tmp_path) if bad == "not a video" else cut_off(good, tmp_path)

    with pytest.raises(RuntimeError, match=words) as refused:
        transcode(path, probe(good), tmp_path / "out")
    assert str(path) in str(refused.value)


def test_no_poster_is_an_error(tmp_path):
    # Facts that say a picture of 5 s for a file of half a second put the poster past its end.
    source = tmp_path / "short.mp4"
    ffmpeg(*picture("320x240", 30, 0.5), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(source))

    with pytest.raises(RuntimeError, match="poster"):
        transcode(source, {**probe(source), "videoMs": 5000}, tmp_path / "out")


def test_an_old_poster_is_never_taken_for_a_new_one(tmp_path):
    # A take transcoded again into the same folder, where ffmpeg then writes no poster: the one left
    # from before must not pass for it.
    source = tmp_path / "short.mp4"
    ffmpeg(*picture("320x240", 30, 0.5), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(source))
    out = tmp_path / "out"
    out.mkdir()
    (out / "poster.jpg").write_bytes(b"the poster of the take before")

    with pytest.raises(RuntimeError, match="poster"):
        transcode(source, {**probe(source), "videoMs": 5000}, out)
    assert not (out / "poster.jpg").exists()
