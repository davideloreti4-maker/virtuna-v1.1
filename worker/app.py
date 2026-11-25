"""The worker on Modal: its images and the product's functions, deployed as the app `maven-edit-worker`.
This file and dev.py are the only ones that know about Modal; the work itself is plain Python
(`media/`, `render/`, `store.py`).

The web address (X41): `POST /start {"job": <id>}` and `POST /stills` (part 3, Task 6), each with `Authorization: Bearer
<EDIT_WORKER_SECRET>`, behind Modal's proxy auth (X81: the workspace's proxy token in `Modal-Key` and `Modal-Secret`; a call
without it is refused by Modal before any container starts). `web` is light (a quarter of a core, no boto3, no ffmpeg) and
checks the secret before it reads a body. For `/start` the app writes a job's row, then calls it; `web` reads the job's kind
from the row and spawns `analyse` or `render` for it (`store.start`). Both then work from the row alone, by its id:
- `analyse(job)`: the take's source fetched from R2 and held to its upload's size, analysed by
  `media/analyse.py` (copies, words, faces, cuts, picture, loudness; Task 5, and part 3's Task 8) in the speech image,
  a reference in reference mode when the job's input says so (X98), its text read too (X101, Task 9b), its copies stored in R2 and the analysis written
  into the take's row (`store.analyse_job`);
- `render(job)`: the job's edit rendered with every take signed for two hours (`store.render_job`)
  by the render pipeline below: the film sized, cut into slices spread over render containers as
  `render/plan.py` says (a browser to a slice, eight to a 16-core container, at most four
  containers), the slices joined, the sound levelled while the cover is drawn (X49, X50), and the
  film and its cover stored in R2. One failed slice fails the render at once (`plan.collect`), and so do
  slices still out when the render nears its own timeout ("the render machines are busy", X82).
- `/stills {"user", "edit", "frames", "sheet"?}`: `web` sends the body to `stills_answer` in the render image, which signs the
  edit's files as a render job's are, draws the frames with one browser and gives them back as JPEGs (`store.stills_request`);
  it answers the app at once, with no row. `stills` draws a film's frames as PNGs from props as they are (the development
  app's demos). Both are kept warm for five minutes after use.
What may run at once is bounded (X81): four analyses, two renders (each with up to four slice containers,
four in all), two stills calls, and one live job of each kind per creator (the app's routes).
Every drawing runs `worker/render/render.mjs` in the render image: Node 22, the engine's renderer and its
Chrome, and the film bundled by `scripts/edit-bundle.ts`.

Deploy from the worktree root, after `pnpm exec tsx scripts/edit-bundle.ts`:
  modal deploy worker/app.py
It ships these functions only. The tests in the image and the demos are dev.py's app.

No product function mounts the Volume `edit-dev-media` (M1): the product's edits name their files by signed
https addresses only. The development app mounts it where its demos name a file by its name (dev.py).
"""

import functools
import json
import queue
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import TypedDict

import modal

from media import models
from render import finish, plan, script

app = modal.App("maven-edit-worker")

RENDER_MJS = "/edit/render.mjs"
DEV_MEDIA = "/dev-media"
# Where the 90 s film's render went on 2026-11-20 (slices of 120 frames): sizing it and starting the
# containers 10 % of its time, drawing 56 %, sending the slices back and joining 8 %, then levelling
# and the cover. Its progress follows that, until a run with the slices of plan.py measures them.
SIZED, DRAWN, JOINED = 0.1, 0.75, 0.82
RENDER_S = 900  # the render function's timeout
# What a render needs after its slices are back (joining, levelling, the cover, storing) and to write a failure:
# the slices still out this long before the render's timeout are cancelled and the render refused as busy (X82).
AFTER_SLICES_S = 180
WORKER_DIR = Path(__file__).resolve().parent
SOURCES = ("media", "render", "store")

# The image of the engine's Docker page (node:22-bookworm-slim and the libraries its Chrome needs),
# with ffmpeg for the last steps; as test 3 ran it. The functions run in /edit: the renderer looks
# for its browser from the folder it runs in, and fetches another (100 MB) where it finds none.
render_image = (
    modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12")
    .env({"DEBIAN_FRONTEND": "noninteractive", "EDIT_BUNDLE": "/edit/bundle", "EDIT_KIT": "/edit/kit", "EDIT_MEDIA": DEV_MEDIA})
    .apt_install("libnss3", "libdbus-1-3", "libatk1.0-0", "libgbm-dev", "libasound2", "libxrandr2", "libxkbcommon-dev",
                 "libxfixes3", "libxcomposite1", "libxdamage1", "libatk-bridge2.0-0", "libpango-1.0-0", "libcairo2", "libcups2",
                 "ffmpeg", "procps")
    .workdir("/edit")
    .run_commands(
        "npm init -y >/dev/null && npm install --save-exact --no-audit --no-fund @remotion/renderer@4.0.545"
        " && npm cache clean --force >/dev/null 2>&1",
        "node -e \"require('@remotion/renderer').ensureBrowser()\"",
    )
    .pip_install_from_requirements(str(WORKER_DIR / "store-requirements.txt"))
)

# The media image (X38): Python and ffmpeg, for a take's copies and facts. Debian 12, as the render image
# is, so the worker has one ffmpeg (5.1). Not `debian_slim`: in this workspace's image builder (2026.10)
# that is Debian 13. Every function's container imports this file, so the worker's packages go in.
media_image = modal.Image.from_registry("python:3.12-slim-bookworm").apt_install("ffmpeg")
# The speech image (Task 4, R4): the media image and the speech and face models, for `analyse` (and the
# development app's `speech`, `faces` and suite); the media image stays light for `transcode`. The packages
# are those of media-requirements.txt (torch's CPU builds), then WhisperX's aligner without the rest of its
# tree; the models are fetched and checked as the image is built (media/models.py), never when a container
# starts.
#
# Then the face model (Task 5, X48). MediaPipe 1.2.3 is installed without its dependencies: it asks for
# sounddevice (and PortAudio), which only its audio tasks use and which it imports only if it is there,
# and for opencv-contrib-python, whose GUI needs libGL. Importing its vision tasks imports cv2 and
# matplotlib (for its drawing utilities), numpy and certifi, so those are what is installed: OpenCV
# without its GUI (the same `cv2`), and matplotlib at the versions WhisperX's lock pins
# (media-constraints.txt); numpy, certifi and the rest are the image's already. libmediapipe.so needs
# libEGL and libGLESv2 to load, though it draws nothing on the CPU. Last, store.py's packages (Task 6), compiled
# against the image's own pins, so they add boto3 and what it needs and change nothing else.
FACES_PACKAGES = ("opencv-python-headless==4.13.0.92", "matplotlib==3.10.6", "contourpy==1.3.2", "cycler==0.12.1",
                  "fonttools==4.60.1", "kiwisolver==1.4.9", "pillow==11.3.0", "pyparsing==3.2.5")
# Then the text reader (part 3, Task 9b, X101): RapidOCR 1.4.4 on ONNX Runtime (Apache-2.0), whose wheel holds its three
# PP-OCRv4 models (PaddleOCR's, Apache-2.0) and loads them from its own folder: nothing is fetched when it runs. It is
# installed without its dependencies: it asks for opencv-python, whose GUI needs libGL, where the image has OpenCV without
# its GUI (the same `cv2`), and for six and tqdm, which it never imports. Of what it imports, numpy, Pillow, ONNX Runtime
# and PyYAML are the image's already (media-requirements.txt, FACES_PACKAGES), so only these two are added, resolved
# against the image's numpy 2.2.6 for Python 3.12 on Linux x86-64. The last step loads the reader, so a reader that cannot
# start fails the build, not a job.
TEXT_PACKAGES = ("pyclipper==1.4.0", "shapely==2.2.0")
TEXT_READER = "rapidocr-onnxruntime==1.4.4"
speech_image = (
    media_image.env(models.ENV)
    .uv_pip_install(requirements=[str(WORKER_DIR / "media-requirements.txt")], uv_version="0.9.26",
                    index_url="https://download.pytorch.org/whl/cpu", extra_index_url="https://pypi.org/simple",
                    extra_options="--index-strategy unsafe-best-match")
    .uv_pip_install("whisperx==3.8.6", uv_version="0.9.26", extra_options="--no-deps")
    .run_commands(*models.FETCH)
    .env({"HF_HUB_OFFLINE": "1"})
    .apt_install("libegl1", "libgles2")
    .uv_pip_install(*FACES_PACKAGES, uv_version="0.9.26")
    .uv_pip_install("mediapipe==1.2.3", uv_version="0.9.26", extra_options="--no-deps")
    .run_commands(*models.FETCH_FACES)
    .uv_pip_install(*TEXT_PACKAGES, uv_version="0.9.26")
    .uv_pip_install(TEXT_READER, uv_version="0.9.26", extra_options="--no-deps")
    .run_commands("python -c 'from rapidocr_onnxruntime import RapidOCR; RapidOCR(use_cls=False)'")
    .uv_pip_install(requirements=[str(WORKER_DIR / "store-requirements.txt")], uv_version="0.9.26")
)
# The web address's image: light, so it starts fast. FastAPI and requests (the rows), every package pinned
# (web-requirements.txt); no ffmpeg, no boto3.
web_image = modal.Image.debian_slim(python_version="3.12").pip_install_from_requirements(str(WORKER_DIR / "web-requirements.txt"))

# The speech image before this worktree's files are added to it, for dev.py's suite to build on.
speech_built = speech_image
if modal.is_local():
    render_image = (
        render_image.add_local_dir(WORKER_DIR / ".bundle", "/edit/bundle")
        .add_local_dir(WORKER_DIR.parent / "public" / "edit", "/edit/kit")
        .add_local_file(WORKER_DIR / "render" / "render.mjs", RENDER_MJS)
        .add_local_python_source(*SOURCES)
    )
    media_image = media_image.add_local_python_source(*SOURCES)
    speech_image = speech_image.add_local_python_source(*SOURCES)
    web_image = web_image.add_local_python_source(*SOURCES)

# The development files' Volume: mounted by the development app only (dev.py, M1), never by a product function.
dev_media = modal.Volume.from_name("edit-dev-media")
# The worker's secrets (X51), as environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the rows),
# the R2 keys, EDIT_WORKER_SECRET (the web address) and ELEVENLABS_API_KEY (Scribe hears the words, X46).
worker_secret = modal.Secret.from_name("edit-worker")


class Film(TypedDict):
    mp4: str  # the posted file, its sound levelled
    jpg: str | None  # its cover, when a frame was asked for
    frames: int
    # The posted file's sound as measured, all None when it has none: a peak over -1 dBTP is kept here, not failed (N5).
    lufs: float | None
    truePeak: float | None
    lra: float | None
    lufsFirst: float | None  # as first measured (the base, not this, decides the band pass: X49)
    truePeakFirst: float | None  # as first measured; over -1 dBTP, the levelling was done once more (guarded)
    guarded: bool
    lufsBase: float | None  # the base's: the first levelling's, or the guard's when it ran
    truePeakBase: float | None
    raised: float | None  # the dB the band pass added, when it ran
    raisedPosted: bool  # whether its film was posted (it held -1 dBTP and lay nearer the band, or the base did not hold it), not the base


def node(*args: str, about: str | None) -> list[dict]:
    """Runs render.mjs and gives the JSON lines it printed; a failure says its message (render/script.py)."""
    return script.run(RENDER_MJS, *args, about=about)


def write_props(props: dict, folder: Path) -> Path:
    path = folder / "props.json"
    path.write_text(json.dumps(props))
    return path


def render_film(props: dict, cover_frame: int | None, on_progress: Callable[[str, float], None], out: Path, *,
                slices: modal.Function | None = None, deadline: float | None = None) -> Film:
    """The render pipeline, in the calling container: the film in `out` as film.mp4 (and cover.jpg).
    `on_progress(stage, share)`: sizing, drawing, joining, levelling; told at every look while the slices draw, so a
    job the app stopped is given up then (it raises, and `plan.collect` cancels the slices). `slices` draws them
    (`render_slices`, or the development app's with its Volume); `deadline` (time.monotonic()) is when slices still
    out are given up as busy (X82)."""
    out.mkdir(parents=True, exist_ok=True)
    props_path = write_props(props, out)
    on_progress("sizing", 0.0)
    # Sizing it first also asks for every file once: a missing one fails here, before any render container starts.
    [size] = node("size", str(props_path), about="the film")
    frames, fps = size["frames"], size["fps"]
    per, count = plan.slicing(frames)
    on_progress("drawing", SIZED)
    parts = out / "parts"
    parts.mkdir(exist_ok=True)
    with modal.Queue.ephemeral() as drawn:
        calls = [(slices or render_slices).spawn(props, frames, per, first, last, drawn) for first, last in plan.spread(count)]
        done = 0

        def wait() -> None:
            nonlocal done
            try:
                done += sum(drawn.get_many(1000, timeout=1))
            except queue.Empty:
                pass
            on_progress("drawing", SIZED + (DRAWN - SIZED) * done / frames)  # written at most every two seconds (store.Progress)

        for files in plan.collect(calls, wait, deadline):
            for name, data in files.items():
                (parts / name).write_bytes(data)
    on_progress("joining", DRAWN)
    joined = out / "joined.mp4"
    node("join", str(parts), str(joined), str(fps), str(frames), str(per), about="the film's slices")
    on_progress("levelling", JOINED)
    mp4, jpg = out / "film.mp4", out / "cover.jpg"
    with ThreadPoolExecutor(1) as pool:
        # The cover is drawn by a browser while ffmpeg levels the sound; neither waits for the other.
        drawing = pool.submit(make_cover, props_path, cover_frame, out, jpg) if cover_frame is not None else None
        level = finish.level(joined, mp4)
        if drawing:
            drawing.result()
    print(json.dumps({"levelled": level}), flush=True)  # which film was posted, and what each levelling measured, to the log
    on_progress("levelling", 1.0)
    return Film(mp4=str(mp4), jpg=str(jpg) if drawing else None, frames=frames, lufs=level["lufs"], truePeak=level["truePeak"], lra=level["lra"],
                lufsFirst=level["lufsFirst"], truePeakFirst=level["truePeakFirst"], guarded=level["guarded"], lufsBase=level["lufsBase"],
                truePeakBase=level["truePeakBase"], raised=level["raised"], raisedPosted=level["raisedPosted"])


def make_cover(props_path: Path, frame: int, out: Path, jpg: Path) -> None:
    node("stills", str(props_path), str(out), str(frame), about=f"the cover, frame {frame}")
    finish.cover(out / f"frame-{frame:04d}.png", jpg)


# One run of slices to a container, which then stops: kept for the next input, it was billed its 16
# cores until the app stopped (about 25 s of 77 on the 90 s film).
@app.function(image=render_image, cpu=(16, 16), memory=(32768, 32768), timeout=600, max_containers=plan.MOST_CONTAINERS,
              single_use_containers=True)
def render_slices(props: dict, frames: int, per: int, first: int, last: int, drawn: modal.Queue) -> dict[str, bytes]:
    """Slices `first` to `last` of the film, a browser to each: their files by name. Frames go to `drawn` as they are drawn."""
    with tempfile.TemporaryDirectory() as work:
        folder = Path(work)
        parts = folder / "parts"
        with (folder / "said.txt").open("w+", errors="replace") as said:  # odd bytes in what Chrome says are no failure (13)
            drawing = subprocess.Popen(["node", RENDER_MJS, "slices", str(write_props(props, folder)), str(parts), str(frames), str(per),
                                        str(first), str(last), str(plan.BROWSERS)], stdout=subprocess.PIPE, stderr=said, text=True, errors="replace")
            for line in drawing.stdout:
                if line.startswith('{"frames"'):
                    drawn.put(json.loads(line)["frames"])
                else:
                    print(line, end="", flush=True)  # each slice's time, and anything the engine says
            code = drawing.wait()
            said.seek(0)
            everything = said.read()
            # The whole of it to the log, of a run that succeeds too (what the engine warned of is kept); its message to the caller.
            print(everything, file=sys.stderr, flush=True)
            if code != 0:
                raise script.failure(f"slices {first} to {last}", everything)  # its marked line the worker's words (M2)
        return {path.name: path.read_bytes() for path in sorted(parts.iterdir())}


# At most two renders at once (X81): each spreads its slices over up to four containers of render_slices, four in all.
@app.function(image=render_image, cpu=(2, 2), memory=(4096, 4096), timeout=RENDER_S, max_containers=2, secrets=[worker_secret])
def render(job: str) -> None:
    """The render job `job` (its row's edit), its film and cover stored in R2 and its row written (store.render_job)."""
    from functools import partial

    import store

    deadline = time.monotonic() + RENDER_S - AFTER_SLICES_S
    with tempfile.TemporaryDirectory() as work:
        store.render_job(job, rows=store.Rows.from_env(), r2=store.R2.from_env(), call=modal.current_function_call_id(),
                         render=partial(render_film, deadline=deadline), work=Path(work))


def draw_stills(props: dict, frames: list[int], about: str | None = "stills") -> list[bytes]:
    """Single frames of a film as PNGs, in the order asked, drawn by one browser in this container (render.mjs holds each
    to the film's length). A failure is render.mjs's message, after `about` where there is one."""
    with tempfile.TemporaryDirectory() as work:
        folder = Path(work)
        node("stills", str(write_props(props, folder)), str(folder), *map(str, frames), about=about)
        return [(folder / f"frame-{frame:04d}.png").read_bytes() for frame in frames]


@app.function(image=render_image, cpu=(4, 4), memory=(8192, 8192), timeout=300, max_containers=2, scaledown_window=300)
def stills(props: dict, frames: list[int]) -> list[bytes]:
    """Single frames of a film as PNGs, in the order asked, drawn by one browser (the development app's demos)."""
    return draw_stills(props, frames)


@functools.cache
def bucket():
    """The bucket, made once a container (boto3 reads its service's model as it makes a client)."""
    import store

    return store.R2.from_env()


# How long one stills call may take, in the order each gives up, so the worker fails first, in its own words, and the app
# hears them (fix round 1, M2): the stills machine at 60 s (`web` then answers 500, "the stills failed on our side"); the app
# at 75 s (src/lib/edit/worker/stills.ts; the agent's loop may pass a shorter deadline of its own); the web address at 90 s,
# which outlasts the stills machine with a wait for a free one. Measured (part 3, Task 6): a cold call of three stills 22.9 s,
# a cold sheet of 12 35.3 s, on the owner's 12.7 s take; a cold call starts the web address and a stills machine, whose
# browser opens while it fetches the take whole (X72), before anything is drawn.
STILLS_S = 60
WEB_S = 90


# The stills route's work (part 3, Task 6), in the render image: boto3 signs the files, render.mjs draws, ffmpeg makes the JPEGs.
# Only the JPEGs go back to `web`. At most two at once, like `stills`; each kept warm for five minutes for the agent's next look.
@app.function(image=render_image, cpu=(4, 4), memory=(8192, 8192), timeout=STILLS_S, max_containers=2, scaledown_window=300,
              secrets=[worker_secret])
def stills_answer(body: bytes, authorization: str | None) -> tuple[int, dict]:
    """`POST /stills`'s status and body (store.stills_request), its body and header as `web` was given them."""
    import os

    import store

    with tempfile.TemporaryDirectory() as work:
        return store.stills_request(body, authorization, secret=os.environ["EDIT_WORKER_SECRET"], r2=bucket(),
                                    draw=functools.partial(draw_stills, about=None), work=Path(work))


# The words function's size (Task 4): eight cores and 8 GiB, as the resolutions set them. Measured on
# 2026-11-20 (plan, Task 4): a 60 s sound at 3.4 GiB at most; its words in 39 to 54 s, its pauses in
# 3 to 4 s, the models loaded in 12 s. The aligner hears a long sound in windows (R2).
SPEECH_CORES = 8


# The analysis's size (Task 5): the speech function's, since the words are most of its time. Its timeout
# is for a take of 10 minutes (X56): the words 6.5 to 9 minutes (Task 4) and the copies, at the 4-core
# `transcode`'s pace on the owner's take (13.3 s for 12.7 s), up to 10 minutes more.
# At most four analyses at once (X81).
@app.function(image=speech_image, cpu=(SPEECH_CORES, SPEECH_CORES), memory=(8192, 8192), timeout=1800, max_containers=4, secrets=[worker_secret])
def analyse(job: str) -> None:
    """The analyse job `job`: its take analysed, the copies stored in R2 and both rows written (store.analyse_job).
    Scribe hears the words when ELEVENLABS_API_KEY is set (the secret edit-worker)."""
    import os

    import store

    with tempfile.TemporaryDirectory() as work:
        store.analyse_job(job, rows=store.Rows.from_env(), r2=store.R2.from_env(), call=modal.current_function_call_id(),
                          key=os.environ.get("ELEVENLABS_API_KEY"), work=Path(work), threads=SPEECH_CORES)


# The web address: two routes that wait on others, so a quarter of a core and 512 MiB. Their work runs in a thread (it waits on
# Supabase and Modal). Behind Modal's proxy auth (X81): a call without the workspace's proxy token never starts a container.
# Eight calls at once in a container (I2): a stills call waits up to a minute on its machine, and without this it held a
# container for that time, so four of them (at most four containers) left `/start` nothing to run on. The waits are I/O, in
# threads, so eight fit a quarter of a core.
@app.function(image=web_image, cpu=(0.25, 0.25), memory=(512, 512), timeout=WEB_S, max_containers=4, secrets=[worker_secret])
@modal.concurrent(max_inputs=8)
@modal.asgi_app(requires_proxy_auth=True)
def web():
    import os
    import traceback

    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    from starlette.concurrency import run_in_threadpool

    import store

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    rows, secret = store.Rows.from_env(), os.environ["EDIT_WORKER_SECRET"]
    jobs = {"analyse": analyse, "render": render}

    @api.post("/start")
    async def start(request: Request) -> JSONResponse:
        authorization = request.headers.get("authorization")
        if not store.allowed(authorization, secret):  # before the body is read (X64)
            return JSONResponse({"error": "not allowed"}, status_code=401)
        status, answer = await run_in_threadpool(store.start, await request.body(), authorization, secret=secret, rows=rows,
                                                 spawn=lambda kind, job: jobs[kind].spawn(job).object_id)
        return JSONResponse(answer, status_code=status)

    @api.post("/stills")
    async def stills_route(request: Request) -> JSONResponse:
        authorization = request.headers.get("authorization")
        if not store.allowed(authorization, secret):  # before the body is read, as /start
            return JSONResponse({"error": "not allowed"}, status_code=401)
        body = await request.body()
        try:
            status, answer = await run_in_threadpool(stills_answer.remote, body, authorization)
        except Exception:  # the stills machine failed or timed out: ours (M2), its words to the log
            traceback.print_exc()
            status, answer = 500, {"error": store.STILLS_OURS}
        return JSONResponse(answer, status_code=status)

    return api
