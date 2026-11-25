"""render.mjs on this Mac's renderer, against the stills the repo's own script renders (scripts/edit-still.ts).

Most of it renders the owner's short demo edit (`.scratch/media/demo.json`, outside git), and is
skipped where that is not there; one test makes its own take. All of it is skipped where the repo's
node packages are not there (the worker's image). It bundles the film first (`scripts/edit-bundle.ts`,
about 6 s), so what is tested is the film as it is now. render.mjs draws with WebGL in software
(`swangle`), as on the worker; edit-still.ts draws with this Mac's GPU. About three minutes.
"""

import http.server
import json
import math
import os
import re
import subprocess
import tempfile
import threading
import time
from array import array
from pathlib import Path

import pytest

import store
from helpers import AAC, H264, ffmpeg, picture, streams, tone
from media.probe import probe, stored_ms
from media.refusal import Refusal
from media.transcode import transcode
from postgrest import Bucket, PostgREST
from render import script
from render.plan import slicing

REPO = Path(__file__).resolve().parents[2]
RENDER = REPO / "worker" / "render" / "render.mjs"
MEDIA = REPO / ".scratch" / "media"
DEMO = MEDIA / "demo.json"

pytestmark = pytest.mark.skipif(not (REPO / "node_modules").exists(), reason="the repo's node packages are not here")

# The limits, and what was measured on the demo on 2026-11-20 (fix round 1: five slices of 56 frames, BT.709).
# Software GL against this Mac's GPU, picture for picture: at most 0 % far apart and 0.61 levels (test 3
# had 0.017 % and 0.59 on the 90 s edit); a look left out is 2.5 levels or more.
STILL_FAR, STILL_LEVELS = 0.0005, 0.8
# A frame of the encoded film against a still, decoded exactly: at most 0.015 % and 1.34 levels, which is
# H.264's own. Far apart is test 4's limit: a title drawn one frame late is 0.5 % or more.
FILM_FAR, FILM_LEVELS = 0.004, 1.6
# The joined film's sound against the sound rendered in one piece, in dB under the signal: 33.2 over the
# film, 33.5 to 41.4 at its four joins (test 3: 34 between two AAC encodes). The same sound slipped by one
# AAC frame (21 ms) measures 3 dB over the signal.
SOUND_UNDER = -25


def render(*args: str, media: Path | None = MEDIA, gl: str | None = None, env: dict | None = None) -> subprocess.CompletedProcess:
    env = {**os.environ, **({"EDIT_MEDIA": str(media)} if media else {}), **({"EDIT_GL": gl} if gl else {}), **(env or {})}
    return subprocess.run(["node", str(RENDER), *args], capture_output=True, text=True, env=env)


def ok(*args: str, media: Path = MEDIA) -> list[dict]:
    """Runs render.mjs, which must succeed, and gives the JSON lines it printed."""
    done = render(*args, media=media)
    assert done.returncode == 0, done.stderr
    return [json.loads(line) for line in done.stdout.splitlines() if line.startswith("{")]


def apart(a: Path, b: Path) -> dict:
    done = subprocess.run(["node", str(Path(__file__).with_name("apart.mjs")), str(a), str(b)], capture_output=True, text=True, check=True)
    return json.loads(done.stdout)


def props_file(folder: Path, urls: dict | None = None, edit: dict | None = None) -> Path:
    demo = json.loads(DEMO.read_text())
    path = folder / "props.json"
    path.write_text(json.dumps({"edit": edit or demo["edit"], "urls": demo["files"] if urls is None else urls}))
    return path


def mac_stills(demo: Path, folder: Path, frames: list[int]) -> int:
    """This Mac's stills of a demo by the repo's own script; gives the film's length."""
    done = subprocess.run(["pnpm", "exec", "tsx", "scripts/edit-still.ts", str(demo), str(folder), *map(str, frames)],
                          cwd=REPO, check=True, capture_output=True, text=True)
    return int(done.stdout.split(" of ")[-1].rstrip(")\n"))


# ffmpeg's own conversion to RGB is its fast one; with full colour detail and exact rounding it draws a
# frame as Chrome and Safari do (1.1 to 1.2 levels from the stills where the fast one gave 2.2 to 2.4).
EXACT = "scale=flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=rgb24"


def film_frames(film_path: Path, folder: Path, frames: list[int]) -> None:
    """Frames of a rendered film as pictures, frame-NNNN.png, decoded as the file says it is coloured."""
    folder.mkdir(exist_ok=True)
    for frame in frames:
        ffmpeg("-i", str(film_path), "-vf", rf"select=eq(n\,{frame}),{EXACT}", "-frames:v", "1", str(still(folder, frame)))


def draw_and_join(props: Path, work: Path, frames: int, browsers: int, media: Path = MEDIA) -> tuple[list[dict], Path]:
    """The film in slices as plan.py cuts it, then joined: what `slices` said, and the joined film."""
    per, count = slicing(frames)
    parts = work / "parts"
    said = ok("slices", str(props), str(parts), str(frames), str(per), "0", str(count - 1), str(browsers), media=media)
    joined = work / "film.mp4"
    ok("join", str(parts), str(joined), "30", str(frames), str(per), media=media)
    return said, joined


@pytest.fixture(scope="module")
def bundled() -> None:
    """The film bundled as it is now, once for the module."""
    subprocess.run(["pnpm", "exec", "tsx", "scripts/edit-bundle.ts"], cwd=REPO, check=True, capture_output=True)


@pytest.fixture(scope="module")
def film(bundled, tmp_path_factory) -> dict:
    """The demo's props, its length, and this Mac's stills of the frames the tests look at."""
    if not DEMO.exists():
        pytest.skip("the owner's demo edit is not in .scratch/media")
    work = tmp_path_factory.mktemp("render")
    props = props_file(work)
    [size] = ok("size", str(props))
    frames = size["frames"]
    per, count = slicing(frames)
    assert count >= 3, "the demo is too short to have two joins"
    joins = [x for i in (1, 2) for x in (i * per - 1, i * per)]
    chosen = [0, 45, 150, 200, frames - 1]
    mac = work / "mac"
    length = mac_stills(DEMO, mac, joins + chosen)
    one_piece = work / "one-piece.wav"
    subprocess.run(["pnpm", "exec", "tsx", "scripts/edit-film.ts", str(DEMO), str(one_piece)], cwd=REPO, check=True, capture_output=True)
    return {"props": props, "work": work, "size": size, "length": length, "per": per, "count": count, "joins": joins, "chosen": chosen,
            "mac": mac, "one_piece": one_piece}


def still(folder: Path, frame: int) -> Path:
    return folder / f"frame-{frame:04d}.png"


def pcm(path: Path) -> array:
    """A file's sound as 16-bit samples, two channels at 48 kHz."""
    done = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(path), "-map", "0:a:0", "-f", "s16le", "-ac", "2", "-ar", "48000", "-"],
                          capture_output=True, check=True)
    return array("h", done.stdout)


def under(a: array, b: array, start: float, end: float) -> float:
    """How far `b` is from `a` between two moments, in dB under `a`'s own level."""
    lo, hi = (round(s * 48000) * 2 for s in (start, end))
    signal = sum(x * x for x in a[lo:hi])
    apart = sum((x - y) ** 2 for x, y in zip(a[lo:hi], b[lo:hi]))
    return 10 * math.log10(apart / signal)


class Elsewhere(http.server.BaseHTTPRequestHandler):
    """A host like the bucket, as a render's browsers met it: on another origin, it answers byte ranges, and no browser.
    The bucket answers a browser only from the origins its CORS lists (localhost:3000 to 3005), and the engine gives each
    browser of a render a server, and so an origin, of its own: localhost:3000, 3001 and on (Modal, 2026-11-20).
    Under /cut/ it declares a file's whole length, sends half of it and closes; under /stall/ it sends nothing after its
    headers for 10 s."""

    folder = MEDIA

    def do_GET(self) -> None:  # noqa: N802
        asked = self.path.lstrip("/").split("?")[0]
        how, _, name = asked.partition("/") if asked.split("/")[0] in ("cut", "stall") else ("", "", asked)
        path = self.folder / name
        if how in ("cut", "stall") and path.is_file():
            self.send_response(200)
            self.send_header("Content-Length", str(path.stat().st_size))
            self.end_headers()
            if how == "stall":
                time.sleep(10)
            else:
                self.wfile.write(path.read_bytes()[:path.stat().st_size // 2])
            self.close_connection = True
            return
        if how or not path.is_file():
            self.send_error(404)
            return
        data = path.read_bytes()
        asked = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        start, end = 0, len(data) - 1
        if asked:
            start = int(asked[1]) if asked[1] else len(data) - int(asked[2])
            end = min(end, int(asked[2])) if asked[1] and asked[2] else end
        self.send_response(206 if asked else 200)
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        if asked:
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
        self.end_headers()
        try:
            self.wfile.write(data[start:end + 1])
        except (BrokenPipeError, ConnectionResetError):  # a reader that stopped reading
            pass

    def log_message(self, *args) -> None:
        pass


@pytest.fixture
def bucket():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Elsewhere)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()


def test_files_on_another_host_are_drawn_from_this_machine(film, bucket, tmp_path):
    """Every file of the edit that is not on this machine is fetched by the renderer itself, once, and its browsers read it
    from here: a still and slices drawn by two browsers keep the look whatever the host answers a browser. Before, the
    seventh and eighth browsers of each render container read the take from the bucket, were refused, and drew without
    the look (8 of 32 slices of the 90 s film)."""
    demo = json.loads(DEMO.read_text())
    props = props_file(tmp_path, {id: f"{bucket}/{name}" for id, name in demo["files"].items()})
    per = film["per"]
    ok("stills", str(props), str(tmp_path / "stills"), "45", media=None)
    far = apart(still(tmp_path / "stills", 45), still(film["mac"], 45))
    assert far["farApart"] <= STILL_FAR and far["levels"] <= STILL_LEVELS, far
    parts = tmp_path / "parts"
    ok("slices", str(props), str(parts), str(film["length"]), str(per), "0", "1", "2", media=None)
    for part, index, frame in (("v000.ts", 45, 45), ("v001.ts", per - 1, 2 * per - 1)):
        film_frames(parts / part, tmp_path / part, [index])
        far = apart(still(tmp_path / part, index), still(film["mac"], frame))
        assert far["farApart"] <= FILM_FAR and far["levels"] <= FILM_LEVELS, (part, far)
    # A file the host does not have fails before anything is drawn, by its id.
    gone = tmp_path / "gone"
    gone.mkdir()
    done = render("stills", str(props_file(gone, {id: f"{bucket}/gone-{name}" for id, name in demo["files"].items()})), str(gone / "out"), "45", media=None)
    assert done.returncode != 0
    assert re.search(r'EDIT_ERROR: the file "(take|tick)" cannot be read \(404 Not Found\)', done.stderr), done.stderr


def test_a_file_cut_short_or_too_slow_fails_by_its_id(film, bucket, tmp_path):
    """A file of another host that arrives cut short (its length declared, half of it sent), or whose fetch takes longer
    than its bound (EDIT_FETCH_SECONDS, 300 s on the worker), fails before anything is drawn, by its id."""
    demo = json.loads(DEMO.read_text())
    for how, env, said in (("cut", {}, r"[A-Z_]+"), ("stall", {"EDIT_FETCH_SECONDS": "2"}, r"timed out")):
        folder = tmp_path / how
        folder.mkdir()
        props = props_file(folder, {id: f"{bucket}/{how}/{name}" for id, name in demo["files"].items()})
        started = time.monotonic()
        done = render("stills", str(props), str(folder / "out"), "45", media=None, env=env)
        assert done.returncode != 0, done.stderr
        assert re.search(r'EDIT_ERROR: the file "(take|tick)" cannot be read \(' + said + r"\)$", done.stderr.strip()), done.stderr
        assert not (folder / "out").exists() or not any((folder / "out").iterdir())
        if how == "stall":
            assert time.monotonic() - started < 9, "the fetch was not stopped at its bound"


def test_size_is_the_film_s_length_and_rate(film):
    assert film["size"] == {"frames": film["length"], "fps": 30}


def test_stills_are_the_frames_this_mac_renders(film):
    out = film["work"] / "stills"
    frames = film["joins"] + film["chosen"]
    ok("stills", str(film["props"]), str(out), *map(str, frames))
    for frame in frames:
        far = apart(still(out, frame), still(film["mac"], frame))
        assert far["farApart"] <= STILL_FAR and far["levels"] <= STILL_LEVELS, (frame, far)


def test_slices_joined_are_the_film(film):
    """Five slices by three browsers, so two of them draw two; then the join; then its frames against this Mac's."""
    said, joined = draw_and_join(film["props"], film["work"], film["length"], 3)
    count = film["count"]
    assert sum(line["frames"] for line in said if "frames" in line) == film["length"]
    assert sorted(line["slice"] for line in said if "slice" in line) == list(range(count))
    parts = film["work"] / "parts"
    assert sorted(p.name for p in parts.iterdir()) == sorted([f"v{i:03d}.ts" for i in range(count)] + [f"a{i:03d}.aac" for i in range(count)])

    [v] = streams(joined, "video")
    [a] = streams(joined, "audio")
    assert (v["codec_name"], v["width"], v["height"], v["r_frame_rate"], int(v["nb_frames"])) == ("h264", 1080, 1920, "30/1", film["length"])
    # Encoded as BT.709 (the posted file's transfer is renamed by finish.level).
    assert (v["color_space"], v["color_primaries"]) == ("bt709", "bt709")
    assert (a["codec_name"], a["sample_rate"], float(a["start_time"])) == ("aac", "48000", 0)

    # The sound is the one-piece sound, at the joins too.
    one, joined_sound = pcm(film["one_piece"]), pcm(joined)
    seconds = film["length"] / 30
    assert under(one, joined_sound, 0, seconds) <= SOUND_UNDER
    for join in (i * film["per"] / 30 for i in range(1, count)):
        assert under(one, joined_sound, join - 0.05, join + 0.05) <= SOUND_UNDER, join
    # It runs to the end of the film; the engine ends it on a whole AAC frame (1024 samples), a little past.
    assert seconds <= float(a["duration"]) <= seconds + 3 * 1024 / 48000

    frames = film["work"] / "film-frames"
    film_frames(joined, frames, film["joins"] + film["chosen"])
    for frame in film["joins"] + film["chosen"]:
        far = apart(still(frames, frame), still(film["mac"], frame))
        assert far["farApart"] <= FILM_FAR and far["levels"] <= FILM_LEVELS, (frame, far)


def test_a_film_shorter_than_one_slice_is_one_slice(film, tmp_path):
    """The demo's first shot alone, 1.7 s: one slice into the join, as a short film is."""
    edit = json.loads(DEMO.read_text())["edit"]
    edit["shots"] = edit["shots"][:1]
    props = props_file(tmp_path, edit=edit)
    [size] = ok("size", str(props))
    assert slicing(size["frames"]).count == 1
    said, joined = draw_and_join(props, tmp_path, size["frames"], 1)
    assert [line["slice"] for line in said if "slice" in line] == [0]
    [v] = streams(joined, "video")
    [a] = streams(joined, "audio")
    assert int(v["nb_frames"]) == size["frames"]
    assert size["frames"] / 30 <= float(a["duration"]) <= size["frames"] / 30 + 3 * 1024 / 48000
    demo = tmp_path / "short.json"
    demo.write_text(json.dumps({"edit": edit, "files": json.loads(DEMO.read_text())["files"]}))
    middle = size["frames"] // 2
    mac_stills(demo, tmp_path / "mac", [middle])
    film_frames(joined, tmp_path / "frames", [middle])
    far = apart(still(tmp_path / "frames", middle), still(tmp_path / "mac", middle))
    assert far["farApart"] <= FILM_FAR and far["levels"] <= FILM_LEVELS, far


def test_slices_of_a_film_of_another_length_are_refused(film, tmp_path):
    """Each container sizes the film again; one that comes to another length draws nothing."""
    frames = film["length"] + 1
    per, _ = slicing(frames)
    done = render("slices", str(film["props"]), str(tmp_path / "parts"), str(frames), str(per), "0", "0", "1")
    assert done.returncode != 0
    assert f"{film['length']} frames long; it was sized at {frames}" in done.stderr, done.stderr
    assert not (tmp_path / "parts").exists() or not any((tmp_path / "parts").iterdir())


def test_without_webgl_nothing_is_drawn(film, tmp_path):
    """A browser with no WebGL 2 cannot run the colour pass, and a film without its look is never posted:
    a still and a slice both fail, and leave nothing behind."""
    for args, out in ((["stills", str(film["props"]), str(tmp_path / "out"), "45"], tmp_path / "out"),
                      (["slices", str(film["props"]), str(tmp_path / "parts"), str(film["length"]), str(film["per"]), "0", "0", "1"],
                       tmp_path / "parts")):
        done = render(*args, gl="egl")
        assert done.returncode != 0
        assert "Failed to acquire WebGL2 context for effects" in done.stderr, done.stderr
        assert script.MARK not in done.stderr, done.stderr  # the engine's failure, not the creator's to read (I1)
        assert not out.exists() or not any(out.iterdir())


def test_a_missing_file_fails_with_its_id(film, tmp_path):
    props = props_file(tmp_path, {"take": "nope.mp4", "tick": "tick.wav"})
    for args in (["size", str(props)], ["stills", str(props), str(tmp_path / "out"), "0"],
                 ["slices", str(props), str(tmp_path / "parts"), str(film["length"]), str(film["per"]), "0", "0", "1"]):
        done = render(*args)
        assert done.returncode != 0
        assert 'the file "take" cannot be read' in done.stderr, done.stderr
        # The whole error first, for the log; last the message alone, marked, for a job's row (I2).
        assert done.stderr.splitlines()[-1].startswith('EDIT_ERROR: the file "take" cannot be read'), done.stderr
        assert script.message(done.stderr) == done.stderr.splitlines()[-1].removeprefix(script.MARK)


@pytest.mark.parametrize(("said", "kind", "message"), [
    ("Error: x\n    at y (file:///edit/render.mjs:1:1)\nEDIT_ERROR: the file \"take\" cannot be read (403 Forbidden)\n", Refusal,
     'the film: the file "take" cannot be read (403 Forbidden)'),
    ("TypeError: Cannot read properties of undefined\n    at y (file:///edit/render.mjs:1:1)\n", RuntimeError,
     "the film: TypeError: Cannot read properties of undefined"),
], ids=["marked", "not marked"])
def test_render_mjs_s_marked_line_is_raised_as_the_worker_s_own_words_and_nothing_else_is(tmp_path, said, kind, message):
    """M2: what render.mjs marked (EDIT_ERROR) is the worker's to say, a Refusal; a failure it did not mark is not."""
    failing = tmp_path / "failing.mjs"
    failing.write_text(f"process.stderr.write({json.dumps(said)}); process.exit(1);\n")
    with pytest.raises(RuntimeError if kind is RuntimeError else Refusal, match=f"^{re.escape(message)}$") as raised:
        script.run(failing, about="the film")
    assert (type(raised.value) is RuntimeError) is (kind is RuntimeError)


def test_a_marked_line_run_without_an_about_is_the_message_alone(tmp_path):
    """The stills route (part 3, Task 6) answers render.mjs's own words as they are, with nothing put before them."""
    said = "Error: x\nEDIT_ERROR: frame 300 is past the film's end: it has 280 frames\n"
    failing = tmp_path / "failing.mjs"
    failing.write_text(f"process.stderr.write({json.dumps(said)}); process.exit(1);\n")
    with pytest.raises(Refusal, match=r"^frame 300 is past the film's end: it has 280 frames$"):
        script.run(failing, about=None)


def test_a_failed_render_puts_its_message_line_in_the_job_s_row_and_no_trace(film, tmp_path):
    """I2, with the real render.mjs: a render job whose take cannot be fetched (its signed address is on a host that
    does not resolve) fails with the message alone, no stack and no folder, and the log has the rest."""
    supabase = PostgREST("key")
    try:
        user, job = "00000000-0000-4000-8000-00000000000a", "20000000-0000-4000-8000-00000000000a"
        edit = json.loads(DEMO.read_text())["edit"]
        for asset in edit["assets"]:
            asset["at"] = {"bucket": "edit-media", "path": f"u/{user}/takes/{asset['id']}/full.mp4"}
        supabase.put("edit_jobs", {"id": job, "user_id": user, "kind": "render", "take_id": None, "input": {"edit": edit}, "status": "queued"})

        def render_by_node(props, cover, on_progress, out):
            out.mkdir(parents=True, exist_ok=True)
            (out / "props.json").write_text(json.dumps(props))
            on_progress("sizing", 0.0)
            return script.run(RENDER, "size", str(out / "props.json"), about="the film")

        store.render_job(job, rows=store.Rows(supabase.url, "key"), r2=Bucket(tmp_path), call="fc-1", render=render_by_node, work=tmp_path / "work")
        row = supabase.row("edit_jobs", job)
    finally:
        supabase.close()
    assert row["status"] == "failed" and row["stage"] == "sizing"
    assert re.fullmatch(r'the film: the file "(take|tick)" cannot be read \((ENOTFOUND|EAI_AGAIN)\)', row["error"]), row["error"]
    assert "\n" not in row["error"] and " at " not in row["error"] and str(tmp_path) not in row["error"]


def test_a_file_named_without_a_folder_of_development_files_fails_with_its_id(film):
    done = render("size", str(film["props"]), media=None)
    assert done.returncode != 0
    assert '"take"' in done.stderr and "EDIT_MEDIA" in done.stderr, done.stderr


def test_slices_outside_the_film_are_refused(film, tmp_path):
    count = film["count"]
    done = render("slices", str(film["props"]), str(tmp_path / "parts"), str(film["length"]), str(film["per"]), "0", str(count), "1")
    assert done.returncode != 0
    assert f"slices 0 to {count - 1}" in done.stderr, done.stderr


def test_a_join_with_a_slice_missing_fails_naming_it(film, tmp_path):
    """Slice 0 is there (the join looks for every file before it reads any), slice 1 is not."""
    parts = tmp_path / "parts"
    parts.mkdir()
    (parts / "v000.ts").touch()
    (parts / "a000.aac").touch()
    done = render("join", str(parts), str(tmp_path / "film.mp4"), "30", str(film["length"]), str(film["per"]))
    assert done.returncode != 0
    assert "slice 1" in done.stderr, done.stderr


def whole_take(ms: int) -> dict:
    """An edit of one take of the stage's size, all of it, shown as it is: no look, no captions, nothing on it."""
    return {
        "v": 1, "kit": "1", "stage": {"w": 1080, "h": 1920, "fps": 30},
        "assets": [{"id": "take", "origin": "filmed", "at": {"bucket": "edit-media", "path": "dev/full.mp4"}, "kind": "video",
                    "ms": ms, "w": 1080, "h": 1920, "sound": True, "words": []}],
        "shots": [{"id": "s1", "asset": "take", "startMs": 0, "endMs": ms, "speed": 1, "volume": 1,
                   "framing": {"from": {"zoom": 1, "x": 0, "y": 0}, "move": None}, "look": None, "out": {"kind": "cut"}, "marks": []}],
        "items": [],
        "captions": {"on": False, "look": "pill", "font": "tiktok", "size": 72, "y": 0.8, "width": 0.86, "maxWords": 3, "highlight": None},
        "look": {"preset": "natural", "adjust": dict.fromkeys(["exposure", "warmth", "tint", "shadows", "highlights", "contrast", "saturation", "vibrance"], 0)},
        "cover": None,
    }


def test_stills_past_the_film_s_end_are_refused_before_any_is_drawn(bundled, tmp_path):
    """The worker cannot lay an edit out (X63), so render.mjs, which sizes the film, holds the frames asked to it: a frame at
    or past the end fails the whole call, naming the frame and the film's length, and nothing is drawn, not even the
    frames before it."""
    media = tmp_path / "media"
    media.mkdir()
    ffmpeg(*picture("1080x1920", 30, 2), *tone(2), *H264, *AAC, str(media / "take.mp4"))
    props = tmp_path / "props.json"
    props.write_text(json.dumps({"edit": whole_take(2000), "urls": {"take": "take.mp4"}}))
    out = tmp_path / "out"
    done = render("stills", str(props), str(out), "0", "59", "60", media=media)
    assert done.returncode != 0, done.stderr
    assert done.stderr.splitlines()[-1] == "EDIT_ERROR: frame 60 is past the film's end: it has 60 frames", done.stderr
    assert not out.exists() or not any(out.iterdir())
    ok("stills", str(props), str(out), "0", "59", media=media)  # the last frame is in the film
    assert sorted(path.name for path in out.iterdir()) == ["frame-0000.png", "frame-0059.png"]


LOOK_LOST = 'the look cannot be drawn on the file "take": the browser cannot read it itself'


@pytest.fixture
def unreadable(tmp_path) -> Path:
    """A folder with a 2 s take that only the engine's fall-back reads: MPEG-4 Part 2, which this Mac's browser does not
    decode itself."""
    media = tmp_path / "media"
    media.mkdir()
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=2", *tone(2), "-c:v", "mpeg4", "-q:v", "3", *AAC,
           str(media / "take.mp4"))
    return media


def test_a_clip_the_browser_cannot_read_itself_is_never_drawn_without_its_look(bundled, unreadable, tmp_path):
    """Design §13: what is posted is never a stand-in. A clip the browser cannot read itself (here a take in a codec it does
    not decode; on Modal, a read that failed in some browsers) the engine draws by a fall-back with no colour pass, without a
    word. Where the clip has a look, a slice and a still fail instead, naming the slice and the clip, and leave nothing
    behind. The same clip with no look is drawn, and drawn right: no colour pass is asked of it."""
    edit = whole_take(2000)
    edit["look"]["preset"] = "warm"
    props = tmp_path / "props.json"
    props.write_text(json.dumps({"edit": edit, "urls": {"take": "take.mp4"}}))
    parts = tmp_path / "parts"
    done = render("slices", str(props), str(parts), "60", "30", "0", "1", "2", media=unreadable)
    assert done.returncode != 0, done.stderr
    assert re.search(r"EDIT_ERROR: slice [01] \(frames (0 to 29|30 to 59)\): " + re.escape(LOOK_LOST), done.stderr), done.stderr
    assert not parts.exists() or not any(parts.iterdir())
    done = render("stills", str(props), str(tmp_path / "out"), "30", media=unreadable)
    assert done.returncode != 0, done.stderr
    assert f"EDIT_ERROR: {LOOK_LOST}" in done.stderr, done.stderr
    assert not (tmp_path / "out").exists() or not any((tmp_path / "out").iterdir())
    # With no look, nothing is lost by the fall-back: its frame is the take's own. The fall-back reads the file through the
    # renderer's ffmpeg, which takes this untagged file's colours as BT.709 (measured: the same pixels, 0 levels apart).
    edit["look"]["preset"] = "natural"
    props.write_text(json.dumps({"edit": edit, "urls": {"take": "take.mp4"}}))
    ok("stills", str(props), str(tmp_path / "plain"), "30", media=unreadable)
    (tmp_path / "take").mkdir()
    ffmpeg("-i", str(unreadable / "take.mp4"), "-vf", r"select=eq(n\,30),scale=in_color_matrix=bt709,format=rgb24", "-frames:v", "1",
           str(still(tmp_path / "take", 30)))
    far = apart(still(tmp_path / "plain", 30), still(tmp_path / "take", 30))
    assert far["farApart"] <= STILL_FAR and far["levels"] <= STILL_LEVELS, far


def test_a_run_whose_look_comes_on_a_later_shot_is_never_drawn_without_it(bundled, unreadable, tmp_path):
    """The engine falls back once for a whole run, which is one piece of media across its shots. A run that opens on a
    shot with no look and goes on to one with a look fails too, though the frames each page draws first have no look.
    Before, the film asked the frame's own shot: the first frames fell back without a word, and the second shot was
    drawn by the fall-back, without its look."""
    edit = whole_take(2000)
    [first] = edit["shots"]
    first["endMs"] = 1000
    edit["shots"].append({**first, "id": "s2", "startMs": 1000, "endMs": 2000,
                          "look": {"preset": "warm", "adjust": dict.fromkeys(edit["look"]["adjust"], 0)}})
    props = tmp_path / "props.json"
    props.write_text(json.dumps({"edit": edit, "urls": {"take": "take.mp4"}}))
    parts = tmp_path / "parts"
    done = render("slices", str(props), str(parts), "60", "60", "0", "0", "1", media=unreadable)
    assert done.returncode != 0, done.stderr
    assert f"EDIT_ERROR: slice 0 (frames 0 to 59): {LOOK_LOST}" in done.stderr, done.stderr
    assert not parts.exists() or not any(parts.iterdir())


def test_a_take_whose_sound_ends_early_is_drawn_to_its_end_and_silent_after(bundled, tmp_path):
    """X45 gives a take whose sound ends more than a frame before its picture the picture's length: a film
    of all of it must draw the picture to its end, and be silent where the take's sound has ended."""
    # 3 s of picture growing from black to white a frame at a time, so each frame is its own; 2 s of sound.
    source = tmp_path / "early.mp4"
    ffmpeg("-f", "lavfi", "-i", "color=white:size=1080x1920:rate=30:duration=3,fade=t=in:s=0:n=90", *tone(2), *H264, *AAC, str(source))
    media = tmp_path / "media"
    made = transcode(source, probe(source), media)
    ms = stored_ms(probe(made["full"]), probe(made["preview"]))
    assert ms == 3000
    props = tmp_path / "props.json"
    props.write_text(json.dumps({"edit": whole_take(ms), "urls": {"take": "full.mp4"}}))

    [size] = ok("size", str(props), media=media)
    _, joined = draw_and_join(props, tmp_path, size["frames"], 2, media=media)

    # The film runs to the picture's end, its sound too.
    [v] = streams(joined, "video")
    [a] = streams(joined, "audio")
    assert size["frames"] == int(v["nb_frames"]) == 90
    assert 3 <= float(a["duration"]) <= 3 + 3 * 1024 / 48000
    # Its frames after the sound's end (frame 59 is its last with sound) are the take's own, not the last one held.
    frames = [59, 70, 89]
    film_frames(joined, tmp_path / "film", frames)
    film_frames(made["full"], tmp_path / "take", frames)
    for frame in frames:
        far = apart(still(tmp_path / "film", frame), still(tmp_path / "take", frame))
        assert far["farApart"] <= FILM_FAR and far["levels"] <= FILM_LEVELS, (frame, far)
    for frame in (70, 89):
        assert apart(still(tmp_path / "film", frame), still(tmp_path / "take", 59))["levels"] > 20, frame
    # Sound while the take has it, silence after.
    sound = pcm(joined)
    assert max(abs(x) for x in sound[round(0.1 * 48000) * 2: round(1.9 * 48000) * 2]) > 1000
    assert max(abs(x) for x in sound[round(2.1 * 48000) * 2: round(2.95 * 48000) * 2]) == 0


# Fix round 1 of part 3's Task 6 (I1): render.mjs marks only what it or the film words for the creator; the engine's own
# failures go unmarked, and the worker tells them as its own.
USER_ID, TAKE_ID, JOB_ID = "00000000-0000-4000-8000-00000000000a", "10000000-0000-4000-8000-00000000000a", "20000000-0000-4000-8000-00000000000a"


@pytest.fixture
def warm(tmp_path) -> tuple[Path, dict]:
    """A 2 s take this Mac's browser reads itself, and an edit of all of it with a look (`warm`), whose colour pass needs WebGL 2;
    the take kept, for the worker's checks, as one of a creator's takes."""
    media = tmp_path / "warm"
    media.mkdir()
    ffmpeg(*picture("1080x1920", 30, 2), *tone(2), *H264, *AAC, str(media / "take.mp4"))
    edit = whole_take(2000)
    edit["look"]["preset"] = "warm"
    edit["assets"][0]["at"] = {"bucket": "edit-media", "path": store.take_key(USER_ID, TAKE_ID, "full.mp4")}
    return media, edit


def drawn_here(media: Path, work: Path, gl: str | None = None, command: str = "stills", about: str | None = None):
    """A drawing by render.mjs on this Mac, from the take in `media` by its name: the signed addresses the worker makes are of a
    stand-in bucket, which no fetch reaches. `stills` gives the PNGs; `slices` draws the film's one slice."""
    def draw(props: dict, frames: list[int]) -> list[bytes]:
        folder = Path(tempfile.mkdtemp(dir=work))
        (folder / "props.json").write_text(json.dumps({"edit": props["edit"], "urls": {"take": "take.mp4"}}))
        args = [str(folder / "out"), *map(str, frames)] if command == "stills" else [str(folder / "parts"), "60", "60", "0", "0", "1"]
        script.run(RENDER, command, str(folder / "props.json"), *args, about=about,
                   env={**os.environ, "EDIT_MEDIA": str(media), **({"EDIT_GL": gl} if gl else {})})
        return [(folder / "out" / f"frame-{frame:04d}.png").read_bytes() for frame in frames]
    return draw


def test_an_engine_failure_is_not_marked_and_is_raised_as_no_words_of_the_worker_s(bundled, warm, tmp_path):
    """A browser with no WebGL 2 cannot run the look: the engine fails, in words that name the browsers' own address."""
    media, edit = warm
    props = tmp_path / "props.json"
    props.write_text(json.dumps({"edit": edit, "urls": {"take": "take.mp4"}}))
    done = render("stills", str(props), str(tmp_path / "out"), "0", media=media, gl="egl")
    assert done.returncode != 0 and "Failed to acquire WebGL2 context for effects" in done.stderr, done.stderr
    assert script.MARK not in done.stderr and "http://localhost:" in done.stderr, done.stderr
    with pytest.raises(RuntimeError) as raised:
        drawn_here(media, tmp_path, "egl")({"edit": edit}, [0])
    assert type(raised.value) is RuntimeError  # not a Refusal


@pytest.mark.parametrize(("gl", "frames", "status", "error"), [
    ("egl", [0], 500, "the stills failed on our side; try again"),
    (None, [0, 60], 422, "frame 60 is past the film's end: it has 60 frames"),
    (None, [0, 59], 200, None),
], ids=["an engine failure", "a frame past the end", "drawn"])
def test_the_stills_answer_render_mjs_s_own_words_and_its_engine_s_failures_as_ours(bundled, warm, tmp_path, capsys, gl, frames, status, error):
    """The stills route's work with the real render.mjs: its marked line answered as it is, the engine's failure as ours, its
    words (and the browsers' address) in the log only."""
    media, edit = warm
    body = json.dumps({"user": USER_ID, "edit": edit, "frames": frames}).encode()
    answered, answer = store.stills_request(body, "Bearer s", secret="s", r2=Bucket(tmp_path), draw=drawn_here(media, tmp_path, gl),
                                            work=tmp_path / "work")
    assert answered == status and answer.get("error") == error, answer
    if status == 200:
        assert [still["frame"] for still in answer["stills"]] == frames
    if gl == "egl":
        assert "localhost" not in json.dumps(answer) and "Failed to acquire WebGL2 context" in "".join(capsys.readouterr())


def render_job_by_node(edit: dict, draw, tmp_path: Path) -> dict:
    """A render job of `edit`, its drawing `draw` (render.mjs on this Mac), against the rows' stand-in: its row at the end."""
    supabase = PostgREST("key")
    try:
        supabase.put("edit_jobs", {"id": JOB_ID, "user_id": USER_ID, "kind": "render", "take_id": None, "input": {"edit": edit}, "status": "queued"})

        def drawing(props, cover, on_progress, out):
            on_progress("drawing", 0.1)
            draw(props, [0])

        store.render_job(JOB_ID, rows=store.Rows(supabase.url, "key"), r2=Bucket(tmp_path), call="fc-1", render=drawing, work=tmp_path / "work")
        return supabase.row("edit_jobs", JOB_ID)
    finally:
        supabase.close()


def test_a_render_job_the_engine_failed_says_it_failed_on_our_side(bundled, warm, tmp_path):
    media, edit = warm
    row = render_job_by_node(edit, drawn_here(media, tmp_path, "egl", "slices", "slices 0 to 0"), tmp_path)
    assert (row["status"], row["error"]) == ("failed", "the render failed on our side; try again")


def test_a_render_job_still_puts_its_own_lines_in_its_row(bundled, unreadable, tmp_path):
    """X73's look line, from the film through the engine, still marked, with the slice that names itself; and a file that cannot
    be read (test_a_failed_render_puts_its_message_line_in_the_job_s_row_and_no_trace has it from `size` too)."""
    edit = whole_take(2000)
    edit["look"]["preset"] = "warm"
    edit["assets"][0]["at"] = {"bucket": "edit-media", "path": store.take_key(USER_ID, TAKE_ID, "full.mp4")}
    row = render_job_by_node(edit, drawn_here(unreadable, tmp_path, command="slices", about="slices 0 to 0"), tmp_path)
    assert row["status"] == "failed"
    assert row["error"].startswith(f"slices 0 to 0: slice 0 (frames 0 to 59): {LOOK_LOST} ("), row["error"]
    row = render_job_by_node(edit, drawn_here(tmp_path / "nowhere", tmp_path, command="stills", about="stills"), tmp_path)
    assert row["error"] == 'stills: the file "take" cannot be read (404 Not Found)', row["error"]
