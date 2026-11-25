"""The take's loudness, read on generated stereo 1 kHz sines as EBU Tech 3341's test signals are.

A stereo 1 kHz sine whose peak is A dBFS reads A LUFS: BS.1770 is set so that one channel at 0 dBFS
reads -3.01, and the K-filter passes 1 kHz unchanged. Here on this Mac's ffmpeg, and in the media
image on Debian 12's 5.1 (the suite).
"""

from pathlib import Path

import pytest

from helpers import ffmpeg
from media.loudness import FLOOR, LEVEL_MS, LINE, loudness, read


def sine(folder: Path, name: str, wave: str, seconds: float) -> Path:
    """A 48 kHz stereo 16-bit WAV of `wave`, an expression of t, in both channels."""
    path = folder / name
    ffmpeg("-f", "lavfi", "-i", f"aevalsrc={wave}|{wave}:s=48000:d={seconds}", "-c:a", "pcm_s16le", str(path))
    return path


def peak(dbfs: float) -> str:
    return f"{10 ** (dbfs / 20):.7f}"


@pytest.mark.parametrize("dbfs", [-23, -33])
def test_a_sine_reads_its_level_in_lufs(dbfs: float, tmp_path: Path):
    found = loudness(sine(tmp_path, "sine.wav", f"{peak(dbfs)}*sin(2*PI*1000*t)", 20))
    assert found["lufs"] == pytest.approx(dbfs, abs=0.1)


def test_a_step_shows_within_one_level_of_it_and_steady_levels_hold(tmp_path: Path):
    # -23 dBFS for 5 s, then -33 for 5 s more.
    wave = f"{peak(-23)}*sin(2*PI*1000*t)*if(lt(t\\,5)\\,1\\,{10 ** (-10 / 20):.7f})"
    levels = loudness(sine(tmp_path, "step.wav", wave, 10))["levels"]
    before = [x["lufs"] for x in levels if x["ms"] <= 5000 - LEVEL_MS]
    after = [x["lufs"] for x in levels if x["ms"] >= 5000 + LEVEL_MS]
    assert before and after and len(before) + len(after) == len(levels) - 1  # only the level at the step is between
    assert all(abs(x + 23) <= 0.2 for x in before), before
    assert all(abs(x + 33) <= 0.2 for x in after), after
    at_step = next(x["lufs"] for x in levels if x["ms"] == 5000)
    assert -33 < at_step < -23


def test_levels_come_every_half_second_from_0_to_the_sounds_end(tmp_path: Path):
    levels = loudness(sine(tmp_path, "sine.wav", f"{peak(-23)}*sin(2*PI*1000*t)", 3.2))["levels"]
    assert [x["ms"] for x in levels] == [0, 500, 1000, 1500, 2000, 2500, 3000]
    # The first and last are the 400 ms nearest them that lie inside the sound, so they read as the rest do.
    assert all(abs(x["lufs"] + 23) <= 0.2 for x in levels), levels


def test_a_sine_peaking_at_minus_6_dbfs_reads_minus_6_dbtp(tmp_path: Path):
    found = loudness(sine(tmp_path, "sine.wav", f"{peak(-6)}*sin(2*PI*1000*t)", 10))
    assert found["truePeak"] == pytest.approx(-6, abs=0.2)


def test_silence_reads_minus_70_throughout(tmp_path: Path):
    found = loudness(sine(tmp_path, "silence.wav", "0", 5))
    assert found["lufs"] == FLOOR and found["truePeak"] == FLOOR
    assert found["levels"] and all(x["lufs"] == FLOOR for x in found["levels"])


def test_a_film_is_measured_by_its_sound(tmp_path: Path):
    # As the full copy is: a picture first, then AAC.
    path = tmp_path / "film.mp4"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=4", "-f", "lavfi",
           "-i", f"aevalsrc={peak(-23)}*sin(2*PI*1000*t)|{peak(-23)}*sin(2*PI*1000*t):s=48000:d=4",
           "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", str(path))
    assert loudness(path)["lufs"] == pytest.approx(-23, abs=0.1)


def test_a_file_without_sound_fails_naming_it(tmp_path: Path):
    path = tmp_path / "silent.mp4"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=320x568:rate=30:duration=1", "-c:v", "libx264", "-preset", "ultrafast", str(path))
    with pytest.raises(RuntimeError, match="silent.mp4") as refused:
        loudness(path)
    # 111: its first line, the one a row would take, is ffmpeg's last line (its cause), not the header ffmpeg writes first.
    lines = str(refused.value).splitlines()
    assert "Input #0" not in lines[0] and lines[0].endswith(lines[-1].strip()) and len(lines) > 2, lines


def ebur128(path: Path) -> str:
    """What ffmpeg writes when ebur128 hears `path`, as `measure` runs it."""
    import subprocess

    return subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
                           "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, check=True).stderr


def test_a_sound_whose_momentary_lines_cannot_be_read_fails_naming_it(tmp_path: Path):
    # As if ebur128 wrote its lines another way (another ffmpeg): its summary read, its lines not.
    path = sine(tmp_path, "sine.wav", f"{peak(-23)}*sin(2*PI*1000*t)", 2)
    said = ebur128(path)
    assert read(said, path)["momentary"]
    with pytest.raises(RuntimeError, match=r"sine\.wav: ebur128 gave no momentary loudness for 2000 ms of sound"):
        read("\n".join(line for line in said.splitlines() if not LINE.search(line)), path)


def test_a_sound_too_short_for_a_line_is_not_a_failure(tmp_path: Path):
    path = sine(tmp_path, "blip.wav", f"{peak(-23)}*sin(2*PI*1000*t)", 0.05)
    assert loudness(path)["levels"] == []
