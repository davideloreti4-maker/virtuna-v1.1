import re
import subprocess
from array import array
from pathlib import Path

import pytest

from helpers import AAC, H264, ffmpeg, ffprobe, picture, streams, tags
from render import finish
from render.finish import cover, level, off_band

SECONDS = 6
OWNERS_FILM = Path(__file__).resolve().parents[2] / ".scratch" / "worker-probe" / "results" / "c8-swangle" / "swangle.mp4"
# Task 7's first edit of the owner's take (the whole take, its captions, the natural look), rendered on this Mac with
# scripts/edit-film.ts before its sound is levelled (worker plan, Task 2, H4): its pauses take it under the band.
OWNERS_TAKE_FILM = Path(__file__).resolve().parents[2] / ".scratch" / "worker-proof" / "h4" / "joined-mac.mp4"


def tone_at(amplitude: float | str) -> list[str]:
    """A 440 Hz tone in both channels, its peak a number or an expression of `t`. A stereo sine of peak `a` reads -0.691 + 20·log10(a) LUFS."""
    wave = f"({amplitude})*sin(2*PI*440*t)"
    return ["-f", "lavfi", "-i", f"aevalsrc={wave}|{wave}:s=48000:d={SECONDS}"]


def film(folder: Path, name: str, sound: list[str], seconds: float = SECONDS) -> Path:
    """A film as the renderer posts it: H.264 picture, AAC sound, and a comment of the kind an engine writes."""
    path = folder / name
    ffmpeg(*picture("360x640", 30, seconds), *sound, *H264, *AAC, "-metadata", "comment=Made with a renderer", str(path))
    return path


def ffmpeg_out(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", *args], check=True, capture_output=True, text=True)


def measured(path: Path) -> tuple[float, float, float]:
    """Integrated loudness (LUFS), true peak (dBTP) and loudness range (LU) by ffmpeg's ebur128, read here.
    (loudnorm's own meter is no check on it: on a tone 6 dB down for half its length it reads -32.6 LUFS,
    where the sum by hand and ebur128 give -32.0 and -32.1.)"""
    log = ffmpeg_out("-nostats", "-i", str(path), "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-").stderr
    summary = log[log.rindex("Summary:"):]
    return tuple(float(re.search(pattern, summary).group(1)) for pattern in
                 (r"I:\s+(-?[\d.]+) LUFS", r"Peak:\s+(-?[\d.]+) dBFS", r"LRA:\s+(-?[\d.]+) LU\b"))


def samples(path: Path) -> array:
    """A file's sound as 16-bit samples, its two channels mixed, at 48 kHz."""
    out = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(path), "-map", "0:a:0", "-f", "s16le", "-ac", "1", "-ar", "48000", "-"],
                         capture_output=True, check=True).stdout
    return array("h", out)


def clicks_over_a_tone(seconds: float) -> list[str]:
    """A tone at -30 LUFS, 6 dB down for its second half (a loudness range of 6 LU), and a one-sample click
    twice a second whose peak stands 23 dB over the loudness, as a voice's loudest moments do. The clicks
    carry almost none of the loudness, so a limiter that touches only them leaves the loudness alone."""
    wave = f"0.0342*sin(2*PI*440*t)*(1-0.5*gte(t\\,{seconds / 2}))+0.3*lt(mod(t\\,0.5)\\,1/48000)"
    return ["-f", "lavfi", "-i", f"aevalsrc={wave}|{wave}:s=48000:d={seconds}"]


def voice_like(harmonics: int, hz: int, seconds: float = SECONDS) -> list[str]:
    """A buzz standing in for a voice: `harmonics` of `hz` in cosine phase, so its peaks stand 15 to 18 dB over its
    loudness, rising and falling three times a second like syllables. The limiter holds its peaks all through, so
    one gain to -14 LUFS posts it under the band, the more harmonics the further."""
    wave = "0.002*(1-0.45*(1+cos(2*PI*3*t)))*(" + "+".join(f"cos(2*PI*{k * hz}*t)" for k in range(1, harmonics + 1)) + ")"
    return ["-f", "lavfi", "-i", f"aevalsrc={wave}|{wave}:s=48000:d={seconds}"]


@pytest.fixture
def encodes(monkeypatch: pytest.MonkeyPatch) -> list[tuple[float, float]]:
    """Each levelling `level` encodes, as (gain, ceiling), in order. The encodes themselves are the real ones."""
    done: list[tuple[float, float]] = []
    real = finish._level

    def counted(in_mp4, out_mp4, gain, ceiling):
        done.append((round(gain, 2), round(ceiling, 2)))
        return real(in_mp4, out_mp4, gain, ceiling)

    monkeypatch.setattr(finish, "_level", counted)
    return done


def mean_db(path: Path, start: float, end: float) -> float:
    """The mean level of a stretch of a file's sound, in dB."""
    log = ffmpeg_out("-nostats", "-i", str(path), "-map", "0:a:0", "-af", f"atrim={start}:{end},volumedetect", "-f", "null", "-").stderr
    return float(re.search(r"mean_volume: (-?[\d.]+) dB", log).group(1))


def packets(path: Path) -> list[str]:
    """A hash of every packet of the picture stream, as stored in the file."""
    out = ffmpeg_out("-loglevel", "error", "-i", str(path), "-map", "0:v:0", "-c", "copy", "-f", "framemd5", "pipe:1").stdout
    return [line.rsplit(",", 1)[-1].strip() for line in out.splitlines() if line and not line.startswith("#")]


@pytest.fixture(scope="module")
def quiet(tmp_path_factory) -> Path:
    """A film whose sound is at -30 LUFS, about where the demo render's was (-28.3)."""
    path = film(tmp_path_factory.mktemp("quiet"), "quiet.mp4", tone_at(0.0342))
    assert measured(path)[0] == pytest.approx(-30, abs=0.5)
    return path


def test_a_quiet_film_comes_out_at_minus_14_lufs_under_minus_1_dbtp_in_one_encode(quiet, tmp_path, encodes):
    out = tmp_path / "posted.mp4"
    said = level(quiet, out)
    lufs, peak, _ = measured(out)
    assert lufs == pytest.approx(-14, abs=0.5)
    assert peak <= -1
    # What it says it measured is what is there.
    assert said["lufs"] == pytest.approx(lufs, abs=0.2)
    assert said["truePeak"] == pytest.approx(peak, abs=0.3)
    first_posted(said)
    assert len(encodes) == 1  # in the band and under -1 dBTP: nothing more to do


def first_posted(said: dict) -> None:
    """The first levelling was posted: under -1 dBTP and in the band, so it was not done again."""
    assert said["guarded"] is False and said["raised"] is None and said["raisedPosted"] is False
    assert (said["lufsFirst"], said["truePeakFirst"]) == (said["lufs"], said["truePeak"])


def test_a_loud_film_comes_down_to_minus_14_lufs(tmp_path):
    loud = film(tmp_path, "loud.mp4", tone_at(0.7))
    assert measured(loud)[0] > -5
    out = tmp_path / "posted.mp4"
    said = level(loud, out)
    lufs, peak, _ = measured(out)
    assert lufs == pytest.approx(-14, abs=0.5)
    assert peak <= -1
    first_posted(said)


def test_peaks_far_over_the_loudness_are_held_and_the_range_kept(tmp_path):
    """One gain, then the limiter only where a peak would go over: the loudness range stays what it was
    (an AGC or a compressor would narrow it), the peaks end under -1 dBTP once encoded, and the
    loudness is -14, as the limiter touches only the clicks."""
    source = film(tmp_path, "in.mp4", clicks_over_a_tone(12), seconds=12)
    lufs_in, peak_in, lra_in = measured(source)
    assert peak_in - lufs_in >= 15 and lra_in >= 5
    out = tmp_path / "posted.mp4"
    said = level(source, out)
    lufs, peak, lra = measured(out)
    assert lra == pytest.approx(lra_in, abs=0.5)
    assert peak <= -1
    assert lufs == pytest.approx(-14, abs=0.5)
    assert said["lraBefore"] == pytest.approx(lra_in, abs=0.3)
    first_posted(said)


def test_a_click_stays_where_it_was(tmp_path):
    """The limiter looks 5 ms ahead and the sound goes to 192 kHz and back: none of it may move the
    sound against the picture. A click at 1 s is at 1 s after, to the millisecond."""
    click = "0.01*sin(2*PI*300*t)+0.9*between(t\\,1\\,1.0005)"
    source = film(tmp_path, "in.mp4", ["-f", "lavfi", "-i", f"aevalsrc={click}|{click}:s=48000:d={SECONDS}"])
    out = tmp_path / "posted.mp4"
    level(source, out)

    def where(path: Path) -> int:
        sound = samples(path)
        near = range(int(0.9 * 48000), int(1.1 * 48000))
        return max(near, key=lambda i: abs(sound[i]))

    assert abs(where(out) - where(source)) <= 48


@pytest.mark.skipif(not OWNERS_FILM.exists(), reason="the owner's 90 s film (test 3's one-piece render) is not in .scratch")
def test_the_owners_voice(tmp_path):
    """The 90 s demo film, the owner's own voice, whose peaks stand 20.7 dB over its loudness: more than
    -14 LUFS under -1.5 dBTP leaves room for, so the limiter takes up to 7 dB off its loudest syllables,
    and some of its loudness and range with them. Measured 2026-11-20: -28.4 LUFS, LRA 4.4 in;
    -14.8 LUFS, -1.4 dBTP, LRA 3.5 out. The peak is the promise; the loudness and the range are held
    to what was measured."""
    lufs_in, peak_in, lra_in = measured(OWNERS_FILM)
    assert peak_in - lufs_in > 20
    out = tmp_path / "posted.mp4"
    said = level(OWNERS_FILM, out)
    lufs, peak, lra = measured(out)
    assert peak <= -1
    assert -15.0 <= lufs <= -14
    assert lra >= lra_in - 1
    first_posted(said)


@pytest.mark.parametrize("color, every, guarded", [("white", 0.33, False), ("pink", 0.29, True)])
def test_sharp_noise_stays_under_minus_1_dbtp_once_encoded(color, every, guarded, tmp_path):
    """Bursts of noise five times as loud, like a clap or a hiss, or dense music: the AAC encode puts the
    peaks of noise up most. White: -1.0 dBTP once encoded and -14.4 LUFS, so the levelling is not done again. Pink,
    far quieter to start with (-40.7 LUFS, +26.7 dB of gain): +0.2 dBTP the first time, so it is done once more with
    the ceiling lowered by the overshoot and 0.2 dB (-2.1 dBTP); most of its loudness is in the bursts the limiter
    holds, so that base lies far under the band and takes the band pass too, raised 2 dB, the most (-15.7 LUFS,
    -2.4 dBTP on this Mac)."""
    bursts = [
        "-f", "lavfi", "-i",
        f"anoisesrc=color={color}:amplitude=0.02:sample_rate=48000:duration={SECONDS}:seed=1,pan=stereo|c0=c0|c1=c0,"
        f"volume='1+4*lt(mod(t\\,{every})\\,0.03)':eval=frame",
    ]
    out = tmp_path / "posted.mp4"
    said = level(film(tmp_path, "in.mp4", bursts), out)
    _, peak, _ = measured(out)
    assert peak <= -1
    assert said["truePeak"] <= -1
    assert said["guarded"] is guarded
    assert (said["truePeakFirst"] > -1) is guarded
    # Guarded, pink lands far under the band (-16.0 first), so it also takes the band pass, raised at most 2 dB.
    assert (said["raised"], said["raisedPosted"]) == ((2.0, True) if guarded else (None, False))


def test_a_guarded_base_under_the_band_takes_the_band_pass_at_the_guard_s_ceiling(tmp_path, monkeypatch):
    """The path Modal took on the owner's take (worker batch, run 4): the first levelling in the band but over -1 dBTP, so
    guarded; the guard's lower ceiling takes it under the band; the band pass raises the guarded base, at the guard's
    ceiling. Here the first encode is made to read +0.3 dBTP (its encode real, that one measure said otherwise), so the
    guard's ceiling is -1.5 - 1.3 - 0.2 = -3.0. A buzz of 9 harmonics: the guarded base stays above -15.9, so the
    raise is twice its shortfall, not the cap (16 harmonics would sink to -16.6 there and be capped)."""
    real, encodes = finish._level, []

    def overshooting(in_mp4, out_mp4, gain, ceiling):
        found = real(in_mp4, out_mp4, gain, ceiling)
        found = {**found, "truePeak": 0.3} if not encodes else found
        encodes.append(((round(gain, 2), round(ceiling, 2)), found))
        return found

    monkeypatch.setattr(finish, "_level", overshooting)
    said = level(film(tmp_path, "in.mp4", voice_like(9, 130)), tmp_path / "posted.mp4")
    (g, _), _ = encodes[0]
    second = encodes[1][1]
    r = round(2 * (-14.9 - second["lufs"]), 2)
    assert second["lufs"] < -15.0 and 0 < r < 2.0
    assert [done for done, _ in encodes] == [(g, -1.5), (g, -3.0), (round(g + r, 2), -3.0)]
    assert said["guarded"] is True and said["raised"] == r
    assert (said["lufsBase"], said["truePeakBase"]) == (second["lufs"], second["truePeak"])


def test_a_film_under_the_band_is_levelled_again_with_twice_its_shortfall_and_posted_when_it_holds_the_peak(tmp_path, encodes):
    """X49's band: a film the limiter takes more than 1 LU under -14 is levelled once more, the gain raised by twice
    its shortfall to -14.9 (on the owner's take the limiter took a quarter to a half of a raise), the same limiter
    and ceiling; that film is posted, as it holds -1 dBTP and lies nearer the band.

    It holds the peak at the one gain this raise gives, and the AAC encode's peak jumps with the gain (the H4 scan):
    the outcome is fixed for an ffmpeg build, and an ffmpeg upgrade may flip it to the base posted."""
    out = tmp_path / "posted.mp4"
    said = level(film(tmp_path, "in.mp4", voice_like(16, 130)), out)
    assert said["lufsFirst"] < -15.0 and said["guarded"] is False
    assert said["raised"] == round(2 * (-14.9 - said["lufsFirst"]), 2) and said["raisedPosted"] is True
    lufs, peak, _ = measured(out)
    assert (lufs, peak) == (said["lufs"], said["truePeak"]) and lufs > said["lufsFirst"] and peak <= -1
    assert [gain for gain, _ in encodes] == [encodes[0][0], round(encodes[0][0] + said["raised"], 2)]
    assert {ceiling for _, ceiling in encodes} == {-1.5}
    assert list(tmp_path.glob("*.raised.mp4")) == []


def test_the_base_is_posted_when_the_band_pass_would_break_the_peak(tmp_path, monkeypatch):
    """The AAC encode's true peak jumps with the gain: on the owner's take, one gain in five posted over -1 dBTP (the
    H4 scan, worker plan, Task 2). The band pass here is made to read +0.3 dBTP: its encode is real, only that one
    measure is said otherwise. The base, which holds the peak, is posted, and nothing is levelled a fourth time."""
    real, done = finish._level, []

    def breaking(in_mp4, out_mp4, gain, ceiling):
        done.append(gain)
        found = real(in_mp4, out_mp4, gain, ceiling)
        return {**found, "truePeak": 0.3} if len(done) == 2 else found

    monkeypatch.setattr(finish, "_level", breaking)
    out = tmp_path / "posted.mp4"
    said = level(film(tmp_path, "in.mp4", voice_like(16, 130)), out)
    assert said["raised"] == round(2 * (-14.9 - said["lufsFirst"]), 2) and said["raisedPosted"] is False and len(done) == 2
    assert (said["lufs"], said["truePeak"]) == (said["lufsFirst"], said["truePeakFirst"])
    assert measured(out)[:2] == (said["lufsFirst"], said["truePeakFirst"])  # the base's file, as it was written
    assert list(tmp_path.glob("*.raised.mp4")) == []


@pytest.mark.parametrize(("band_lufs", "posted"), [(-13.0, False), (-13.8, True)], ids=["further from the band: the base", "closer: the band pass"])
def test_of_the_films_that_hold_the_peak_the_one_nearer_the_band_is_posted(tmp_path, monkeypatch, band_lufs: float, posted: bool):
    """X49's band runs from -15.0 to -14.0. A band pass that lands over its top is posted only when it is nearer the band
    than the base (here -15.5, 0.5 LU under it): at -13.0, 1.0 over, the base is; at -13.8, 0.2 over, the band pass. Its
    encode is real; only its loudness is said otherwise."""
    real, done = finish._level, []

    def landing(in_mp4, out_mp4, gain, ceiling):
        done.append(gain)
        found = real(in_mp4, out_mp4, gain, ceiling)
        return {**found, "lufs": band_lufs} if len(done) == 2 else found

    monkeypatch.setattr(finish, "_level", landing)
    out = tmp_path / "posted.mp4"
    said = level(film(tmp_path, "in.mp4", voice_like(16, 130)), out)
    assert said["lufsBase"] == said["lufsFirst"] < -15.0 and said["raised"] is not None and len(done) == 2
    assert said["raisedPosted"] is posted
    assert said["lufs"] == (band_lufs if posted else said["lufsBase"])
    if not posted:
        assert measured(out)[:2] == (said["lufsBase"], said["truePeakBase"])
    assert list(tmp_path.glob("*.raised.mp4")) == []


def test_a_base_the_guard_left_over_the_peak_gives_way_to_a_band_pass_that_holds_it_though_further_from_the_band(tmp_path, monkeypatch):
    """157, the branch where the guard fails (X49 as amended: aimed under -1 dBTP, at most one guard): the first levelling
    and the guard's both read over -1 dBTP; the band pass holds it but lands further from the band than the base. The
    film that holds the peak is posted all the same. The encodes are real; only these measures are said otherwise."""
    real, done = finish._level, []

    def guard_fails(in_mp4, out_mp4, gain, ceiling):
        done.append(ceiling)
        found = real(in_mp4, out_mp4, gain, ceiling)
        return {**found, **[{"truePeak": 0.3}, {"truePeak": -0.5}, {"lufs": -12.0, "truePeak": -2.0}][len(done) - 1]}

    monkeypatch.setattr(finish, "_level", guard_fails)
    out = tmp_path / "posted.mp4"
    said = level(film(tmp_path, "in.mp4", voice_like(16, 130)), out)
    assert len(done) == 3 and done[1] == done[2] == pytest.approx(-3.0)  # the band pass at the guard's ceiling
    assert said["guarded"] is True and said["truePeakBase"] == -0.5 and said["lufsBase"] < -15.0
    assert off_band(-12.0) > off_band(said["lufsBase"])  # further from the band than the base
    assert (said["raisedPosted"], said["lufs"], said["truePeak"]) == (True, -12.0, -2.0)
    assert list(tmp_path.glob("*.raised.mp4")) == []


def test_the_raise_is_at_most_2_db(tmp_path, encodes):
    """A film far under the band (here -17.3 LUFS once levelled, a raise of 4.8 dB asked) is raised 2 dB at most:
    X49 chooses the least limiting, and limiting it harder to reach the band would squash it."""
    said = level(film(tmp_path, "in.mp4", voice_like(40, 120)), tmp_path / "posted.mp4")
    assert 2 * (-14.9 - said["lufsFirst"]) > 2.0
    assert said["raised"] == 2.0 and len(encodes) == 2 and encodes[1][0] == round(encodes[0][0] + 2.0, 2)
    assert said["truePeak"] <= -1


@pytest.mark.skipif(not OWNERS_TAKE_FILM.exists(), reason="the owner's take's film (Task 7's edit, unlevelled) is not in .scratch")
def test_the_owners_whole_take_comes_into_the_band(tmp_path):
    """Task 7's finding: the whole take with its pauses posted -15.3 LUFS on Modal, -15.1 here. Raised by twice its
    shortfall (0.4 dB here), it measures -14.8 LUFS and -1.2 dBTP (2026-11-21, this Mac's ffmpeg 8)."""
    out = tmp_path / "posted.mp4"
    said = level(OWNERS_TAKE_FILM, out)
    lufs, peak, _ = measured(out)
    assert said["lufsFirst"] < -15.0 and said["raisedPosted"] is True
    assert -15.0 <= lufs <= -14.0 and peak <= -1


def test_a_voice_that_drops_keeps_its_drop(tmp_path):
    """One gain over the whole film, so it is louder but not squashed: two seconds 6 dB under the rest stay 6 dB under."""
    out = tmp_path / "posted.mp4"
    level(film(tmp_path, "in.mp4", tone_at(r"0.0342-0.0171*between(t\,2\,4)")), out)
    assert measured(out)[0] == pytest.approx(-14, abs=0.5)
    loud, quiet, loud_again = mean_db(out, 0.5, 1.5), mean_db(out, 2.5, 3.5), mean_db(out, 4.5, 5.5)
    assert loud - quiet == pytest.approx(6.02, abs=0.2)
    assert loud_again == pytest.approx(loud, abs=0.2)


def test_the_picture_is_copied_untouched(quiet, tmp_path):
    out = tmp_path / "posted.mp4"
    level(quiet, out)
    before = packets(quiet)
    assert len(before) == SECONDS * 30
    assert packets(out) == before


def test_the_posted_file_says_its_colours_are_bt709_with_srgb_s_transfer(quiet, tmp_path):
    """The engine encodes BT.709 colours and calls their transfer BT.709; Safari then draws the film 7.6
    levels off the stills. Called sRGB's, as the pixels are, Chrome and Safari both draw it within 1.4."""
    engine = tmp_path / "joined.mp4"
    ffmpeg("-i", str(quiet), "-map", "0", "-c:a", "copy", "-vf", "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709", *H264, str(engine))
    [v] = streams(engine, "video")
    assert (v["color_space"], v["color_primaries"], v["color_transfer"]) == ("bt709", "bt709", "bt709")
    out = tmp_path / "posted.mp4"
    level(engine, out)
    [v] = streams(out, "video")
    assert (v["color_space"], v["color_primaries"], v["color_transfer"]) == ("bt709", "bt709", "iec61966-2-1")


def test_the_posted_file_is_aac_at_48_khz_with_its_index_first_and_no_metadata(quiet, tmp_path):
    out = tmp_path / "posted.mp4"
    level(quiet, out)
    [a] = streams(out, "audio")
    # The limiter works at 192 kHz; what is posted is 48 kHz.
    assert (a["codec_name"], a["sample_rate"], a["channels"]) == ("aac", "48000", 2)
    assert float(a["duration"]) == pytest.approx(SECONDS, abs=0.05)
    assert "comment" not in tags(out)
    data = out.read_bytes()
    assert data.index(b"moov") < data.index(b"mdat")


@pytest.mark.parametrize("limited", [False, True])
def test_the_sound_keeps_step_with_the_picture(limited, tmp_path):
    """Every packet of sound right after the one before, with the limiter idle and at work: loudnorm's
    look-ahead once left a gap of 84 ms at 3 s, and counting the times again from the samples
    (asetpts) put one packet a sample early. A player plays either as a slip against the picture."""
    out = tmp_path / "posted.mp4"
    level(film(tmp_path, "in.mp4", clicks_over_a_tone(SECONDS) if limited else tone_at(0.0342)), out)
    [a] = streams(out, "audio")
    assert a["time_base"] == "1/48000"
    times = [int(t.strip(",")) for t in ffprobe("-select_streams", "a:0", "-show_entries", "packet=pts", "-of", "csv=p=0", str(out)).split()]
    assert {b - a for a, b in zip(times, times[1:])} == {1024}


def test_a_film_with_no_sound_at_all_is_posted_as_it_is(tmp_path):
    silent = film(tmp_path, "silent.mp4", ["-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo:d={SECONDS}"])
    out = tmp_path / "posted.mp4"
    assert level(silent, out) == {"lufs": None, "truePeak": None, "lra": None, "lraBefore": None, "lufsFirst": None, "truePeakFirst": None,
                                  "guarded": False, "lufsBase": None, "truePeakBase": None, "raised": None, "raisedPosted": False}
    assert packets(out) == packets(silent)
    [v] = streams(out, "video")
    assert v["color_transfer"] == "iec61966-2-1"
    assert len(streams(out, "audio")) == 1
    assert "comment" not in tags(out)


def test_a_file_that_is_not_a_film_fails_naming_it(tmp_path):
    broken = tmp_path / "broken.mp4"
    broken.write_text("not a film\n" * 100)
    with pytest.raises(RuntimeError, match="broken.mp4"):
        level(broken, tmp_path / "posted.mp4")


def test_the_cover_is_a_jpeg_of_the_same_picture(tmp_path):
    png = tmp_path / "frame.png"
    ffmpeg(*picture("1080x1920", 30, 1), "-frames:v", "1", str(png))
    jpg = tmp_path / "cover.jpg"
    cover(png, jpg)
    [v] = streams(jpg, "video")
    assert (v["codec_name"], v["width"], v["height"]) == ("mjpeg", 1080, 1920)
    # The same picture: on average a level or two of 255 apart, as a JPEG is.
    diff = ffprobe("-f", "lavfi", "-i", f"movie={png}[a];movie={jpg},format=yuv420p[b];[a]format=yuv420p[c];[c][b]blend=all_mode=difference,signalstats",
                   "-show_entries", "frame_tags=lavfi.signalstats.YAVG", "-of", "csv=p=0")
    assert float(diff.strip()) < 3


def test_a_cover_of_a_picture_that_is_not_there_fails_naming_it(tmp_path):
    with pytest.raises(RuntimeError, match="nothing.png"):
        cover(tmp_path / "nothing.png", tmp_path / "cover.jpg")
