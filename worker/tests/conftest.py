"""The five kinds of take the plan names, made once per run; the two stages of the analysis that cannot run here, stood in;
and ElevenLabs' Scribe, stood in on 127.0.0.1 (the one network boundary of the words)."""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from helpers import AAC, H264, Take, ffmpeg, picture, tone, turned
from media import words as speech_module
from media.probe import probe
from media.text import moments
from media.words import nothing


@pytest.fixture(scope="session")
def takes(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Take]:
    """Two seconds each."""
    d = tmp_path_factory.mktemp("takes")
    out = {}

    ffmpeg(*picture("1280x720", 30, 2), *tone(2), *H264, *AAC, str(d / "h264_30.mp4"))
    out["h264_30"] = Take(d / "h264_30.mp4", (1280, 720), (960, 540), 30, True)

    # An iPhone's default: HEVC, 10 bits, HLG, here at 60 frames a second and larger than 1920.
    hlg = "log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc"
    ffmpeg(*picture("2560x1440", 60, 2), *tone(2), "-c:v", "libx265", "-preset", "ultrafast",
           "-pix_fmt", "yuv420p10le", "-x265-params", hlg, "-tag:v", "hvc1", *AAC, str(d / "hevc_hlg_60.mp4"))
    out["hevc_hlg_60"] = Take(d / "hevc_hlg_60.mp4", (1920, 1080), (960, 540), 60, True)

    # 30 pictures a second for the first second, 20 for the next: about 26 on average.
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=60:duration=2,select='if(lt(t,1),not(mod(n,2)),not(mod(n,3)))'",
           *tone(2), "-fps_mode", "vfr", *H264, *AAC, str(d / "vfr.mp4"))
    out["vfr"] = Take(d / "vfr.mp4", (640, 360), (640, 360), 30, True)

    # Filmed upright on a phone: stored on its side, turned a quarter clockwise to be shown.
    ffmpeg(*picture("1280x720", 30, 2), *tone(2), *H264, *AAC, str(d / "landscape.mp4"))
    turned(d / "landscape.mp4", d / "rotated.mp4")
    out["rotated"] = Take(d / "rotated.mp4", (720, 1280), (540, 960), 30, True)

    ffmpeg(*picture("640x480", 30, 2), *H264, str(d / "silent.mp4"))
    out["silent"] = Take(d / "silent.mp4", (640, 480), (640, 480), 30, False)

    return out


@pytest.fixture
def stood_in(monkeypatch: pytest.MonkeyPatch) -> dict[str, list]:
    """`words`, `faces` and `text` stood in at their module (Silero, Whisper and the aligner need torch and the models; the
    faces need MediaPipe and its model; a reference's text needs RapidOCR and its models: all in the speech image, not
    here), saying what they were given: the words' as (sound, language, key, threads, reference), the text's as (the
    file as uploaded, ms), which gives an empty sample at each moment and writes a made-up sheet (`test_text.py` tests
    the stage itself)."""
    given = {"words": [], "faces": [], "text": []}

    def words(sound16k, language, key, *, threads=0, reference=False):
        given["words"].append((Path(sound16k), language, key, threads, reference))
        return nothing(language)

    def faces(preview):
        given["faces"].append(Path(preview))
        return [{"ms": ms, "face": None, "mouth": None} for ms in range(0, probe(preview)["videoMs"], 200)]

    def text(source, ms, out_dir):
        given["text"].append((Path(source), ms))
        (Path(out_dir) / "sheet.jpg").write_bytes(b"a made-up sheet")
        return {"text": [{"ms": moment, "lines": []} for moment in moments(ms)], "sheet": {"file": "sheet.jpg", "ms": moments(ms)[:12]}}

    monkeypatch.setattr("media.words.words", words)
    monkeypatch.setattr("media.faces.faces", faces)
    monkeypatch.setattr("media.text.text", text)
    return given


# Scribe, stood in on 127.0.0.1: a made-up answer, unless a test gives another. Its words are timed as a take's would be,
# with a comma and a sound event of their own and two words in one item, as Scribe answers.

ANSWER = {
    "language_code": "eng",
    "language_probability": 0.98,
    "text": "Morning friends, it is bright.",
    "words": [
        {"text": "Morning", "start": 0.6, "end": 0.9, "type": "word", "logprob": -0.1},
        {"text": " ", "start": 0.9, "end": 0.95, "type": "spacing", "logprob": 0},
        {"text": "friends", "start": 0.95, "end": 1.4, "type": "word", "logprob": -0.1},
        {"text": ",", "start": 1.4, "end": 1.4, "type": "word", "logprob": -0.1},
        {"text": " ", "start": 1.4, "end": 1.58, "type": "spacing", "logprob": 0},
        {"text": "(breath)", "start": 1.45, "end": 1.55, "type": "audio_event", "logprob": 0},
        {"text": "it is", "start": 1.58, "end": 1.9, "type": "word", "logprob": -0.1},
        {"text": " ", "start": 1.9, "end": 1.9, "type": "spacing", "logprob": 0},
        {"text": "bright.", "start": 1.9, "end": 2.1, "type": "word", "logprob": -0.1},
    ],
}


@pytest.fixture
def elevenlabs(monkeypatch: pytest.MonkeyPatch):
    """A server on 127.0.0.1 answering as Scribe does: `answer` with `status`; what it was sent is in `seen`."""
    stand_in = {"seen": {}, "status": 200, "answer": ANSWER}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = self.rfile.read(int(self.headers["Content-Length"]))
            stand_in["seen"].update(path=self.path, key=self.headers["xi-api-key"], type=self.headers["Content-Type"], body=body)
            refused = {"detail": {"message": "invalid api key"}}
            answer = json.dumps(stand_in["answer"] if stand_in["status"] == 200 else refused).encode()
            self.send_response(stand_in["status"])
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(answer)))
            self.end_headers()
            self.wfile.write(answer)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setattr(speech_module, "SCRIBE_URL", f"http://127.0.0.1:{server.server_port}/v1/speech-to-text")
    yield stand_in
    server.shutdown()
