"""The worker's development app, `maven-edit-worker-dev`: the tests in the speech image and the demos,
on the product's images and code. The product's functions are included in it, so a demo's render
spreads its slices over render containers as the product's does. `modal deploy worker/app.py` ships
none of this file.

A take of a demo (X44, X45): `transcode` makes its two copies, its poster and its sound for speech with
`media/transcode.py`, in the media image (Python and Debian 12's ffmpeg, 5.1). `speech` gives its words,
each timed on its sound, and its pauses (Task 4); `faces` its face samples; `analyse_named` its whole
analysis (Task 5), in the speech image. A file of a demo is named by its name in the Volume
`edit-dev-media`, which is mounted where render.mjs serves its development files from, in this app's functions
only (M1): a demo's slices and stills are the product's functions with the Volume added (`with_options`); https
addresses work as they do in the product.

Run from the worktree root, one run at a time, after `pnpm exec tsx scripts/edit-bundle.ts`:
  modal run worker/dev.py::transcode_demo --name take.mp4
  modal run worker/dev.py::media_suite [--only <pytest -k expression>]
  modal run worker/dev.py::speech_demo --name take.mp4 [--repeat-to 60] [--out <file>] [--no-key]
  modal run worker/dev.py::faces_demo --name take.mp4 --out <file>
  modal run worker/dev.py::analyse_demo --name take.mp4 [--language en] [--out <analysis.json>] [--no-key] [--reference]
  modal run worker/dev.py::render_demo --demo .scratch/media/demo-long.json --out <dir> [--cover 45] [--joined] [--r2-user <id>] [--frames 0,2700]
  modal run worker/dev.py::stills_demo --demo .scratch/media/demo-long.json --out <dir> --frames 0,45 [--other <demo>] [--gl egl]
`--no-key` has `speech` and `analyse_named` hear the words through Whisper though the secret holds the ElevenLabs
key, so the path without a key can be proved; the product's `analyse` uses the key whenever the secret has it.
A demo is `{"edit": <an edit>, "files": {<file id>: <name in edit-dev-media>}}`. With `--r2-user`, `render_demo` reads the
demo's files as the product does instead: each asset is one of that creator's takes in R2, signed in the container
(`store.addresses`, the secret edit-worker). With `--frames`, only those frames of the film come back (JPEGs), with its
facts, and not the film: a long film is hundreds of MB. `render_demo` and `analyse_demo` also say the container's memory
at its peak, as the container's cgroup counts it. `media_suite` runs the
worker's tests in the speech image (the media image with the models), so its ffmpeg and models run them
too, with the owner's take from the Volume; those that need node skip there.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

import modal

import app as product
from app import AFTER_SLICES_S, DEV_MEDIA, RENDER_S, SOURCES, SPEECH_CORES, dev_media, render_film, render_slices, stills, worker_secret
from media import transcode as copies
from media.probe import probe, stored_ms
from media.tool import run

dev = modal.App("maven-edit-worker-dev").include(product.app)

# This file's functions import app.py, so their images carry it; the suite's has pytest and the tests too.
media_image, speech_image, render_image = product.media_image, product.speech_image, product.render_image
suite_image = product.speech_built.pip_install("pytest==9.2.0")
if modal.is_local():
    media_image = media_image.add_local_python_source("app")
    speech_image = speech_image.add_local_python_source("app")
    render_image = render_image.add_local_python_source("app")
    suite_image = suite_image.add_local_python_source(*SOURCES, "app").add_local_dir(
        Path(__file__).resolve().parent / "tests", "/root/tests", ignore=["__pycache__"])


def peak_memory() -> dict:
    """The container's memory at its peak, as its cgroup counts it (every process in it), and this process's and its
    children's largest resident sets, in MiB; what cannot be read is None."""
    import resource

    def cgroup() -> int | None:
        for path in ("/sys/fs/cgroup/memory.peak", "/sys/fs/cgroup/memory/memory.max_usage_in_bytes"):
            try:
                return round(int(Path(path).read_text()) / 2**20)
            except (OSError, ValueError):
                continue
        return None

    return {"cgroupPeakMiB": cgroup(), "selfMaxRssMiB": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024),
            "childMaxRssMiB": round(resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024)}


@dev.function(image=render_image, cpu=(2, 2), memory=(4096, 4096), timeout=RENDER_S, volumes={DEV_MEDIA: dev_media})
def render_props(props: dict, cover_frame: int | None = None, joined: bool = False, r2_user: str = "", frames: list[int] | None = None) -> dict:
    """A film rendered from props, as the product's `render` does (its slices the product's, with the Volume added; its
    deadline the product's), its progress printed to the log; its files sent back as bytes (and the joined film before
    its sound is levelled, when asked, for a proof's sound check). With `frames`, only those frames of the film come
    back, as JPEGs, with its facts. With `r2_user`, every file is that creator's take in R2, read by a signed address as
    the product's render job reads it (the caller gives it the secret edit-worker for that, and only then: `render_demo`)."""
    started, deadline = time.time(), time.monotonic() + RENDER_S - AFTER_SLICES_S
    if r2_user:
        import store

        props = {**props, "urls": store.addresses(props["edit"], r2_user, store.R2.from_env())}
    said: list = []

    def on_progress(stage: str, share: float) -> None:
        if said[-1:] != [(stage, round(share, 3))]:  # told at every look while it draws; printed when it moves
            said.append((stage, round(share, 3)))
            print(json.dumps({"stage": stage, "progress": round(share, 3), "seconds": round(time.time() - started, 1)}), flush=True)

    with tempfile.TemporaryDirectory() as work:
        film = render_film(props, cover_frame, on_progress, Path(work), slices=render_slices.with_options(volumes={DEV_MEDIA: dev_media}),
                           deadline=deadline)
        seconds = round(time.time() - started, 1)
        if frames:
            picked = Path(work) / "picked"
            picked.mkdir()
            chosen = "+".join(f"eq(n\\,{frame})" for frame in frames)
            run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", film["mp4"], "-vf", f"select={chosen}", "-fps_mode", "passthrough",
                 "-q:v", "2", str(picked / "f-%d.jpg")], "the film's frames")
            facts = json.loads(run(["ffprobe", "-v", "error", "-count_packets", "-show_entries", "stream=codec_type,codec_name,width,height,"
                                    "nb_read_packets,duration:format=duration,size", "-of", "json", film["mp4"]], "the film"))
            return {**film, "mp4": None, "jpg": None, "joined": None, "facts": facts, "seconds": seconds, "memory": peak_memory(),
                    "pictures": {frame: (picked / f"f-{i + 1}.jpg").read_bytes() for i, frame in enumerate(frames)}}
        return {**film, "mp4": Path(film["mp4"]).read_bytes(), "jpg": Path(film["jpg"]).read_bytes() if film["jpg"] else None,
                "joined": (Path(work) / "joined.mp4").read_bytes() if joined else None, "seconds": seconds, "memory": peak_memory()}


@dev.function(image=media_image, cpu=(4, 4), memory=(8192, 8192), timeout=600, volumes={DEV_MEDIA: dev_media})
def transcode(name: str) -> dict:
    """The copies of the take named `name` in edit-dev-media, made in a folder of this container and put
    in the Volume under takes/<name>/ (its whole name, so take.mov and take.mp4 keep apart), in place of
    what was there; gives the facts of the take and of both copies, the length the take is stored with,
    and the copies' names in the Volume."""
    started = time.time()
    source = Path(DEV_MEDIA) / name
    facts = probe(source)
    with tempfile.TemporaryDirectory() as work:
        made = copies.transcode(source, facts, work)
        full, preview = probe(made["full"]), probe(made["preview"])
        folder = Path(DEV_MEDIA) / "takes" / name
        shutil.rmtree(folder, ignore_errors=True)  # no file of an earlier transcode stays beside the new ones
        shutil.copytree(work, folder)
    dev_media.commit()
    return {"source": facts, "full": full, "preview": preview, "storedMs": stored_ms(full, preview),
            "files": {kind: str(folder.relative_to(DEV_MEDIA) / Path(path).name) for kind, path in made.items() if path},
            "seconds": round(time.time() - started, 1)}


@dev.function(image=suite_image, cpu=(4, 4), memory=(8192, 8192), timeout=900, volumes={DEV_MEDIA: dev_media})
def suite(only: str = "") -> tuple[int, str]:
    """The worker's tests in the speech image (those whose names match `only`, when given): pytest's exit
    code, and what it and ffmpeg's version said."""
    version = run(["ffmpeg", "-version"], "ffmpeg").splitlines()[0]
    chosen = ["-k", only] if only else []
    done = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *chosen, "tests"], cwd="/root", capture_output=True, text=True)
    return done.returncode, f"{version}\n{done.stdout}{done.stderr}"


@dev.function(image=speech_image, cpu=(SPEECH_CORES, SPEECH_CORES), memory=(8192, 8192), timeout=900, volumes={DEV_MEDIA: dev_media},
              secrets=[worker_secret])
def speech(name: str, language: str | None = None, repeat_to_s: float = 0, no_key: bool = False) -> dict:
    """`words` on the take named `name` in edit-dev-media (its takes/<name>/sound16k.wav): its words and
    pauses, agreed (X54), with the time it took, the models' loading timed apart. With `repeat_to_s`,
    the same again on the sound repeated to that many seconds, for the time a minute of take costs.
    Scribe is used when ELEVENLABS_API_KEY is set (the secret edit-worker), Whisper when it is not or `no_key`
    is asked. The analysis calls `words` itself."""
    import resource

    import torch

    from media import words
    from media.sound import read16k, write16k

    key = the_key(no_key)
    seconds = {}

    def timed(step: str, work: Callable):
        started = time.time()
        done = work()
        seconds[step] = round(time.time() - started, 2)
        return done

    sound = Path(DEV_MEDIA) / "takes" / name / "sound16k.wav"
    timed("load", lambda: words.load(language or "en", key, threads=SPEECH_CORES))  # the owner's takes are in English
    out = {"name": name, "scribe": bool(key), **timed("words", lambda: words.words(sound, language, key, threads=SPEECH_CORES))}
    if repeat_to_s:
        samples = read16k(sound)
        with tempfile.TemporaryDirectory() as work:
            long = write16k((samples * -(-int(repeat_to_s * 16000) // len(samples)))[:int(repeat_to_s * 16000)], Path(work) / "long.wav")
            heard = timed("long", lambda: words.words(long, language, key, threads=SPEECH_CORES))
        out["long"] = {"ms": int(repeat_to_s * 1000), "words": len(heard["words"]), "untimed": heard["untimed"], "pauses": len(heard["pauses"])}
    out["seconds"] = seconds
    out["machine"] = {"cpuCount": os.cpu_count(), "affinity": len(os.sched_getaffinity(0)), "torchThreads": torch.get_num_threads(),
                      "peakMemoryMiB": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024)}
    return out


@dev.function(image=speech_image, cpu=(2, 2), memory=(2048, 2048), timeout=300, volumes={DEV_MEDIA: dev_media})
def faces(name: str) -> dict:
    """The face samples of the take named `name` in edit-dev-media (its takes/<name>/preview.mp4), timed:
    for the pictures of where they are (Task 5). The analysis finds them itself."""
    from media.faces import faces as samples

    started = time.time()
    found = samples(Path(DEV_MEDIA) / "takes" / name / "preview.mp4")
    return {"name": name, "faces": found, "seconds": round(time.time() - started, 1)}


@dev.function(image=speech_image, cpu=(SPEECH_CORES, SPEECH_CORES), memory=(8192, 8192), timeout=1800, volumes={DEV_MEDIA: dev_media},
              secrets=[worker_secret])
def analyse_named(name: str, language: str | None = None, no_key: bool = False, reference: bool = False) -> dict:
    """The analysis of the take named `name` in edit-dev-media, made in a folder of this container and put
    in the Volume under takes/<name>/ with its copies, in place of what was there (as `transcode` does):
    analysis.json as stored there, each stage's time, and the progress as it was told (also printed).
    Scribe is used when ELEVENLABS_API_KEY is set (the secret edit-worker), Whisper when it is not or `no_key`
    is asked; `reference` analyses it as a reference (X98). The product's `analyse` works from a job's row and R2 instead."""
    from media.analyse import analyse as analysed

    started = time.time()
    told: list[dict] = []

    def on_progress(stage: str, share: float) -> None:
        told.append({"stage": stage, "progress": share, "seconds": round(time.time() - started, 2)})
        print(json.dumps(told[-1]), flush=True)

    folder = Path(DEV_MEDIA) / "takes" / name
    key = the_key(no_key)
    with tempfile.TemporaryDirectory() as work:
        analysed(Path(DEV_MEDIA) / name, work, key, on_progress, language=language, threads=SPEECH_CORES, reference=reference)
        memory = peak_memory()  # before the copies go into the Volume
        shutil.rmtree(folder, ignore_errors=True)  # no file of an earlier analysis stays beside the new ones
        shutil.copytree(work, folder)
    dev_media.commit()
    spans: dict[str, list[float]] = {}  # each stage's first word and last, in seconds from the start
    for x in told:
        spans.setdefault(x["stage"], [x["seconds"], x["seconds"]])[1] = x["seconds"]
    return {"name": name, "scribe": bool(key), "analysis": (folder / "analysis.json").read_text(), "progress": told,
            "seconds": {stage: round(end - start, 2) for stage, (start, end) in spans.items()}, "total": round(time.time() - started, 1),
            "memory": memory}


def the_key(no_key: bool) -> str | None:
    """The ElevenLabs key of the secret edit-worker, or none when `no_key` asks for the path without one (Whisper)."""
    return None if no_key else os.environ.get("ELEVENLABS_API_KEY")


def demo_props(demo: str) -> dict:
    found = json.loads(Path(demo).read_text())
    return {"edit": found["edit"], "urls": found["files"]}


@dev.local_entrypoint()
def render_demo(demo: str, out: str, cover: int = -1, joined: bool = False, r2_user: str = "", frames: str = ""):
    """Renders a demo edit and writes film.mp4 (and cover.jpg, and joined.mp4, the film before its sound is levelled) into `out`;
    with `--r2-user`, its files read from R2 as the product reads them; with `--frames 0,2700`, only those frames
    (frame-<n>.jpg) and the film's facts, not the film."""
    started = time.time()
    draw = render_props.with_options(secrets=[worker_secret]) if r2_user else render_props  # R2's keys only where R2 is read
    film = draw.remote(demo_props(demo), None if cover < 0 else cover, joined, r2_user, [int(x) for x in frames.split(",")] if frames else None)
    folder = Path(out)
    folder.mkdir(parents=True, exist_ok=True)
    if mp4 := film.pop("mp4"):
        (folder / "film.mp4").write_bytes(mp4)
    if jpg := film.pop("jpg"):
        (folder / "cover.jpg").write_bytes(jpg)
    if before := film.pop("joined"):
        (folder / "joined.mp4").write_bytes(before)
    for frame, picture in film.pop("pictures", {}).items():
        (folder / f"frame-{int(frame):04d}.jpg").write_bytes(picture)
    print(json.dumps({**film, "calledFor": round(time.time() - started, 1)}))


@dev.local_entrypoint()
def stills_demo(demo: str, out: str, frames: str, other: str = "", gl: str = ""):
    """Renders stills of a demo edit into `out`, timing a first call and a second; with `--other`, the second
    call draws that demo, into `out`/other; `--gl egl` asks for a GL with no WebGL."""
    asked = [int(frame) for frame in frames.split(",")]
    draw = stills.with_options(volumes={DEV_MEDIA: dev_media}, env={"EDIT_GL": gl} if gl else None)  # a demo's files by name (M1)

    def call(label: str, which: str, folder: Path) -> None:
        started = time.time()
        pictures = draw.remote(demo_props(which), asked)
        print(json.dumps({"call": label, "demo": which, "frames": len(asked), "seconds": round(time.time() - started, 1)}))
        folder.mkdir(parents=True, exist_ok=True)
        for frame, png in zip(asked, pictures):
            (folder / f"frame-{frame:04d}.png").write_bytes(png)

    call("first", demo, Path(out))
    if other:
        call("second", other, Path(out) / "other")
    else:
        call("second", demo, Path(out))


@dev.local_entrypoint()
def transcode_demo(name: str = "take.mp4"):
    """Makes the copies of a take in edit-dev-media (under takes/<name>/ there) and prints what `transcode` gives."""
    started = time.time()
    print(json.dumps({**transcode.remote(name), "calledFor": round(time.time() - started, 1)}, indent=1))


@dev.local_entrypoint()
def media_suite(only: str = ""):
    """Runs the worker's tests in the speech image (`--only`, a pytest -k expression, chooses some) and prints
    what pytest said; fails as pytest did."""
    code, said = suite.remote(only)
    print(said)
    if code:
        raise SystemExit(code)


@dev.local_entrypoint()
def speech_demo(name: str = "take.mp4", language: str = "", repeat_to: float = 0, out: str = "", no_key: bool = False):
    """Prints (and writes to `out`) the words and pauses of a take in edit-dev-media, timed; `--repeat-to 60`
    also times a sound of 60 s made by repeating it; `--no-key` hears it through Whisper."""
    started = time.time()
    found = {**speech.remote(name, language or None, repeat_to, no_key), "calledFor": round(time.time() - started, 1)}
    said = json.dumps(found, indent=1, ensure_ascii=False)
    if out:
        Path(out).write_text(said)
    print(said)


@dev.local_entrypoint()
def faces_demo(name: str = "take.mp4", out: str = ""):
    """Prints how many of a take's face samples found a face, and the time; writes the samples to `out`."""
    started = time.time()
    found = faces.remote(name)
    if out:
        Path(out).write_text(json.dumps(found["faces"]))
    seen = sum(1 for x in found["faces"] if x["face"])
    print(json.dumps({"name": name, "samples": len(found["faces"]), "withFace": seen, "seconds": found["seconds"],
                      "calledFor": round(time.time() - started, 1)}))


@dev.local_entrypoint()
def analyse_demo(name: str = "take.mp4", language: str = "", out: str = "", no_key: bool = False, reference: bool = False):
    """Analyses a take in edit-dev-media (its files under takes/<name>/ there), prints each stage's time and
    the progress, and writes analysis.json, as stored, to `out`; `--no-key` hears its words through Whisper;
    `--reference` analyses it as a reference (X98): not heard, its pauses kept (X103), its text read (X101: how many moments
    and lines are printed)."""
    started = time.time()
    found = analyse_named.remote(name, language or None, no_key, reference)
    if out:
        Path(out).write_text(found["analysis"])
    analysis = json.loads(found.pop("analysis"))
    print(json.dumps({**found, "ms": analysis["ms"], "language": analysis["language"], "words": len(analysis["words"]),
                      "pauses": len(analysis["pauses"]), "withFace": sum(1 for x in analysis["faces"] if x["face"]),
                      "samples": len(analysis["faces"]), "loudness": analysis["loudness"] and analysis["loudness"]["lufs"],
                      **({"textMoments": len(analysis["text"]), "textLines": sum(len(x["lines"]) for x in analysis["text"])} if "text" in analysis else {}),
                      "calledFor": round(time.time() - started, 1)}, indent=1))
