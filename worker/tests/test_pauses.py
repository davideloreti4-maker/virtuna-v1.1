"""Pauses (X47): the gaps between Silero's speech segments of at least 120 ms, each placed on the sound
itself and cut at its quietest 10 ms.

The tests here run on generated sound and are given the segments, as Silero would give them on its
32 ms grid: Silero does not call a tone speech. Silero itself is tested on the owner's take, cut at
measured pauses with silences of known length put between the pieces; that test runs in the speech
image on Modal (`modal run worker/app.py::media_suite --only silero`), where Silero and the take are.
"""

from array import array
from itertools import zip_longest
from pathlib import Path

import pytest

from media.pauses import pauses, pauses_between, speech
from media.sound import PER_MS, read16k, write16k
from sounds import TAKE, in_the_speech_image, mixed, noise, segments, silence
from sounds import sine as tone


def test_a_gap_is_placed_where_the_sound_says_and_cut_at_its_quietest():
    # One second of tone, 400 ms of low noise with 10 ms of digital silence 250 ms in, one second of tone.
    gap = noise(400, 20)
    gap[250 * PER_MS:260 * PER_MS] = silence(10)
    sound = tone(1000) + gap + tone(1000)
    # Silero's grid is 32 ms: here its first segment ends late and its second starts early.
    [pause] = pauses_between(sound, segments((0, 1024), (1376, 2400)))
    assert abs(pause["startMs"] - 1000) <= 20
    assert abs(pause["endMs"] - 1400) <= 20
    assert abs(pause["cutMs"] - 1255) <= 5


def test_a_segment_that_ends_early_or_starts_late_does_not_move_the_pause():
    sound = tone(1000) + noise(400, 20) + tone(1000)
    [pause] = pauses_between(sound, segments((0, 960), (1440, 2400)))
    assert abs(pause["startMs"] - 1000) <= 20
    assert abs(pause["endMs"] - 1400) <= 20
    assert pause["startMs"] < pause["cutMs"] < pause["endMs"]


@pytest.mark.parametrize("silero", [((0, 900), (1400, 2400)), ((0, 1000), (1500, 2400))], ids=["ends 100 ms early", "starts 100 ms late"])
def test_an_edge_inside_the_speech_is_followed_through_the_sound_to_where_it_ends(silero):
    # Silero is late on soft onsets ("s", "h") and early on fading ends: the pause must not take them in.
    sound = tone(1000) + noise(400, 20) + tone(1000)
    [pause] = pauses_between(sound, segments(*silero))
    assert abs(pause["startMs"] - 1000) <= 20
    assert abs(pause["endMs"] - 1400) <= 20


def test_a_rooms_hum_does_not_hide_a_quiet_word():
    # The owner's take: a room's hum under 300 Hz louder than a quiet word (4.21 s), which Silero
    # started late. Here: a 100 Hz hum all through; words at 1 kHz, the one at 900 ms 20 dB under the others.
    hum = tone(1500, 2000, 100)
    words = tone(500, 3000, 1000) + noise(400, 5) + tone(100, 300, 1000) + tone(500, 3000, 1000)
    [pause] = pauses_between(mixed(hum, words), segments((0, 512), (960, 1500)))
    assert abs(pause["startMs"] - 500) <= 20
    assert abs(pause["endMs"] - 900) <= 20


@pytest.mark.parametrize(("gap_ms", "is_pause"), [(80, False), (110, False), (125, True), (140, True), (300, True)])
def test_gaps_under_120_ms_are_not_pauses(gap_ms: int, is_pause: bool):
    sound = tone(500) + noise(gap_ms, 20) + tone(500)
    found = pauses_between(sound, segments((0, 500), (500 + gap_ms, 1000 + gap_ms)))
    assert (len(found) == 1) is is_pause


def test_in_digital_silence_the_cut_is_in_the_middle_of_it():
    sound = tone(500) + silence(300) + tone(500)
    [pause] = pauses_between(sound, segments((0, 512), (800, 1300)))
    assert abs(pause["cutMs"] - 650) <= 5


def test_the_head_and_the_tail_are_pauses_too():
    # X54: the first cut trims the take's head and the last its tail, so they are measured as pauses,
    # from the sound's start and to its end, their speech side by the same edge-following.
    sound = noise(300, 20) + tone(400) + noise(200, 20) + tone(400) + noise(250, 20) + tone(400) + noise(300, 20)
    found = pauses_between(sound, segments((330, 700), (900, 1300), (1550, 1930)))
    assert len(found) == 4
    assert found[0]["startMs"] == 0 and abs(found[0]["endMs"] - 300) <= 20
    for pause, (start, end) in zip(found[1:3], [(700, 900), (1300, 1550)]):
        assert abs(pause["startMs"] - start) <= 20 and abs(pause["endMs"] - end) <= 20
    assert abs(found[3]["startMs"] - 1950) <= 20 and found[3]["endMs"] == 2250
    assert all(p["startMs"] < p["cutMs"] < p["endMs"] for p in found)


def test_a_head_or_tail_under_120_ms_is_no_pause():
    sound = noise(100, 20) + tone(400) + noise(100, 20)
    assert pauses_between(sound, segments((100, 500))) == []


def test_pauses_around_a_quiet_sound_silero_calls_speech_are_one():
    # F1, the click case (the owner's take at 3840-3904 ms): a 60 ms segment of Silero's inside a long
    # quiet stretch, which the measured edges pass over. The two pauses around it overlap; they are one.
    sound = tone(1000) + noise(1500, 20) + tone(1000)
    found = pauses_between(sound, segments((0, 1000), (1700, 1760), (2500, 3500)))
    assert len(found) == 1, found
    [pause] = found
    assert abs(pause["startMs"] - 1000) <= 20 and abs(pause["endMs"] - 2500) <= 20
    assert pause["startMs"] < pause["cutMs"] < pause["endMs"]


def test_pauses_come_ordered_and_apart():
    sound = noise(300, 20) + tone(400) + noise(200, 20) + tone(60) + noise(200, 20) + tone(400) + noise(300, 20)
    found = pauses_between(sound, segments((300, 700), (900, 960), (1160, 1560)))
    assert all(a["endMs"] < b["startMs"] for a, b in zip(found, found[1:]))
    assert all(p["startMs"] < p["cutMs"] < p["endMs"] for p in found)


def test_a_sound_of_no_samples_has_no_speech_and_no_pauses(tmp_path: Path):
    # G4: it returns before torch is imported (it is not installed here).
    assert speech(array("h")) == []
    assert pauses(write16k(array("h"), tmp_path / "empty.wav")) == []


def test_without_speech_there_are_no_pauses():
    assert pauses_between(tone(500) + noise(300, 20), []) == []


def test_speech_from_the_first_ms_to_the_last_leaves_no_head_or_tail():
    sound = tone(500) + noise(300, 20) + tone(500)
    [pause] = pauses_between(sound, segments((0, 500), (800, 1300)))
    assert abs(pause["startMs"] - 500) <= 20 and abs(pause["endMs"] - 800) <= 20


def test_the_cut_is_where_the_whole_sound_is_quietest_not_on_a_low_thump():
    # M12: the edges are found above 300 Hz, against a room's hum; the cut is by the whole sound, so it
    # never lands on a thump of 60 Hz that the edges do not hear. Above 300 Hz the quietest 10 ms (noise
    # at 5) lies inside the thump; the whole sound is quietest elsewhere.
    gap = noise(400, 20)
    gap[170 * PER_MS:180 * PER_MS] = noise(10, 5, seed=2)
    gap[100 * PER_MS:250 * PER_MS] = mixed(gap[100 * PER_MS:250 * PER_MS], tone(150, 3000, 60))
    sound = tone(1000) + gap + tone(1000)
    [pause] = pauses_between(sound, segments((0, 1024), (1376, 2400)))
    assert abs(pause["startMs"] - 1000) <= 20 and abs(pause["endMs"] - 1400) <= 20
    assert not 1100 <= pause["cutMs"] <= 1250, pause


# Silero on real speech: the owner's take, in the speech image on Modal.

# The take cut at measured pauses (ms): each piece runs from where a word's sound rises off the room's
# level in the speech band (300 Hz to 8 kHz, 5 ms windows) to where the last word's falls back to it
# (plan, Task 4): four of its phrases, the first, the third, the fourth and the last. The pauses that were there are cut
# away, so each gap below is exactly as long as made.
PIECES = [(0, 1550), (6700, 8320), (8950, 11165), (11495, None)]
GAPS = [80, 300, 700]  # 80 ms is no pause; 300 and 700 are
QUIET_AT = 400  # ms into the 700 ms gap, where 10 ms of digital silence lies in the low noise
LOW_NOISE = 10  # 16-bit units RMS, about -70 dBFS: far under the room in the take


@in_the_speech_image
def test_silero_finds_gaps_of_known_length_in_real_speech(tmp_path: Path):
    take = read16k(TAKE)
    built, made = array("h"), []
    for i, ((a, b), gap) in enumerate(zip_longest(PIECES, GAPS)):
        built += take[a * PER_MS:len(take) if b is None else b * PER_MS]
        if gap:
            fill = noise(gap, LOW_NOISE, seed=i)
            if gap == 700:
                fill[QUIET_AT * PER_MS:(QUIET_AT + 10) * PER_MS] = silence(10)
            made.append(len(built) / PER_MS)
            built += fill

    found = pauses(write16k(built, tmp_path / "pieces.wav"))

    for start, gap in zip(made, GAPS):
        near = [p for p in found if p["startMs"] < start + gap and p["endMs"] > start]
        if gap < 120:
            assert near == [], f"the {gap} ms gap at {start} ms is no pause: {found}"
            continue
        assert len(near) == 1, f"the {gap} ms gap at {start} ms: {found}"
        assert abs(near[0]["startMs"] - start) <= 20, (gap, start, near)
        assert abs(near[0]["endMs"] - (start + gap)) <= 20, (gap, start, near)
        if gap == 700:
            assert abs(near[0]["cutMs"] - (start + QUIET_AT + 5)) <= 5, (start, near)
