"""The analysis pipeline: a take in, its copies and one analysis.json out, with progress (X39).

Here the copies, the cuts, the picture and the loudness are made and measured for real. Two stages cannot run on this
Mac and are stood in for, at their module's function, in the tests that need them: `words` (Silero, Whisper and the
aligner need torch and the models) and `faces` (MediaPipe and its model). Both are in the speech image, where the last
test runs the whole pipeline with neither stood in. A reference is not heard (X103): its words stage runs for real here
but for Silero, stood in at its function, with Scribe stood in on 127.0.0.1 to show it is never called.
"""

import importlib.util
import json
from pathlib import Path

import pytest

from helpers import a_still, ffmpeg, talking_head
from media import analyse as pipeline
from media.analyse import STAGES, analyse, not_too_long, stages, whole
from media.loudness import loudness
from media.pauses import pauses_between
from media.probe import plays_ms, probe, stored_ms
from media.sound import read16k
from sounds import segments

KEYS = {"facts", "ms", "files", "language", "words", "untimed", "apart", "gaveWay", "trimmed", "dropped", "pauses", "faces", "cuts",
        "picture", "loudness", "fellBack"}
# The owner's take's poster in the Volume edit-dev-media: a still of a face, for the stand-in in the image.
POSTER = Path("/dev-media/takes/take.mp4/poster.jpg")


class Heard:
    """What `on_progress` was told, in order."""

    def __init__(self):
        self.said: list[tuple[str, float]] = []

    def __call__(self, stage: str, share: float) -> None:
        self.said.append((stage, share))

    def in_order(self, reference: bool = False) -> None:
        """Every stage that runs (a reference's text too), in order, each told at its start and its end; the share never
        going back, ending at exactly 1."""
        told, running = [stage for stage, _ in self.said], stages(reference)
        assert [s for i, s in enumerate(told) if i == 0 or told[i - 1] != s] == list(running)
        assert all(told.count(stage) >= 2 for stage in running)
        shares = [share for _, share in self.said]
        assert shares == sorted(shares) and shares[0] == 0 and shares[-1] == 1.0 and all(0 <= x <= 1 for x in shares)


def test_every_stage_runs_in_order_and_the_analysis_is_stored_beside_the_copies(stood_in, tmp_path: Path):
    source = talking_head(tmp_path, a_still(tmp_path))
    out = tmp_path / "out"
    heard = Heard()
    found = analyse(source, out, "a-key", heard, threads=3)

    heard.in_order()
    assert set(found) == KEYS
    assert json.loads((out / "analysis.json").read_text()) == found
    assert found["files"] == {"full": "full.mp4", "preview": "preview.mp4", "poster": "poster.jpg", "sound16k": "sound16k.wav"}
    assert all((out / name).is_file() for name in found["files"].values())
    facts = found["facts"]
    assert facts["source"] == probe(source) and facts["full"] == probe(out / "full.mp4") and facts["preview"] == probe(out / "preview.mp4")
    assert found["ms"] == stored_ms(facts["full"], facts["preview"]) and abs(found["ms"] - 3000) <= 50
    # The speech steps heard the 16 kHz sound, with the key and the cores, as a take's (not a reference's); the faces were
    # looked for on the preview.
    assert stood_in["words"] == [(out / "sound16k.wav", None, "a-key", 3, False)] and stood_in["faces"] == [out / "preview.mp4"]
    # One shot of a still picture: no cuts; its picture every 500 ms of the preview copy.
    assert found["cuts"] == [] and [x["ms"] for x in found["picture"]] == list(range(0, facts["preview"]["videoMs"], 500))
    # The loudness is the full copy's, as the film plays it.
    assert found["loudness"] == loudness(out / "full.mp4") and found["loudness"]["lufs"] == pytest.approx(-23, abs=0.2)
    assert found["language"] is None and found["words"] == [] and found["pauses"] == []


def test_a_take_without_sound_has_no_words_no_pauses_and_no_loudness(stood_in, tmp_path: Path):
    source = tmp_path / "silent.mp4"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=2", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", str(source))
    heard = Heard()
    found = analyse(source, tmp_path / "out", None, heard, language="de")
    heard.in_order()
    assert stood_in["words"] == []  # no sound to hear, so the speech steps are not asked
    assert found["files"]["sound16k"] is None and found["loudness"] is None
    assert (found["language"], found["words"], found["pauses"]) == ("de", [], [])


def picture_and_sound(folder: Path, picture_s: float, sound_s: float, name: str) -> Path:
    """A fast-start MP4 of `picture_s` seconds of picture and `sound_s` of a -23 dBFS tone."""
    path = folder / name
    wave = "0.0707946*sin(2*PI*1000*t)"
    ffmpeg("-f", "lavfi", "-i", f"testsrc2=size=640x360:rate=30:duration={picture_s}", "-f", "lavfi",
           "-i", f"aevalsrc={wave}|{wave}:s=48000:d={sound_s}", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-movflags", "+faststart", str(path))
    return path


def cut_in_half(whole: Path) -> Path:
    """`whole` cut to half its bytes: its index (at the front) whole, its data short."""
    cut = whole.with_name("cut.mp4")
    cut.write_bytes(whole.read_bytes()[: whole.stat().st_size // 2])
    return cut


# The ledger's case: a fast-start MP4 cut to half its bytes. ffprobe gives the whole length, and ffmpeg
# makes copies of what is there without failing. Each stream is held to its own copy (X57, as amended):
# the review's file, 8 s of picture and 2 s of sound, passed while the guard took the shorter of the two.
@pytest.mark.parametrize(("picture_s", "sound_s"), [(6, 6), (8, 2)], ids=["6 s of both", "8 s of picture, 2 s of sound"])
def test_a_take_cut_short_fails_saying_how_long_its_picture_says_it_is_and_how_long_it_plays(stood_in, tmp_path: Path,
                                                                                               picture_s: int, sound_s: int):
    cut = cut_in_half(picture_and_sound(tmp_path, picture_s, sound_s, "whole.mp4"))
    assert (probe(cut)["videoMs"], probe(cut)["audioMs"]) == (picture_s * 1000, sound_s * 1000)
    heard = Heard()
    with pytest.raises(ValueError, match=rf"^cut\.mp4 is cut short: its picture declares {picture_s}\.0 s, plays [1-5]\.\d s$"):
        analyse(cut, tmp_path / "out", None, heard)
    assert {stage for stage, _ in heard.said} == {"copies"} and stood_in["words"] == []


def test_a_take_whose_sound_ends_long_before_its_picture_is_not_cut_short(stood_in, tmp_path: Path):
    found = analyse(picture_and_sound(tmp_path, 8, 2, "uncut.mp4"), tmp_path / "out", None, Heard())
    assert found["ms"] == 8000 and abs(found["facts"]["full"]["audioMs"] - 2000) <= 50


def test_a_sound_that_plays_short_of_what_it_declares_fails_naming_the_sound(tmp_path: Path):
    facts = {"videoMs": 8000, "audioMs": 8000, "sound": True}
    whole(Path("take.mp4"), facts, {**facts, "audioMs": 7100})  # 900 ms short: within a second
    with pytest.raises(ValueError, match=r"^take\.mp4 is cut short: its sound declares 8\.0 s, plays 6\.8 s$"):
        whole(Path("take.mp4"), facts, {**facts, "audioMs": 6800})
    whole(Path("take.mp4"), {**facts, "audioMs": None, "sound": False}, {**facts, "audioMs": None, "sound": False})


def test_a_full_copy_that_lost_the_take_s_sound_fails_as_ours_not_with_a_type_error():
    # 79: a take with sound whose full copy has none (never seen) is the copy's failure, said so, not `int - None`.
    facts = {"videoMs": 8000, "audioMs": 8000, "sound": True}
    with pytest.raises(RuntimeError, match=r"^take\.mp4: its full copy has no sound, though the take has$"):
        whole(Path("take.mp4"), facts, {**facts, "audioMs": None, "sound": False})


def test_the_analysis_is_utf_8_and_never_holds_a_number_json_has_not(stood_in, monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    source = talking_head(tmp_path, a_still(tmp_path))
    said = {"language": "de", "words": [{"text": "Grüße", "startMs": 100, "endMs": 400}], "untimed": 0, "apart": 0, "gaveWay": 0,
            "trimmed": 0, "dropped": 0, "pauses": [], "fellBack": None}
    monkeypatch.setattr("media.words.words", lambda *args, **kwargs: said)
    analyse(source, tmp_path / "out", None, Heard())
    assert "Grüße".encode() in (tmp_path / "out" / "analysis.json").read_bytes()
    monkeypatch.setattr("media.faces.faces", lambda preview: [{"ms": 0, "face": {"x": float("nan"), "y": 0, "w": 0.1, "h": 0.1}, "mouth": None}])
    with pytest.raises(ValueError, match="JSON"):
        analyse(source, tmp_path / "again", None, Heard())


@pytest.mark.parametrize(("name", "codecs"), [("take.mkv", ["-c:v", "libx264", "-c:a", "aac"]),
                                              ("take.webm", ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-c:a", "libopus"])])
def test_a_take_that_is_not_mp4_or_quicktime_is_refused_before_its_copies_are_made(stood_in, tmp_path: Path, name: str, codecs: list[str]):
    """Uploads are MP4 or QuickTime only (the ledger, Task 5: ffprobe gives a Matroska file's streams the file's
    length, so its own length guard cannot hold one to its sound)."""
    source = tmp_path / name
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30:duration=1", "-f", "lavfi", "-i", "sine=duration=1", *codecs, str(source))
    heard = Heard()
    with pytest.raises(ValueError, match=rf"^{name.replace('.', r'\.')} is not an MP4 or QuickTime file \(it is (Matroska|WebM)"):
        analyse(source, tmp_path / "out", None, heard)
    assert heard.said == [("copies", 0.0)] and not (tmp_path / "out").exists()


def minutes_of_picture(folder: Path, seconds: int, name: str) -> Path:
    """A take of `seconds` of a grey picture, 64 by 64 at one frame a second, without sound: small and quick to make."""
    path = folder / name
    ffmpeg("-f", "lavfi", "-i", f"color=c=gray:size=64x64:rate=1:duration={seconds}", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", str(path))
    return path


def test_a_take_over_ten_minutes_is_refused_after_its_probe_before_its_copies_are_made(stood_in, tmp_path: Path):
    """X56: a take is at most ten minutes. The worker refuses a longer one as soon as it has probed it, so no copy is
    made and no word is heard; the app's own check (X76) stays as a second guard."""
    heard = Heard()
    with pytest.raises(ValueError, match=r"^long\.mp4 is longer than 10 minutes \(it is 10:01\)$"):
        analyse(minutes_of_picture(tmp_path, 601, "long.mp4"), tmp_path / "out", None, heard)
    assert heard.said == [("copies", 0.0)] and not (tmp_path / "out").exists() and stood_in["words"] == []


def test_a_take_of_nine_minutes_59_passes_the_ten_minute_check(tmp_path: Path):
    source = minutes_of_picture(tmp_path, 599, "nearly.mp4")
    facts = probe(source)
    assert facts["ms"] == 599_000
    not_too_long(source, facts)
    # The edge, as the app has it (X76): ten minutes exactly is not longer; a millisecond more is.
    not_too_long(source, {**facts, "videoMs": 600_000, "ms": 600_000})
    with pytest.raises(ValueError, match=r"^nearly\.mp4 is longer than 10 minutes \(it is 10:01\)$"):
        not_too_long(source, {**facts, "videoMs": 600_001, "ms": 600_001})
    # M3: its length in whole seconds rounded up, so a take over ten minutes never reads 10:00.
    with pytest.raises(ValueError, match=r"\(it is 10:01\)$"):
        not_too_long(source, {**facts, "videoMs": 600_500, "ms": 600_500})


def test_a_reference_over_three_minutes_is_refused_after_its_probe_before_its_copies_are_made(stood_in, tmp_path: Path):
    """X98: a reference is at most three minutes, its length rounded up as a take's is (3:00.5 reads 3:01)."""
    source = tmp_path / "outlier.mp4"
    ffmpeg("-f", "lavfi", "-i", "color=c=gray:size=64x64:rate=2:duration=180.5", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
           str(source))
    assert probe(source)["ms"] == 180_500
    heard = Heard()
    with pytest.raises(ValueError, match=r"^outlier\.mp4 is longer than 3 minutes \(it is 3:01\)$"):
        analyse(source, tmp_path / "out", None, heard, reference=True)
    assert heard.said == [("copies", 0.0)] and not (tmp_path / "out").exists() and stood_in["words"] == []
    # A take of that length is not a reference: it is held to ten minutes only.
    not_too_long(source, probe(source))
    # Three minutes exactly is not longer.
    not_too_long(source, {**probe(source), "videoMs": 180_000, "ms": 180_000}, reference=True)


def test_quicktime_and_mp4_are_taken(stood_in, tmp_path: Path):
    source = tmp_path / "take.mov"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30:duration=1", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", str(source))
    assert analyse(source, tmp_path / "out", None, Heard())["facts"]["source"]["videoMs"] == 1000


@pytest.mark.parametrize("reference", [False, True], ids=["a take", "a reference"])
def test_a_language_without_an_aligner_fails_before_anything_runs(stood_in, tmp_path: Path, reference: bool):
    """A language given is the caller's word, held to X55 in reference mode too: X98 is about the language heard."""
    source = talking_head(tmp_path, a_still(tmp_path))
    heard = Heard()
    with pytest.raises(ValueError, match="no aligner for the language 'fr'"):
        analyse(source, tmp_path / "out", None, heard, language="fr", reference=reference)
    assert heard.said == [] and not (tmp_path / "out").exists()


SPANISH = {"language_code": "spa", "language_probability": 0.97, "text": "Hola a todos.",
           "words": [{"text": "Hola", "type": "word"}, {"text": " ", "type": "spacing"}, {"text": "a", "type": "word"},
                     {"text": " ", "type": "spacing"}, {"text": "todos.", "type": "word"}]}
PHRASES = segments((500, 1300), (1700, 2500))  # where Silero (stood in) hears speech, in samples


def two_phrases(folder: Path) -> Path:
    """Three seconds: a still, and a tone standing in for speech from 0.5 to 1.3 s and from 1.7 to 2.5 s, silence around it."""
    path = folder / "frases.mp4"
    wave = r"if(between(t\,0.5\,1.3)+between(t\,1.7\,2.5)\,0.2*sin(2*PI*220*t)\,0)"
    ffmpeg(*a_still(folder), "-f", "lavfi", "-i", f"aevalsrc={wave}:s=48000:d=3", "-t", "3", "-c:v", "libx264", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-movflags", "+faststart", str(path))
    return path


def test_a_reference_is_analysed_with_no_words_and_its_pauses_and_nothing_listens(elevenlabs, monkeypatch: pytest.MonkeyPatch,
                                                                                     tmp_path: Path):
    """X103: a reference is not heard. Scribe's stand-in, with a key given, is never called; the reference has no words and
    no language, and keeps the pauses Silero's speech leaves (its pace is read from them and its cuts). The same file as a
    take is heard: in Spanish it fails as before (X55), at its words, before the faces."""
    monkeypatch.setattr("media.words.speech", lambda samples: PHRASES)
    looked = []
    monkeypatch.setattr("media.faces.faces", lambda preview: looked.append(preview) or [])
    monkeypatch.setattr("media.text.text", lambda source, ms, out: {"text": [], "sheet": {"file": "sheet.jpg", "ms": []}})  # tested below
    source, out = two_phrases(tmp_path), tmp_path / "out"
    heard = Heard()
    found = analyse(source, out, "the-key", heard, reference=True)
    heard.in_order(reference=True)
    assert (found["language"], found["words"], found["fellBack"]) == (None, [], None) and elevenlabs["seen"] == {}
    assert found["pauses"] == pauses_between(read16k(out / "sound16k.wav"), PHRASES) and len(found["pauses"]) == 3
    assert json.loads((out / "analysis.json").read_text()) == found

    elevenlabs["answer"] = SPANISH
    again = Heard()
    with pytest.raises(ValueError, match=r"^no aligner for the language 'spa'"):
        analyse(source, tmp_path / "again", "the-key", again)
    assert [stage for stage, _ in again.said] == ["copies", "copies", "words"] and looked == [out / "preview.mp4"]
    assert elevenlabs["seen"]["key"] == "the-key"


def test_the_cuts_and_the_picture_are_measured_on_the_preview_copy(stood_in, tmp_path: Path):
    """A take of two shots, dark then bright, cut at 1.5 s: one cut there, and the picture brighter after it."""
    source = tmp_path / "two-shots.mp4"
    wave = "0.0707946*sin(2*PI*1000*t)"
    ffmpeg("-f", "lavfi", "-i", "color=c=navy:size=720x1280:rate=30:duration=1.5[a];color=c=orange:size=720x1280:rate=30:duration=1.5[b];[a][b]concat=n=2:v=1:a=0",
           "-f", "lavfi", "-i", f"aevalsrc={wave}|{wave}:s=48000:d=3", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
           "-c:a", "aac", str(source))
    found = analyse(source, tmp_path / "out", None, Heard())
    assert len(found["cuts"]) == 1 and abs(found["cuts"][0] - 1500) <= 1000 / 30, found["cuts"]
    assert [x["ms"] for x in found["picture"]] == [0, 500, 1000, 1500, 2000, 2500]
    assert [x["luma"] > 0.4 for x in found["picture"]] == [False, False, False, True, True, True], found["picture"]
    assert all(x["warmth"] < -0.2 for x in found["picture"][:3]) and all(x["warmth"] > 0.2 for x in found["picture"][3:])


@pytest.mark.parametrize("reference", [False, True], ids=["a take", "a reference"])
def test_the_stages_shares_add_up_to_the_whole(reference: bool):
    shares, running = pipeline.shares(reference), stages(reference)
    assert list(shares) == list(running) and ("text" in running) == reference
    assert shares[running[0]][0] == 0 and shares[running[-1]][1] == 1.0
    assert all(shares[a][1] == shares[b][0] for a, b in zip(running, running[1:]))
    assert all(start < end for start, end in shares.values())


def test_a_reference_s_stages_weigh_as_measured_and_a_take_s_as_before():
    """X103 and Task 9c: a reference's words stage only measures its pauses, its copies are lighter, it has no loudness; its
    weights are its own (`REFERENCE_WEIGHTS`), a take's unchanged."""
    width = {name: end - start for name, (start, end) in pipeline.shares(reference=True).items()}
    assert list(width) == ["copies", "words", "faces", "cuts", "picture", "text"] and list(pipeline.REFERENCE_WEIGHTS) == list(width)
    assert max(width, key=width.get) == "text" and width["words"] < 0.1 and width["copies"] > width["faces"]
    assert pipeline.shares() == {"copies": (0, 0.3100), "words": (0.31, 0.83), "faces": (0.83, 0.96), "cuts": (0.96, 0.97),
                                 "picture": (0.97, 0.99), "loudness": (0.99, 1.0)}


def test_a_take_s_shares_are_those_it_had_before_the_text_stage():
    """The text stage is a reference's only: a take's progress is told as before part 3's Task 9b (Task 8's shares)."""
    assert pipeline.shares() == {"copies": (0, 0.3100), "words": (0.31, 0.83), "faces": (0.83, 0.96), "cuts": (0.96, 0.97),
                                 "picture": (0.97, 0.99), "loudness": (0.99, 1.0)}
    assert STAGES == ("copies", "words", "faces", "cuts", "picture", "text", "loudness")


def test_a_reference_is_analysed_lighter_its_text_read_on_the_upload_and_its_sheet_kept_and_a_take_as_before(
        stood_in, monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """Task 9c, the reader stood in at its module (it is in the speech image, and `test_text.py` tests it): a reference gets
    its preview copy and its sound only (no full copy, no poster), its text read on the file as uploaded over its stored
    length, its sheet written beside the analysis and named in it, and no loudness measured; a take's analysis is as it
    was, with no `text` and no `sheet`."""
    read = []
    said = [{"ms": 250, "lines": [{"box": {"x": 0.1, "y": 0.8, "w": 0.5, "h": 0.04}, "text": "made up", "score": 0.99,
                                   "colours": [{"hex": "#ffffff", "share": 0.3, "from": 0.05, "to": 0.95}], "around": [{"hex": "#111111", "share": 1.0}],
                                   "beyond": [{"hex": "#8a7a6a", "share": 0.6}]}]}]

    def text(source, ms, out):
        read.append((Path(source), ms))
        (Path(out) / "sheet.jpg").write_bytes(b"a made-up sheet")
        return {"text": said, "sheet": {"file": "sheet.jpg", "ms": [250]}}

    monkeypatch.setattr("media.text.text", text)
    source = talking_head(tmp_path, a_still(tmp_path))

    heard = Heard()
    found = analyse(source, tmp_path / "ref", None, heard, reference=True)
    heard.in_order(reference=True)
    assert "loudness" not in {stage for stage, _ in heard.said} and found["loudness"] is None
    assert read == [(source, found["ms"])] and found["text"] == said and found["sheet"] == {"file": "sheet.jpg", "ms": [250]}
    assert found["files"] == {"preview": "preview.mp4", "sound16k": "sound16k.wav", "sheet": "sheet.jpg"}
    assert sorted(path.name for path in (tmp_path / "ref").iterdir()) == ["analysis.json", "preview.mp4", "sheet.jpg", "sound16k.wav"]
    assert set(found["facts"]) == {"source", "preview"} and found["ms"] == plays_ms(found["facts"]["preview"]) and abs(found["ms"] - 3000) <= 50
    assert set(found) == KEYS | {"text", "sheet"}
    assert json.loads((tmp_path / "ref" / "analysis.json").read_text()) == found

    heard = Heard()
    found = analyse(source, tmp_path / "take", None, heard)
    heard.in_order()
    assert set(found) == KEYS and "text" not in found and "sheet" not in found and len(read) == 1
    assert found["files"] == {"full": "full.mp4", "preview": "preview.mp4", "poster": "poster.jpg", "sound16k": "sound16k.wav"}


def test_a_soundless_reference_given_a_language_keeps_none(stood_in, tmp_path: Path):
    """X103: a reference has no language, sound or no sound (review, Minor 9)."""
    source = tmp_path / "silent.mp4"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30:duration=2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(source))
    assert analyse(source, tmp_path / "ref", None, Heard(), language="en", reference=True)["language"] is None
    assert analyse(source, tmp_path / "take", None, Heard(), language="en")["language"] == "en"


# In the speech image: the whole pipeline, nothing stood in.

@pytest.mark.skipif(any(importlib.util.find_spec(m) is None for m in ("mediapipe", "silero_vad")) or not POSTER.exists(),
                    reason="the models and the owner's take are in the speech image on Modal")
def test_the_stand_in_runs_every_stage_in_the_image(tmp_path: Path):
    # The owner's poster as the still: a face to find; the tone is no speech, so no text model runs.
    source = talking_head(tmp_path, ["-loop", "1", "-framerate", "30", "-i", str(POSTER)])
    heard = Heard()
    found = analyse(source, tmp_path / "out", None, heard)
    heard.in_order()
    assert (found["language"], found["words"], found["pauses"]) == (None, [], [])
    assert [x["ms"] for x in found["faces"]] == list(range(0, found["facts"]["preview"]["videoMs"], 200))
    assert sum(1 for x in found["faces"] if x["face"] and x["mouth"]) >= 0.95 * len(found["faces"])
    assert found["loudness"]["lufs"] == pytest.approx(-23, abs=0.2)
    assert json.loads((tmp_path / "out" / "analysis.json").read_text()) == found
