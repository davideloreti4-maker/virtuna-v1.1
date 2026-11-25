"""Words timed to the sound (X46, N3), agreed with the pauses (X54): the text from Scribe or faster-whisper,
each word's time from the aligner, then the words and the pauses made to meet.

Here: the words as the aligner is given them, the aligner's output turned into `Word[]` as
`src/lib/edit/doc.ts` has it, the aligner's windows, the agreement, the takes with nothing to say, and
Scribe's request and answer against a server on 127.0.0.1 that stands in for ElevenLabs (the one
boundary a test may stand in for; a real run needs the owner's key). The models run in the speech image
on Modal (`modal run worker/app.py::media_suite --only "owners_take or scribe_end or silence or music"`).
"""

import json
import math
import os
import subprocess
import sys
from array import array
from email.parser import BytesParser
from email.policy import default as email_policy
from pathlib import Path

import pytest

from media import words as module
from media.pauses import pauses_between
from media.sound import PER_MS, read16k, write16k
from media.words import (MIN_HEARD_MS, agree, frames, language_of, nothing, outside_pauses, place, say, scribe, stretches, timed, too_little,
                         windows, words)
from sounds import TAKE, TAKE_MS, in_the_speech_image, mixed, noise, segments, silence, sine


@pytest.mark.parametrize(("text", "language", "spoken"), [
    ("Morning", "en", ["morning"]),
    ("friends,", "en", ["friends"]),
    ("lessons.", "en", ["lessons"]),
    ("don't", "en", ["dont"]),
    ("Lumora", "en", ["lumora"]),
    ("well-known", "en", ["well", "known"]),
    ("21", "en", ["twenty", "one"]),
    ("21", "de", ["einundzwanzig"]),
    ("21", "it", ["ventuno"]),
    ("3.5", "en", ["three", "point", "five"]),
    ("3,5", "de", ["drei", "komma", "fünf"]),
    ("1,000", "en", ["one", "thousand"]),
    ("1.000", "de", ["eintausend"]),
    ("2026", "en", ["twenty", "twenty", "six"]),
    ("1st", "en", ["first"]),
    ("50%", "en", ["fifty", "percent"]),
    ("50%", "de", ["fünfzig", "prozent"]),
    ("$5", "en", ["five", "dollars"]),
    ("5€", "it", ["cinque", "euro"]),
    ("&", "en", ["and"]),
    ("&", "de", ["und"]),
    ("3D", "en", ["three", "d"]),
    ("Größe", "de", ["größe"]),
    ("perché?", "it", ["perché"]),
    ("—", "en", []),
    ("...", "en", []),
])
def test_the_aligner_is_given_words_in_lower_case_without_punctuation_and_numbers_spelled_out(text, language, spoken):
    assert say(text, language) == spoken


def test_aligned_words_become_words_in_whole_ms_with_the_text_as_given():
    texts = ["Morning", "friends,", "21"]
    spoken = [say(t, "en") for t in texts]  # 21 is two words to the aligner
    aligned = [(0.6123, 0.9004), (0.9506, 1.4801), (1.6, 1.8), (1.85, 2.2)]
    found, untimed = place(texts, spoken, aligned, 12714)
    assert found == [
        {"text": "Morning", "startMs": 612, "endMs": 900},
        {"text": "friends,", "startMs": 951, "endMs": 1480},
        {"text": "21", "startMs": 1600, "endMs": 2200},
    ]
    assert untimed == 0


def test_a_word_the_aligner_cannot_time_takes_the_span_between_its_timed_neighbours():
    texts = ["It", "—", "is", "...", "bright"]
    spoken = [say(t, "en") for t in texts]
    found, untimed = place(texts, spoken, [(3.84, 3.9), (4.28, 4.4), None], 12714)
    assert found[1] == {"text": "—", "startMs": 3900, "endMs": 4280}
    assert found[3] == {"text": "...", "startMs": 4400, "endMs": 12714}  # nothing timed after it: to the sound's end
    assert found[4] == {"text": "bright", "startMs": 4400, "endMs": 12714}
    assert untimed == 3


def test_words_never_start_before_the_word_before_them_nor_end_after_the_sound():
    texts = ["a", "b", "c"]
    found, _ = place(texts, [["a"], ["b"], ["c"]], [(1.0004, 1.2), (0.9990, 1.3), (12.7, 12.9)], 12714)
    starts = [w["startMs"] for w in found]
    assert starts == sorted(starts)
    assert all(w["startMs"] <= w["endMs"] <= 12714 for w in found)


def test_nothing_timed_is_an_error_not_a_guess():
    with pytest.raises(RuntimeError, match="timed none"):
        place(["a", "b"], [["a"], ["b"]], [None, None], 12714)


def test_a_word_over_80_characters_is_split_by_its_share_of_the_span():
    # M4: a word's text is at most 80 characters (src/lib/edit/atoms.ts).
    long = "a" * 85
    found, _ = place([long, "b"], [[long], ["b"]], [(1.0, 1.85), (2.0, 2.1)], 12714)
    assert found == [{"text": "a" * 80, "startMs": 1000, "endMs": 1800}, {"text": "a" * 5, "startMs": 1800, "endMs": 1850},
                     {"text": "b", "startMs": 2000, "endMs": 2100}]


# The aligner hears a long sound in windows (R2): each window's frames are wav2vec2's for the samples
# it was given, so they are joined only if every kept frame heard exactly the samples the whole sound's would.

def heard(samples: list[int]) -> list[int]:
    """A stand-in for wav2vec2's convolutions: frame k hears samples 320k to 320k + 400."""
    return [sum(samples[320 * k:320 * k + 400]) for k in range(frames(len(samples)))]


@pytest.mark.parametrize("length", [400, 719, 720, 4000, 10_000, 32_321, 50_000])
def test_windows_joined_give_the_whole_sounds_frames(length: int):
    sound = [(i * 7919) % 1000 - 500 for i in range(length)]
    joined = []
    for first, last, keep, count in windows(length, per=7, context=3):
        joined += heard(sound[first:last])[keep:keep + count]
    assert len(joined) == (length - 400) // 320 + 1
    assert joined == heard(sound)


def test_frames_follow_wav2vec2s_convolutions():
    assert [frames(n) for n in (399, 400, 719, 720, 16000, 203_435)] == [0, 1, 1, 2, 49, 635]


def test_a_take_shorter_than_a_window_is_one_window():
    [(first, last, keep, count)] = windows(203_435)
    assert (first, keep, count) == (0, 0, 635) and last <= 203_435


def test_windows_have_context_on_both_sides_inside_the_sound():
    found = windows(180 * 16000)
    assert len(found) == 6
    assert all(keep == (0 if i == 0 else 150) for i, (_, _, keep, _) in enumerate(found))
    assert sum(count for *_, count in found) == frames(180 * 16000)

# Words and pauses agree (X54, as amended): a cut lands only in a pause, so no word lies inside one; a pause
# gives way to a word only where Silero hears speech inside it (H1), else the word is trimmed out of it.

def w(text: str, start: int, end: int) -> dict:
    return {"text": text, "startMs": start, "endMs": end}


def p(start: int, end: int) -> dict:
    return {"startMs": start, "endMs": end, "cutMs": (start + end) // 2}


def middle(start: int, end: int) -> int:
    """Where a pause that gave way is cut again, standing in for the sound's quietest 10 ms."""
    return (start + end) // 2


def inside(word: dict, pauses: list[dict]) -> bool:
    """Whether the word shares a millisecond with a pause: starts or ends inside it, or spans it."""
    return any(word["startMs"] < q["endMs"] and q["startMs"] < word["endMs"] for q in pauses)


def silero_hears(*found: dict) -> list[tuple[int, int]]:
    """Silero hearing exactly the words given, as speech segments in ms."""
    return [(x["startMs"], x["endMs"]) for x in found]


def test_a_word_wholly_inside_a_pause_splits_it_where_silero_hears_it_and_a_part_under_120_ms_goes():
    # A quiet word: a pause from 3569 to 4387 ms took in a word at 4210 to 4290, which Silero hears.
    found = [w("later", 2823, 3560), w("So", 4210, 4290), w("then", 4387, 4485)]
    got = agree(found, [p(3569, 4387)], silero_hears(*found), 12714, middle)
    assert got["pauses"] == [{"startMs": 3569, "endMs": 4210, "cutMs": 3889}]
    assert got["words"][1] == w("So", 4210, 4290)
    assert (got["gaveWay"], got["apart"], got["trimmed"], got["dropped"]) == (1, 0, 0, 0)


@pytest.mark.parametrize(("start", "moved", "trimmed"), [(1470, 1500, 0), (1410, 1500, 1)],
                         ids=["30 ms in: moved", "90 ms in, its speech crossing the edge: trimmed"])
def test_a_word_reaching_into_a_pause_is_moved_or_trimmed_and_the_pause_stays(start: int, moved: int, trimmed: int):
    found = [w("a", 600, 1000), w("b", start, 1800)]
    got = agree(found, [p(1000, 1500)], silero_hears(*found), 3000, middle)
    assert got["words"][1] == w("b", moved, 1800)
    assert got["pauses"] == [p(1000, 1500)] and (got["gaveWay"], got["trimmed"]) == (0, trimmed)


@pytest.mark.parametrize(("start", "moved", "apart"), [(1700, 1500, 0), (1800, 1800, 1)], ids=["200 ms after: moved", "300 ms after: left, counted"])
def test_a_word_after_a_pause_meets_it_within_250_ms(start: int, moved: int, apart: int):
    found = [w("a", 600, 1000), w("b", start, 2000)]
    got = agree(found, [p(1000, 1500)], silero_hears(*found), 3000, middle)
    assert got["words"][1]["startMs"] == moved and got["apart"] == apart


def test_the_word_before_a_pause_ends_at_it_and_the_head_and_tail_are_met():
    found = [w("morning", 581, 921), w("friends", 961, 1342), w("it", 1850, 2000), w("bright", 11874, 12154)]
    got = agree(found, [p(0, 515), p(1500, 1800), p(12300, 12714)], silero_hears(*found), 12714, middle)
    words_ = got["words"]
    assert words_[0]["startMs"] == 515 and words_[1]["endMs"] == 1500 and words_[2]["startMs"] == 1800
    assert words_[-1]["endMs"] == 12300
    assert got["apart"] == 0


def test_a_word_over_a_whole_pause_where_silero_hears_speech_all_through_it_removes_it():
    got = agree([w("wonderful", 10592, 11373)], [p(10800, 11000)], [(10592, 10790), (10820, 10980), (11010, 11373)], 12714, middle)
    assert got["pauses"] == [] and got["gaveWay"] == 1 and got["words"] == [w("wonderful", 10592, 11373)]


# H1, the take's case (Task 5, run 4, no key): Whisper wrote a wrong word for a quiet one (here "oh"), and the aligner laid
# it from 3104 to 4305 ms, over the pauses 3552-3846 and 3894-4226. Silero's segments on the take (Task 4, run 7) only cross
# those pauses' edges: 640-3616 reaches 64 ms into the first (REACH_MS: the edge was put back into Silero's speech
# where the sound is quiet), the click 3840-3904 stands between the two. None lies wholly inside either, so Silero
# hears no speech in them: both stay, and "oh" keeps its end and starts where the second ends (F2). The run's words are
# made up here, one for each of its 27, at its times.
RUN_4_WORDS = [w("Morning", 519, 921), w("friends,", 961, 1342), w("it", 1562, 1662), w("is", 1722, 1822), w("time", 1882, 2102),
               w("to", 2122, 2243), w("the", 2283, 2383), w("lesson", 2443, 2743), w("again,", 2823, 3084), w("oh", 3104, 4305),
               w("you", 4345, 4485), w("know", 4565, 4766), w("this,", 4826, 5225), w("making", 5351, 5747), w("a", 5827, 5927),
               w("small", 6007, 6247), w("paper", 6928, 7228), w("boat", 7288, 7569), w("together.", 7649, 8384),
               w("Lumora", 8961, 9471), w("kit", 9551, 9751), w("could", 9811, 10032), w("soon", 10132, 10352), w("be", 10432, 10572),
               w("wonderful,", 10592, 11373), w("see", 11613, 11854), w("you.", 11874, 12154)]
TAKE_PAUSES = [{"startMs": 0, "endMs": 519, "cutMs": 173}, {"startMs": 3552, "endMs": 3846, "cutMs": 3712},
               {"startMs": 3894, "endMs": 4226, "cutMs": 4025}, {"startMs": 5225, "endMs": 5351, "cutMs": 5307},
               {"startMs": 8384, "endMs": 8961, "cutMs": 8490}, {"startMs": 12588, "endMs": 12714, "cutMs": 12709}]
TAKE_SPEECH = [(640, 3616), (3840, 3904), (4256, 5216), (5344, 8448), (8960, 12576)]


def test_the_take_s_you_over_two_pauses_where_silero_hears_no_speech_is_trimmed_and_both_stay():
    got = agree(RUN_4_WORDS, TAKE_PAUSES, TAKE_SPEECH, TAKE_MS, middle)
    assert got["pauses"] == TAKE_PAUSES and got["gaveWay"] == 0
    assert got["words"][9] == w("oh", 4226, 4305)
    assert (got["trimmed"], got["dropped"]) == (1, 0) and len(got["words"]) == 27


def test_a_quiet_word_inside_a_pause_makes_it_give_way():
    # G1, the reviewer's case: Silero marks a quiet 80 ms word at 1300-1380 ms that the measured pause
    # 1003-1680 swallowed. Whisper hears it, so the aligner places it, and the pause gives way around it.
    found = [w("a", 500, 1003), w("quiet", 1300, 1380), w("b", 1680, 2000)]
    got = agree(found, [p(1003, 1680)], silero_hears(*found), 3000, middle)
    assert got["pauses"] == [p(1003, 1300), p(1380, 1680)] and got["gaveWay"] == 1
    assert got["words"][1] == w("quiet", 1300, 1380) and not any(inside(x, got["pauses"]) for x in got["words"]) and got["apart"] == 0


def test_a_word_half_over_speech_and_half_over_silence_inside_a_pause_gives_way_only_where_the_speech_is():
    found = [w("a", 400, 1000), w("half", 1200, 1800), w("b", 2000, 2400)]
    got = agree(found, [p(1000, 2000)], [(400, 1000), (1200, 1500), (2000, 2400)], 3000, middle)
    assert got["pauses"] == [p(1000, 1200), p(1500, 2000)] and got["gaveWay"] == 1
    assert got["words"][1] == w("half", 1200, 1500) and (got["trimmed"], got["dropped"]) == (1, 0)


def test_speech_over_a_pause_s_edge_does_not_make_it_give_way():
    # Silero's segment runs 64 ms into the pause (REACH_MS), and the word 200 ms: the pause stays, the word is trimmed.
    got = agree([w("a", 600, 1200), w("b", 1600, 1900)], [p(1000, 1500)], [(400, 1064), (1600, 1900)], 3000, middle)
    assert got["pauses"] == [p(1000, 1500)] and got["gaveWay"] == 0
    assert got["words"][0] == w("a", 600, 1000) and got["trimmed"] == 1


def test_a_word_wholly_inside_a_pause_where_silero_hears_nothing_is_dropped_and_counted():
    found = [w("a", 400, 1000), w("ghost", 1150, 1300), w("b", 1500, 1800)]
    got = agree(found, [p(1000, 1500)], [(400, 1000), (1500, 1800)], 3000, middle)
    assert got["pauses"] == [p(1000, 1500)] and got["words"] == [w("a", 400, 1000), w("b", 1500, 1800)]
    assert (got["gaveWay"], got["trimmed"], got["dropped"]) == (0, 0, 1)


def test_a_give_way_no_word_is_left_over_is_undone():
    # M1: the word lies over the whole pause and Silero hears speech in its middle, so the pause first splits there; then
    # the word is trimmed to start where the pause ends (it keeps its end), and nothing is left over 1400-1500. The pause
    # is as it was, and did not give way.
    got = agree([w("long", 800, 2200)], [p(1000, 2000)], [(800, 1000), (1400, 1500), (2000, 2200)], 3000, middle)
    assert got["pauses"] == [p(1000, 2000)] and got["gaveWay"] == 0
    assert got["words"] == [w("long", 2000, 2200)] and (got["trimmed"], got["dropped"]) == (1, 0)


@pytest.mark.parametrize(("word", "shifted"), [(w("it", 1450, 1490), w("it", 1500, 1540)), (w("it", 1010, 1040), w("it", 970, 1000))],
                         ids=["near the pause's end", "near its start"])
def test_a_short_word_just_inside_a_pause_s_edge_is_shifted_out_with_its_length(word: dict, shifted: dict):
    # M2: wholly inside a pause where Silero hears nothing, but within 60 ms of an edge: moved out to it, its length kept.
    found = [w("a", 400, 900), word, w("b", 1600, 1900)]
    got = agree(found, [p(1000, 1500)], [(400, 900), (1600, 1900)], 3000, middle)
    assert got["pauses"] == [p(1000, 1500)] and got["words"][1] == shifted
    assert (got["gaveWay"], got["trimmed"], got["dropped"]) == (0, 0, 0)


@pytest.mark.parametrize(("found", "speech"), [([w("uh", 10, 40), w("a", 600, 900)], [(600, 900)]),
                                               ([w("a", 2000, 2400), w("uh", 2960, 2990)], [(2000, 2400)])],
                         ids=["at the take's very start", "at its very end"])
def test_a_short_word_at_the_head_s_start_or_the_tail_s_end_has_no_room_to_be_shifted_and_is_dropped(found: list, speech: list):
    # 155: wholly inside the head (or the tail) where Silero hears nothing, within 60 ms of the take's own edge, so
    # nearer the side with no room: shifting it would leave it no length. It is taken out of the words and counted.
    pauses_ = [p(0, 500)] if found[0]["text"] == "uh" else [p(2500, 3000)]
    got = agree(found, pauses_, speech, 3000, middle)
    assert [x["text"] for x in got["words"]] == ["a"] and got["pauses"] == pauses_
    assert (got["gaveWay"], got["trimmed"], got["dropped"]) == (0, 0, 1)


def test_a_word_from_before_a_pause_to_its_very_end_keeps_its_start():
    # It starts before the pause and ends inside it or at its end: its end is moved to the pause's start. (Keeping its
    # end, as a word over the whole pause does, would leave it nothing.)
    got = agree([w("over", 900, 1500), w("b", 1600, 1900)], [p(1000, 1500)], [(900, 1000), (1600, 1900)], 3000, middle)
    assert got["words"][0] == w("over", 900, 1000) and (got["trimmed"], got["dropped"]) == (1, 0)


def test_a_word_pulled_into_the_head_or_the_tail_is_trimmed_out_of_it():
    # F2's jump of the first word: the aligner pulls a word's start into the silence before it, here the take's head; and a
    # last word's end into the tail. Silero hears speech in neither.
    found = [w("Morning", 40, 921), w("friends", 961, 1342), w("you.", 11874, 12700)]
    got = agree(found, [p(0, 519), p(12588, 12714)], [(640, 1342), (11874, 12576)], 12714, middle)
    assert got["words"][0]["startMs"] == 519 and got["words"][-1]["endMs"] == 12588
    assert got["pauses"] == [p(0, 519), p(12588, 12714)] and (got["gaveWay"], got["trimmed"]) == (0, 2)


def test_speech_at_a_pause_s_start_shrinks_it_rather_than_splitting_it():
    # Option B with the segment from the pause's start: the pause gives way from its start to where that speech ends.
    got = agree([w("a", 900, 1300), w("b", 2000, 2300)], [p(1000, 2000)], [(1000, 1300), (2000, 2300)], 3000, middle)
    assert got["pauses"] == [p(1300, 2000)] and got["gaveWay"] == 1
    assert got["words"][0] == w("a", 900, 1300) and got["trimmed"] == 0


@pytest.mark.parametrize("word", [w("over", 900, 1600), w("edge to edge", 1000, 1500), w("in", 1100, 1200), w("into", 900, 1100)],
                         ids=["over the whole pause", "edge to edge", "wholly inside", "reaching in"])
def test_the_last_check_refuses_a_word_over_or_in_a_pause(word: dict):
    with pytest.raises(RuntimeError, match="inside a pause"):
        outside_pauses([word], [p(1000, 1500)])


def test_the_last_check_lets_a_word_meet_a_pause_at_its_edges():
    found = [w("before", 400, 1000), w("after", 1500, 1800), w("nothing", 1500, 1500)]
    assert outside_pauses(found, [p(1000, 1500)]) == found


def test_pauses_that_overlap_are_refused_not_passed_on():
    # F1: `pauses` merges them; were two ever to overlap, agreeing on them raises rather than hand them on.
    with pytest.raises(RuntimeError, match="overlapping"):
        agree([w("a", 1000, 1200)], [p(0, 500), p(400, 900)], [(1000, 1200)], 3000, middle)


def test_after_agreeing_no_word_lies_inside_a_pause_and_starts_never_decrease():
    found = [w("a", 100, 400), w("b", 430, 520), w("c", 600, 650), w("d", 640, 900), w("e", 1100, 1300), w("f", 2000, 2300)]
    pauses_ = [p(380, 700), p(950, 1150), p(1350, 2010)]
    got = agree(found, pauses_, silero_hears(*found), 3000, middle)
    words_, pauses = got["words"], got["pauses"]
    assert not any(inside(x, pauses) for x in words_)
    starts = [x["startMs"] for x in words_]
    assert starts == sorted(starts) and all(x["startMs"] <= x["endMs"] for x in words_)
    # G3: the first pause gives way to "b" and "c" and its parts are all under 120 ms; "d", 60 ms into
    # it, is not moved to an edge that is gone.
    assert all(q["startMs"] >= 700 for q in pauses) and words_[3]["startMs"] == 640


@pytest.mark.parametrize(("code", "iso"), [("en", "en"), ("eng", "en"), ("deu", "de"), ("ger", "de"), ("ita", "it"), ("IT", "it")])
def test_languages_are_iso_639_1(code, iso):
    assert language_of(code) == iso


def test_a_language_without_an_aligner_fails_before_any_model_runs(tmp_path: Path):
    with pytest.raises(ValueError, match="fr"):
        words(tmp_path / "missing.wav", "fr", None)
    # A reference too (X98 is about the language heard; one given is the caller's word, held to X55).
    with pytest.raises(ValueError, match="no aligner for the language 'fr'"):
        words(tmp_path / "missing.wav", "fr", None, reference=True)
    with pytest.raises(ValueError, match="jpn"):
        language_of("jpn")


NOTHING = {"words": [], "untimed": 0, "apart": 0, "gaveWay": 0, "trimmed": 0, "dropped": 0, "pauses": [], "fellBack": None}


def test_an_empty_sound_gives_nothing_and_runs_no_model(tmp_path: Path):
    assert words(write16k(array("h"), tmp_path / "empty.wav"), None, None) == {"language": None, **NOTHING}
    assert words(write16k(array("h"), tmp_path / "empty.wav"), "it", None) == {"language": "it", **NOTHING}


def test_what_whisper_hears_is_silero_speech_and_the_stretches_between_pauses():
    # G1: the reviewer's case, a quiet word Silero marks inside the one measured pause, is heard.
    assert stretches([p(1003, 1680)], 3000, [(500, 1000), (1300, 1380), (1700, 2900)]) == [(0, 1003), (1300, 1380), (1680, 3000)]
    assert stretches([], 3000, [(500, 1000)]) == [(0, 3000)]
    assert stretches([p(0, 400)], 3000, [(420, 2000)]) == [(400, 3000)]
    assert stretches([p(2600, 3000)], 3000, [(100, 2580)]) == [(0, 2600)]
    assert stretches([p(0, 400), p(1000, 1500), p(2600, 3000)], 3000, [(420, 980), (1520, 2580)]) == [(400, 1000), (1500, 2600)]


def test_under_half_a_second_to_hear_is_too_little():
    # G2: the gate, on its own.
    assert MIN_HEARD_MS == 500
    assert too_little([(0, 200), (900, 1199)]) and not too_little([(0, 200), (900, 1200)])
    assert too_little([])


# G2, the reviewer's case: 3 s of room tone and a 60 ms click that Silero calls speech, heard in a
# process of its own, which then says which models were imported. Here neither is installed; in the
# speech image both are, so only this proves there that no text model or aligner ran.
ROOM_TONE = """
import json, sys
from media.sound import PER_MS
from media.words import hear
from sounds import noise, segments, sine
room = noise(3000, 20)
room[1500 * PER_MS:1560 * PER_MS] = sine(60, 6000, 2000)
found = [hear("room.wav", room, segments((1500, 1560)), language, None, 0) for language in (None, "de")]
print(json.dumps({"found": found, "imported": [name for name in ("faster_whisper", "whisperx") if name in sys.modules]}))
"""


def test_room_tone_with_one_click_gives_no_words_and_runs_no_model():
    worker = Path(__file__).resolve().parents[1]
    done = subprocess.run([sys.executable, "-c", ROOM_TONE], capture_output=True, text=True, cwd=worker,
                          env={**os.environ, "PYTHONPATH": os.pathsep.join([str(worker), str(worker / "tests")])})
    assert done.returncode == 0, done.stderr
    said = json.loads(done.stdout.splitlines()[-1])
    assert [x["words"] for x in said["found"]] == [[], []] and [x["language"] for x in said["found"]] == [None, "de"]
    assert said["imported"] == []


def test_text_with_nothing_to_say_gives_no_words(tmp_path: Path):
    pauses_ = [p(0, 300)]
    assert timed(["…", "—"], "en", silence(500), pauses_, [(300, 500)], 0) == {"language": "en", **NOTHING, "pauses": pauses_}


# Scribe, against its stand-in on 127.0.0.1 (`elevenlabs`, conftest.py).

def form(seen: dict) -> dict[str, bytes]:
    """The multipart form Scribe was sent, by field name."""
    message = BytesParser(policy=email_policy).parsebytes(b"Content-Type: " + seen["type"].encode() + b"\r\n\r\n" + seen["body"])
    return {part.get_param("name", header="content-disposition"): part.get_payload(decode=True) for part in message.iter_parts()}


def test_scribe_is_sent_the_sound_and_its_words_keep_their_punctuation(elevenlabs, tmp_path: Path):
    seen = elevenlabs["seen"]
    sound = tmp_path / "sound16k.wav"
    sound.write_bytes(b"RIFF....WAVEfmt the take's sound")
    texts, language = scribe(sound, "en", "the-key")
    assert seen["path"] == "/v1/speech-to-text"
    assert seen["key"] == "the-key"
    sent = form(seen)
    assert sent["model_id"] == module.SCRIBE_MODEL.encode() == b"scribe_v3"
    assert sent["language_code"] == b"en"
    assert sent["tag_audio_events"] == b"false"
    assert sent["file"] == sound.read_bytes()
    assert texts == ["Morning", "friends,", "it", "is", "bright."]
    assert language == "en"


def test_scribe_detects_the_language_when_none_is_given(elevenlabs, tmp_path: Path):
    seen = elevenlabs["seen"]
    sound = tmp_path / "sound16k.wav"
    sound.write_bytes(b"RIFF")
    _, language = scribe(sound, None, "the-key")
    assert "language_code" not in form(seen)
    assert language == "en"


def test_a_refusal_from_scribe_says_what_it_said_and_never_the_key(elevenlabs, tmp_path: Path):
    elevenlabs["status"] = 401
    sound = tmp_path / "sound16k.wav"
    sound.write_bytes(b"RIFF")
    with pytest.raises(RuntimeError, match="401") as refused:
        scribe(sound, "en", "the-secret-key")
    assert "invalid api key" in str(refused.value)
    assert "the-secret-key" not in str(refused.value)


def test_an_answer_without_words_is_no_text(elevenlabs, tmp_path: Path):
    elevenlabs["answer"] = {"language_code": "eng", "language_probability": 0.9, "text": ""}
    sound = tmp_path / "sound16k.wav"
    sound.write_bytes(b"RIFF")
    assert scribe(sound, None, "the-key") == ([], "en")


def spoken(tmp_path: Path):
    """Three seconds: speech (a tone standing in) from 500 to 2100 ms, silence around it; its 16 kHz file and samples."""
    samples = silence(500) + sine(1600, 6000, 220) + silence(900)
    return write16k(samples, tmp_path / "sound16k.wav"), samples


@pytest.fixture
def models(monkeypatch: pytest.MonkeyPatch) -> list:
    """Whisper and the aligner, stood in (both are models of the speech image, not here): what Whisper was asked."""
    asked = []

    def whisper(samples, to_hear, language, threads):
        asked.append(language)
        return ["it", "is", "bright."], language or "en"

    monkeypatch.setattr(module, "whisper", whisper)
    monkeypatch.setattr(module, "align", lambda spoken, language, samples, threads: [(0.6, 0.9), (1.0, 1.3), (1.4, 2.0)][:len(spoken)])
    return asked


@pytest.mark.parametrize("status", [429, 500, 503])
def test_scribe_busy_or_failing_has_whisper_hear_the_words_and_the_analysis_say_so(elevenlabs, models, tmp_path: Path, capsys, status: int):
    """M4: Scribe's 429 or 5xx is ElevenLabs' moment, not the take's: Whisper hears the words in its place, the log says
    so, and so does the analysis (`fellBack`, Scribe's answer)."""
    elevenlabs["status"] = status
    sound, samples = spoken(tmp_path)
    found = module.hear(sound, samples, segments((500, 2100)), "en", "the-key", 0)
    assert elevenlabs["seen"]["key"] == "the-key" and models == ["en"]
    assert [x["text"] for x in found["words"]] == ["it", "is", "bright."] and found["fellBack"] == status
    assert f"Scribe answered {status}" in capsys.readouterr().out


def test_scribe_refusing_the_key_fails_the_words_and_whisper_is_not_asked(elevenlabs, models, tmp_path: Path):
    elevenlabs["status"] = 401
    sound, samples = spoken(tmp_path)
    with pytest.raises(RuntimeError, match="Scribe refused sound16k.wav: 401"):
        module.hear(sound, samples, segments((500, 2100)), "en", "the-key", 0)
    assert models == []


def test_scribe_s_words_record_no_fall_back(elevenlabs, models, tmp_path: Path):
    elevenlabs["answer"] = {**elevenlabs["answer"], "words": [{"text": "it", "type": "word"}, {"text": " ", "type": "spacing"},
                                                {"text": "is", "type": "word"}, {"text": " ", "type": "spacing"},
                                                {"text": "bright.", "type": "word"}]}
    sound, samples = spoken(tmp_path)
    found = module.hear(sound, samples, segments((500, 2100)), "en", "the-key", 0)
    assert found["fellBack"] is None and models == [] and len(found["words"]) == 3


# A reference (X103): never heard. No listening model and no aligner run; it keeps its pauses, as Silero measures them.

SPANISH = {"language_code": "spa", "language_probability": 0.97, "text": "Hola a todos.",
           "words": [{"text": "Hola", "type": "word"}, {"text": " ", "type": "spacing"}, {"text": "a", "type": "word"},
                     {"text": " ", "type": "spacing"}, {"text": "todos.", "type": "word"}]}


@pytest.fixture
def listened(monkeypatch: pytest.MonkeyPatch) -> list:
    """Every model that listens or aligns, stood in to say it was asked: Scribe, Whisper and the aligner."""
    asked = []
    monkeypatch.setattr(module, "scribe", lambda sound, language, key: asked.append("scribe") or (["made", "up."], "en"))
    monkeypatch.setattr(module, "whisper", lambda samples, to_hear, language, threads: asked.append("whisper") or (["made", "up."], "en"))
    monkeypatch.setattr(module, "align", lambda spoken, language, samples, threads: asked.append("align") or [(0.6, 0.9), (1.0, 1.3)][:len(spoken)])
    return asked


@pytest.mark.parametrize(("language", "key"), [(None, "the-key"), (None, None), ("en", "the-key")], ids=["with a key", "without", "English given"])
def test_a_reference_is_not_heard_and_keeps_its_pauses(listened, tmp_path: Path, language: str | None, key: str | None):
    """X103: nothing listens to a reference, with a key or without, its language given or not: no words, no language, and the
    pauses Silero's speech leaves, as the analysis keeps them."""
    sound, samples = spoken(tmp_path)
    found = module.hear(sound, samples, segments((500, 2100)), language, key, 0, reference=True)
    assert found == nothing(None, pauses_between(samples, segments((500, 2100)))) and found["pauses"]
    assert listened == []
    # The same sound as a take is heard as before.
    assert module.hear(sound, samples, segments((500, 2100)), language, key, 0)["words"] and listened[0] == ("scribe" if key else "whisper")


def test_a_reference_with_no_speech_or_too_little_has_no_pauses_as_a_take_has_none(listened, tmp_path: Path):
    sound, samples = spoken(tmp_path)
    assert module.hear(sound, samples, [], "en", "the-key", 0, reference=True) == nothing(None)
    # A sound of 400 ms, speech over most of it: under half a second to hear (G2).
    short = silence(50) + sine(300, 6000, 220) + silence(50)
    assert too_little(stretches(pauses_between(short, segments((50, 350))), 400, [(50, 350)]))
    assert module.hear(write16k(short, tmp_path / "short.wav"), short, segments((50, 350)), None, "the-key", 0, reference=True) == nothing(None)
    assert listened == []


def test_a_reference_reaches_no_listening_service_even_when_it_would_be_busy(elevenlabs, tmp_path: Path):
    """With the real Scribe call and its stand-in on 127.0.0.1 answering 503: it is never called, so nothing falls back."""
    elevenlabs["status"] = 503
    sound, samples = spoken(tmp_path)
    found = module.hear(sound, samples, segments((500, 2100)), None, "the-key", 0, reference=True)
    assert elevenlabs["seen"] == {} and (found["words"], found["language"], found["fellBack"]) == ([], None, None) and found["pauses"]


def test_a_take_heard_in_a_language_without_an_aligner_still_fails(elevenlabs, models, tmp_path: Path):
    elevenlabs["answer"] = SPANISH
    sound, samples = spoken(tmp_path)
    with pytest.raises(ValueError, match=r"^no aligner for the language 'spa'"):
        module.hear(sound, samples, segments((500, 2100)), None, "the-key", 0)


# The models, in the speech image on Modal: the owner's take, and sounds with nothing to say.

# The take's words are not in git (the repo is public): they are in the Volume edit-dev-media, as take-words.json, put there
# from .scratch/media/ (git-ignored), and the tests that need them skip where it is not. It holds the take's text (Whisper's
# with R3's prompt, run 8, as Scribe's stand-in gives it), its first three and last two words, and test 5's measures (plan,
# Task 4): where words of the take start by its own sound, measured with .scratch/worker-proof/words/measure.py, as
# (index among the words heard, the word as said, ms). After a pause, where the band above 300 Hz rises off the floor; a
# word starting with b, d, g, p, t or k, at its burst; "s", by the band above 4 kHz. `within60`: held to the plan's 60 ms,
# the words after a pause (the head, the pause before the app's name), one after a short gap, and those starting with a
# voiced stop. `insideSpeech`: X54's known limit, a word inside speech that starts with an aspirated stop (p, t, k) or an
# "s" may start up to 200 ms late (166 measured), since the aligner starts it on its vowel; only its caption moves, as a cut
# lands in a pause. The last but one word counts as such a word (F3): by the product's own pauses it is inside speech, since
# Silero hears the sound at 11.24-11.36 s before it and no pause meets it.
TAKE_WORDS = next((path for path in (Path("/dev-media/take-words.json"), Path(__file__).resolve().parents[2] / ".scratch/media/take-words.json")
                   if path.exists()), None)
with_the_take_s_words = pytest.mark.skipif(TAKE_WORDS is None, reason="the take's words are not in git: the Volume's take-words.json")
KNOWN_LIMIT_MS = 200


def take_words() -> dict:
    return json.loads(TAKE_WORDS.read_text())


def timed_as_measured(found: dict) -> None:
    """The take's words and pauses: what test 5 holds them to, and X54's rule."""
    assert found["language"] == "en" and found["untimed"] == 0
    agreed, pauses_ = found["words"], found["pauses"]
    assert len(agreed) == 27, [x["text"] for x in agreed]
    starts = [x["startMs"] for x in agreed]
    assert starts == sorted(starts)
    assert all(isinstance(x["startMs"], int) and x["startMs"] <= x["endMs"] <= TAKE_MS for x in agreed)
    assert not any(inside(x, pauses_) for x in agreed)
    assert pauses_[0]["startMs"] == 0  # the head
    # H1: the take's pauses (Task 4's record, Scribe's path in Task 5's run 4b), each edge within 20 ms as the cut take's
    # pauses are held, and none given way: without a key Whisper writes a wrong word for a quiet one and the aligner lays
    # it over the two pauses after the ninth word, where Silero hears no speech; it is trimmed to start where the second ends.
    assert len(pauses_) == len(TAKE_PAUSES), pauses_
    assert all(abs(a["startMs"] - b["startMs"]) <= 20 and abs(a["endMs"] - b["endMs"]) <= 20 for a, b in zip(pauses_, TAKE_PAUSES)), pauses_
    assert (found["gaveWay"], found["dropped"]) == (0, 0)
    assert agreed[9]["startMs"] == pauses_[2]["endMs"], agreed[9]
    measured = take_words()
    for i, said, ms in measured["within60"]:
        assert abs(agreed[i]["startMs"] - ms) <= 60, (said, ms, agreed[i])
    for i, said, ms in measured["insideSpeech"]:
        assert -60 <= agreed[i]["startMs"] - ms <= KNOWN_LIMIT_MS, (said, ms, agreed[i])


@in_the_speech_image
@with_the_take_s_words
def test_the_owners_take_is_heard_and_timed_on_its_sound():
    found, said = words(TAKE, None, None), take_words()
    assert found["words"][0]["text"][0].isupper() and found["words"][-1]["text"].endswith(".")  # R3: cased, punctuated
    heard = [x["text"].strip(",.!?").lower() for x in found["words"]]
    assert heard[:3] == said["first"] and heard[-2:] == said["last"]
    timed_as_measured(found)


@in_the_speech_image
@with_the_take_s_words
def test_scribe_end_to_end_on_the_take_with_its_stand_in(elevenlabs):
    # M11: Scribe's path through `say`, the aligner and the agreement, on the take's sound.
    items, text_ = [], take_words()["text"]
    for i, text in enumerate(text_.split()):
        items += [{"text": " ", "type": "spacing", "logprob": 0}] if i else []
        items.append({"text": text, "type": "word", "logprob": -0.1, "start": 0.0, "end": 0.0})
    elevenlabs["answer"] = {"language_code": "eng", "language_probability": 0.98, "text": text_, "words": items}
    found = words(TAKE, None, "the-stand-ins-key")
    assert elevenlabs["seen"]["key"] == "the-stand-ins-key"
    assert [x["text"] for x in found["words"]] == text_.split()
    timed_as_measured(found)


@in_the_speech_image
@with_the_take_s_words
def test_scribe_failing_on_the_take_has_whisper_time_it_as_measured(elevenlabs):
    # M4 in the image: ElevenLabs answers 503, and Whisper and the aligner hear the take as on the path without a key.
    elevenlabs["status"] = 503
    found = words(TAKE, None, "the-stand-ins-key")
    assert elevenlabs["seen"]["key"] == "the-stand-ins-key" and found["fellBack"] == 503
    timed_as_measured(found)


@in_the_speech_image
def test_the_owners_take_as_a_reference_is_not_heard_and_keeps_its_pauses_as_measured(elevenlabs):
    """X103 in the image, Silero for real: the owner's take as a reference reaches no listening service, and its pauses are
    as measured; as a take, the same sound heard in Spanish still fails (X55)."""
    elevenlabs["answer"] = SPANISH
    found = words(TAKE, None, "the-stand-ins-key", reference=True)
    assert (found["words"], found["language"], found["fellBack"]) == ([], None, None) and elevenlabs["seen"] == {}
    assert found["pauses"] == pauses_between(read16k(TAKE), module.speech(read16k(TAKE)))
    assert len(found["pauses"]) == len(TAKE_PAUSES) and all(abs(a["startMs"] - b["startMs"]) <= 20 and abs(a["endMs"] - b["endMs"]) <= 20
                                                           for a, b in zip(found["pauses"], TAKE_PAUSES)), found["pauses"]
    with pytest.raises(ValueError, match=r"^no aligner for the language 'spa'"):
        words(TAKE, None, "the-stand-ins-key")


@in_the_speech_image
def test_silence_gives_no_words_and_no_pauses(tmp_path: Path):
    assert words(write16k(silence(3000), tmp_path / "silence.wav"), None, None) == {"language": None, **NOTHING}


def chords() -> array:
    """Music standing in: four chords of three sines, each struck and fading, over low noise; 2.4 s."""
    out = array("h")
    for root in (220.0, 174.6, 261.6, 196.0):
        out += array("h", (round(3000 * min(1, i / 320) * math.exp(-i / 6400) * sum(math.sin(2 * math.pi * root * k * i / 16000) for k in (1, 1.26, 1.5)))
                           for i in range(600 * PER_MS)))
    return mixed(out, noise(2400, 30))


@in_the_speech_image
def test_music_gives_no_words(tmp_path: Path):
    found = words(write16k(chords(), tmp_path / "music.wav"), None, None)
    assert found["words"] == [], found
