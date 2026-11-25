"""The worker's outer layer (X39): a take's files in R2, the take's and the jobs' rows in Supabase, the
two jobs run by id, and the web address's check. Plain Python: `app.py` runs it in Modal's containers.

R2 (X43). The bucket is in Cloudflare's EU jurisdiction, so its address is
`https://<account>.eu.r2.cloudflarestorage.com`; the default address cannot see it.
  u/<user>/takes/<take>/source                          the take as uploaded
  u/<user>/takes/<take>/full.mp4, preview.mp4, poster.jpg  its copies
  u/<user>/takes/<take>/sheet.jpg                       a reference's sheet (part 3, Task 9c), its only file once it
                                                        is analysed: its source is deleted as soon as its analysis
                                                        is written (X96), and the app drops the rest once it is read
  u/<user>/films/<job>.mp4, <job>.jpg                    a render's film and its cover
Nothing else is kept there: the analysis goes into the take's row, and the 16 kHz sound stays in the
container. Reads are signed for two hours, so a render of minutes can still read its files.

The rows (X41, X42), over PostgREST with the service key. A job is claimed by a conditional update
(queued to running), so it runs once however often it is started. Its progress is written at most every
two seconds, at once when the stage changes, and at the end; while it runs, it is touched at least every
30 s, so a long stage (the words of a 10-minute take) does not read as dead: a running job untouched for
two minutes reads as failed, by its `updated_at`, which the database stamps.

A failure writes a plain line into the rows (X66, X71): the worker's own words where it raised them itself (a
`Refusal`: "IMG_0001.MOV is cut short ..."), one line with no folder in it (`plain`); for anything else, "the
analysis failed on our side; try again" or "the render failed on our side; try again". The trace and the
error's words go to the log. A take's rows are only ever written with the job's own user in the filter. The
last writes of a job (the take ready, the job ended) are tried three times, a pause between (M3).

The stills (part 3, Task 6): `POST /stills` is answered in the render image (`stills_request`, app.py's `stills_answer`), with
the frames of an edit drawn there and given back as JPEGs, its files signed as a render job's are (`addresses`).

A job the app has written failed (it read it as stopped, X41 and X75) is given up: a progress write that
matches no running row raises `Stopped` at the next progress told, between stages, and in a render while
its slices draw, so they are cancelled (`plan.collect`). Neither row is written again; the take follows its
job in the app.
"""

import base64
import hmac
import json
import os
import re
import threading
import time
import traceback
import uuid
from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from pathlib import Path

import requests

from media.refusal import Refusal
from media.tool import run

READ_SECONDS = 2 * 60 * 60
EVERY_S = 2.0  # progress at most this often (X41)
HEARTBEAT_S = 30.0  # a running job touched at least this often
WORK = 0.97  # a job's progress when its work is done and its files are being stored
COPIES = {"full": "video/mp4", "preview": "video/mp4", "poster": "image/jpeg"}
REFERENCE_FILES = {"sheet": "image/jpeg"}  # what a reference stores (Task 9c): the sheet Qwen judges
LONGEST_MESSAGE = 1000
RETRY_S = (1.0, 3.0)  # the pauses before the second and the third try of a job's last writes (M3)
KIT_PATH = re.compile(r"[a-z0-9][a-z0-9_.-]*(?:/[a-z0-9][a-z0-9_.-]*)*")  # the app's `KitPath` (src/lib/edit/doc.ts)
LONGEST_KIT_PATH = 80
# What a creator is told of a failure the worker did not raise itself (M2); its words go to the log.
OURS = {"analyse": "the analysis failed on our side; try again", "render": "the render failed on our side; try again"}


def take_key(user: str, take: str, name: str) -> str:
    return f"u/{user}/takes/{take}/{name}"


def film_key(user: str, job: str, extension: str) -> str:
    return f"u/{user}/films/{job}.{extension}"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class R2:
    """The bucket, through boto3 at its EU address."""

    def __init__(self, account: str, key_id: str, secret: str, bucket: str):
        import boto3  # not in the light image of the web address, which never touches R2
        from botocore.config import Config

        self.bucket = bucket
        self.client = boto3.client(
            "s3", endpoint_url=f"https://{account}.eu.r2.cloudflarestorage.com", region_name="auto",
            aws_access_key_id=key_id, aws_secret_access_key=secret,
            # Paths, not a host per bucket; checksums only where the API asks for them, as before boto3 1.36.
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                          request_checksum_calculation="when_required", response_checksum_validation="when_required"))

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "R2":
        return cls(env["R2_ACCOUNT_ID"], env["R2_ACCESS_KEY_ID"], env["R2_SECRET_ACCESS_KEY"], env["R2_BUCKET"])

    def size(self, key: str) -> int | None:
        """The object's size in bytes; None when there is none."""
        from botocore.exceptions import ClientError

        try:
            return self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"]
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise

    def download(self, key: str, path: str | Path) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.client.download_file(self.bucket, key, str(path))

    def upload(self, path: str | Path, key: str, content_type: str) -> None:
        self.client.upload_file(str(path), self.bucket, key, ExtraArgs={"ContentType": content_type})

    def sign(self, key: str, seconds: int = READ_SECONDS) -> str:
        return self.client.generate_presigned_url("get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=seconds)

    def delete(self, key: str) -> None:
        """Deletes an object; one that is not there is no failure (S3 answers a delete of it the same)."""
        self.client.delete_object(Bucket=self.bucket, Key=key)


class Rows:
    """edit_takes and edit_jobs, over PostgREST with the service key (it bypasses RLS: only it writes)."""

    def __init__(self, url: str, key: str, timeout: float = 20):
        self.base = url.rstrip("/") + "/rest/v1"
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                        "Prefer": "return=representation"}
        self.timeout = timeout

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "Rows":
        return cls(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    def _ask(self, method: str, table: str, filters: dict[str, str], body: dict | None = None) -> list[dict]:
        answer = requests.request(method, f"{self.base}/{table}", params=filters, json=body, headers=self.headers, timeout=self.timeout)
        if not answer.ok:
            raise RuntimeError(f"Supabase {method} {table}: {answer.status_code} {answer.text[:300]}")
        return answer.json()

    def get(self, table: str, id: str, **where: str) -> dict | None:
        """`id`'s row, where every PostgREST filter in `where` holds; None when there is none."""
        found = self._ask("GET", table, {"id": f"eq.{id}", "select": "*", **where})
        return found[0] if found else None

    def update(self, table: str, id: str, fields: dict, **where: str) -> list[dict]:
        """The rows changed: `id`'s, where every PostgREST filter in `where` holds (status="eq.running")."""
        return self._ask("PATCH", table, {"id": f"eq.{id}", **where}, fields)

    def job(self, id: str) -> dict | None:
        return self.get("edit_jobs", id)

    def claim(self, job: str, call: str | None) -> dict | None:
        """The job, now running under `call`; None when it was not queued (another call has it, or it is over)."""
        claimed = self.update("edit_jobs", job, {"status": "running", "started_at": now(), "call_id": call}, status="eq.queued")
        return claimed[0] if claimed else None

    def finish(self, job: str, status: str, **fields) -> None:
        """The job ended, `status` done or failed, only while it runs; tried three times (M3)."""
        retried(lambda: self.update("edit_jobs", job, {"status": status, "finished_at": now(), **fields}, status="eq.running"))


def retried(write: Callable[[], object]) -> object:
    """`write()`, tried again after each pause of `RETRY_S` when it raises: a moment's outage does not lose a job's end.
    The writes it is given are filtered on the state they move from, so one that did land and is tried again changes
    nothing. The last try's error is raised."""
    for pause in RETRY_S:
        try:
            return write()
        except Exception as error:
            print(f"a write failed, tried again in {pause} s: {error}", flush=True)
            time.sleep(pause)
    return write()


class Stopped(Exception):
    """The job's row is no longer running: the app wrote it failed (X41, X75), so its work is given up."""


class Progress:
    """A running job's stage and progress, written into its row: at most every `every` seconds, at once when
    the stage changes; and, from a thread, a touch whenever nothing has been written for `heartbeat` seconds.
    Use it as a context: the thread runs inside it. A write that fails is logged, not raised: progress is
    never what fails a job. A write that matches no running row (and raises nothing) means the app wrote the
    job failed: from then on `tell` raises `Stopped` (B1)."""

    def __init__(self, rows: Rows, job: str, *, every: float = EVERY_S, heartbeat: float = HEARTBEAT_S):
        self.rows, self.job, self.every, self.heartbeat = rows, job, every, heartbeat
        self.lock = threading.Lock()
        self.latest: tuple[str, float] | None = None
        self.written: tuple[str | None, float] | None = None  # the stage written last, and when
        self.stopping = threading.Event()
        self.stopped = False  # a write matched no running row
        self.beat = threading.Thread(target=self._beat, daemon=True)

    def __enter__(self) -> "Progress":
        self.beat.start()
        return self

    def __exit__(self, *exc) -> None:
        self.stopping.set()
        self.beat.join()

    def tell(self, stage: str, share: float) -> None:
        """Raises Stopped once a write has matched no running row: the job is the app's failed one now."""
        with self.lock:
            self.latest = (stage, share)
            if not self.stopped and not (self.written and self.written[0] == stage and time.monotonic() - self.written[1] < self.every):
                self._write()
            if self.stopped:
                raise Stopped(f"job {self.job} is no longer running: the app wrote it failed")

    def _write(self) -> None:
        fields = {"stage": self.latest[0], "progress": round(self.latest[1], 4)} if self.latest else {"status": "running"}
        try:
            if not self.rows.update("edit_jobs", self.job, fields, status="eq.running"):
                self.stopped = True
                print(f"job {self.job}: its row is no longer running, so it was stopped", flush=True)
        except Exception as error:
            print(f"job {self.job}: progress not written: {error}", flush=True)
        self.written = (self.latest[0] if self.latest else None, time.monotonic())

    def _beat(self) -> None:
        wait = self.heartbeat
        while not self.stopping.wait(wait):
            with self.lock:
                if self.stopped:
                    return
                since = time.monotonic() - self.written[1] if self.written else self.heartbeat
                if since >= self.heartbeat:
                    self._write()
                    wait = self.heartbeat
                else:
                    wait = self.heartbeat - since


# An absolute folder in a message: not one inside an address (after a host, ":" or "/"), whatever container wrote it;
# a file address's folders too (`file:///tmp/…/render.mjs`).
FOLDERS = re.compile(r"(?<![\w.:/-])/(?:[^/\s'\"(),]+/)+")
FILE_ADDRESS = re.compile(r"\bfile://(?=/)")


def plain(error: BaseException) -> str:
    """The error's message for a row (I2): its first line only (render.mjs's marked line, where the error came from
    there), every absolute folder taken out of it, so it names the file and not where a container kept it; its length held."""
    lines = [line.strip() for line in str(error).splitlines() if line.strip()]
    message = FOLDERS.sub("", FILE_ADDRESS.sub("", lines[0])) if lines else type(error).__name__
    return message if len(message) <= LONGEST_MESSAGE else message[: LONGEST_MESSAGE - 1] + "…"


def failed(error: BaseException, job: str, kind: str) -> str:
    """Logs the whole failure, trace and all, and gives the line for the rows (M2): the worker's own words when it raised
    them itself (a Refusal, render.mjs's marked line among them), else that the `kind` of job failed on our side."""
    print(f"job {job} failed:", flush=True)
    traceback.print_exception(error)
    return plain(error) if isinstance(error, Refusal) else OURS[kind]


def given_up(job: str) -> None:
    """A job the app wrote failed (Stopped): nothing more is written; the log says so."""
    print(f"job {job} was stopped (the app wrote it failed): its work is given up, and neither row written again", flush=True)


def guarded(write: Callable[[], object], what: str) -> None:
    """A write of a failure, on its own: one that fails is logged and does not stop the next."""
    try:
        write()
    except Exception as error:
        print(f"{what} not written: {error}", flush=True)


def file_name(name: str) -> str:
    """The name the creator's device gave a take, as a file name in the worker's folder (never a path)."""
    base = Path(str(name).replace("\\", "/")).name
    return base if base not in ("", ".", "..") else "take"


def analyse_job(job_id: str, *, rows: Rows, r2: R2, call: str | None, key: str | None, work: Path, threads: int = 0,
                every: float = EVERY_S, heartbeat: float = HEARTBEAT_S) -> None:
    """Analyses the take of a queued analyse job (Task 5's `analyse`), stores its copies in R2 (a reference's sheet only,
    Task 9c) and writes the
    take `ready` with its facts, words and analysis, and the job `done`. On a failure the job is `failed` with the
    message, and so is the take while it is uploading or analysing; a take already `ready` keeps its analysis (X71).
    Every write to the take is filtered on the job's user as well as its id (I1): a job never writes another
    creator's take. A cancelled job (Modal raises what is not an Exception) is written failed too, and goes on.
    The job's input is `{"reference": true}` for a reference (X98, part 3), analysed in reference mode; none (as Task 7
    of part 2 writes it), `{}` or `{"reference": false}` for a take. Any other is the app's mistake: failed as ours."""
    from media.analyse import analyse  # the speech image's: not in the web address's image

    started = time.monotonic()
    job = rows.claim(job_id, call)
    if job is None:
        print(f"job {job_id}: not queued, so not run", flush=True)
        return
    user, take_id = job["user_id"], job["take_id"]
    work = Path(work)
    try:
        if job["kind"] != "analyse":  # the database knows two kinds
            raise Refusal("this is a render job, not an analyse job")
        reference = reference_of(job.get("input"))
        take = rows.get("edit_takes", take_id, user_id=f"eq.{user}")
        if take is None:
            raise Refusal("the job's take is not there")
        source_key = take_key(user, take_id, "source")
        if take["source_path"] != source_key:
            raise Refusal("the take's source is not where its upload was signed for")
        with Progress(rows, job_id, every=every, heartbeat=heartbeat) as progress:
            progress.tell("fetching", 0.0)
            source = work / "take" / file_name(take["name"])
            stored = r2.size(source_key)
            if stored is None:
                raise Refusal(f"{source.name} is not in storage: its upload did not arrive")
            if stored != take["bytes"]:
                raise Refusal(f"{source.name} did not arrive whole: {stored} of its {take['bytes']} bytes are stored")
            r2.download(source_key, source)
            out = work / "out"
            found = analyse(source, out, key, lambda stage, share: progress.tell(stage, share * WORK), threads=threads, reference=reference)
            progress.tell("storing", WORK)
            files = {}
            # A take's copies; a reference's sheet only (Task 9c): it is never rendered, and is dropped once read.
            for kind, content_type in (REFERENCE_FILES if reference else COPIES).items():
                files[kind] = take_key(user, take_id, found["files"][kind])
                r2.upload(out / found["files"][kind], files[kind], content_type)
        rest = {name: value for name, value in found.items() if name not in ("facts", "ms", "words", "files")}
        retried(lambda: rows.update("edit_takes", take_id, {"status": "ready", "error": None, "facts": {**found["facts"], "ms": found["ms"]},
                                                            "words": found["words"], "analysis": {"files": files, **rest}}, user_id=f"eq.{user}"))
        if reference:
            # Nothing reads a reference's source again once its analysis and sheet are written (X96): someone else's whole
            # video goes now, not when the app reads and drops the rest. A delete that fails is the app's sweep's to finish.
            try:
                r2.delete(source_key)
            except Exception as error:
                print(f"reference {take_id}: its source could not be deleted, left to the app's sweep: {error}", flush=True)
        rows.finish(job_id, "done", stage=None, progress=1, result={"take": take_id, "seconds": round(time.monotonic() - started, 1)})
    except Stopped:
        given_up(job_id)
    except BaseException as error:
        message = failed(error, job_id, "analyse")
        if take_id:
            guarded(lambda: rows.update("edit_takes", take_id, {"status": "failed", "error": message}, user_id=f"eq.{user}",
                                        status="in.(uploading,analysing)"), f"take {take_id}")
        guarded(lambda: rows.finish(job_id, "failed", error=message), f"job {job_id}")
        if not isinstance(error, Exception):
            raise


def reference_of(asked: object) -> bool:
    """Whether an analyse job's input says its take is a reference: `{"reference": true}`. No input, `{}` or
    `{"reference": false}` is a take; TypeError for any other, which is the app's to fix, not the creator's to read."""
    given = asked or {}
    reference = given.get("reference", False) if isinstance(given, dict) else None
    if not isinstance(reference, bool):
        raise TypeError(f"the job's input {asked!r}: its reference is not true or false")
    return reference


def addresses(edit: dict, user: str, r2: R2) -> dict[str, str]:
    """A signed read for every file of the edit kept in R2, by its id; each must be one of the creator's takes.
    Kit files are found under the kit's folder and need none; each kit path is held to the app's own rule (`KitPath`),
    so none reaches out of the kit (M1)."""
    urls = {}
    for asset in edit.get("assets", []):
        at = asset.get("at") or {}
        if "kit" in at:
            kit = at["kit"]
            if not (isinstance(kit, str) and len(kit) <= LONGEST_KIT_PATH and KIT_PATH.fullmatch(kit)):
                raise Refusal(f'the file "{asset.get("id")}" is not one of the kit\'s files')
            continue
        path = str(at.get("path", ""))
        parts = path.split("/")
        if at.get("bucket") != r2.bucket or parts[:3] != ["u", user, "takes"] or any(part in ("", ".", "..") for part in parts):
            raise Refusal(f'the file "{asset.get("id")}" is not one of this creator\'s takes')
        urls[asset["id"]] = r2.sign(path)
    return urls


def render_job(job_id: str, *, rows: Rows, r2: R2, call: str | None, render: Callable, work: Path,
               every: float = EVERY_S, heartbeat: float = HEARTBEAT_S) -> None:
    """Renders the edit of a queued render job (`render`: Task 2's `render_film`), stores the film and its
    cover in R2 and writes the job `done` with `{path, cover, ms, lufs, truePeak}`; or `failed`, with the message
    (a cancelled job too, which then goes on). The job's input is `{"edit": <edit>, "cover": <the cover's film
    frame, or none for the first>}`."""
    job = rows.claim(job_id, call)
    if job is None:
        print(f"job {job_id}: not queued, so not run", flush=True)
        return
    user, work = job["user_id"], Path(work)
    try:
        if job["kind"] != "render":
            raise Refusal("this is an analyse job, not a render job")
        asked = job.get("input") or {}
        edit = asked.get("edit")
        if not isinstance(edit, dict):
            raise Refusal("the job's input holds no edit")
        with Progress(rows, job_id, every=every, heartbeat=heartbeat) as progress:
            props = {"edit": edit, "urls": addresses(edit, user, r2)}
            film = render(props, asked.get("cover") or 0, lambda stage, share: progress.tell(stage, share * WORK), work)
            progress.tell("storing", WORK)
            path, cover = film_key(user, job_id, "mp4"), film_key(user, job_id, "jpg")
            r2.upload(film["mp4"], path, "video/mp4")
            r2.upload(film["jpg"], cover, "image/jpeg")
        rows.finish(job_id, "done", stage=None, progress=1, result={
            "path": path, "cover": cover, "ms": round(film["frames"] * 1000 / edit["stage"]["fps"]),
            "lufs": film["lufs"], "truePeak": film["truePeak"]})
    except Stopped:
        given_up(job_id)
    except BaseException as error:
        message = failed(error, job_id, "render")
        guarded(lambda: rows.finish(job_id, "failed", error=message), f"job {job_id}")
        if not isinstance(error, Exception):
            raise


def allowed(authorization: str | None, secret: str) -> bool:
    """Whether the request carries the shared secret (`Authorization: Bearer <EDIT_WORKER_SECRET>`), compared in
    constant time; never when the worker has none."""
    return bool(secret) and hmac.compare_digest((authorization or "").encode(), f"Bearer {secret}".encode())


def start(body: bytes, authorization: str | None, *, secret: str, rows: Rows, spawn: Callable[[str, str], str]) -> tuple[int, dict]:
    """The web address's work (X41, X64): the shared secret checked first (`web` checks it before it reads the
    body, then gives the body here), then the job's row; a queued job's function (by the row's kind) spawned,
    and its call written. Status and body."""
    if not allowed(authorization, secret):
        return 401, {"error": "not allowed"}
    try:
        asked = json.loads(body)
        if not isinstance(asked, dict) or not isinstance(asked.get("job"), str):
            raise ValueError
        job_id = str(uuid.UUID(asked["job"]))
    except ValueError:
        return 400, {"error": 'the body is {"job": "<the job\'s id>"}'}
    job = rows.job(job_id)
    if job is None or job["status"] != "queued":
        return 404, {"error": f"no queued job {job_id}"}
    call = spawn(job["kind"], job_id)
    rows.update("edit_jobs", job_id, {"call_id": call}, call_id="is.null")  # the call that claims it writes its own
    return 202, {"call": call}


# The stills (part 3, Task 6): POST /stills {"user": <id>, "edit": <an edit>, "frames": [<frame>, …], "sheet"?: <boolean>}.
MOST_STILLS, MOST_ON_A_SHEET = 6, 12
STILL = (540, 960)  # each still: half the stage
CELL = (270, 480)  # each frame on a sheet: a quarter of the stage
ACROSS = 4  # frames across a sheet
STILLS_BODY = 'the body is {"user": "<the creator\'s id>", "edit": <an edit>, "frames": [<frame>, …], "sheet": <true or false, or left out>}'
STILLS_FRAMES = f"frames are 1 to {MOST_STILLS} whole numbers from 0, or 1 to {MOST_ON_A_SHEET} on a sheet"
STILLS_ASSETS = 'the edit\'s "assets" are not a list of files, each with its "id" and its "at"'
STILLS_OURS = "the stills failed on our side; try again"
# JPEG quality 85 as libjpeg makes it: the JPEG standard's example tables (ITU-T T.81, Annex K), row by row, scaled for the
# quality as libjpeg scales them (jcparam.c). ffmpeg's encoder has no such setting, so it is given the tables themselves, which
# at `-q:v 8` it writes as given; only the DC step is its own, 8 where libjpeg's is 5 (test_store.py reads them back).
QUALITY = 85
ANNEX_K_LUMA = (16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
                14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
                49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99)
ANNEX_K_CHROMA = (17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99,
                  47, 66, 99, 99, 99, 99, 99, 99) + (99,) * 32


def scaled(table: tuple[int, ...], quality: int) -> str:
    """A quantization table as libjpeg makes it for `quality`, as ffmpeg's options take one."""
    scale = 5000 // quality if quality < 50 else 200 - 2 * quality
    return ",".join(str(min(255, max(1, (q * scale + 50) // 100))) for q in table)


# How each JPEG is encoded: 4:2:0 in full range (JFIF's), libjpeg's tables at quality 85. On ffmpeg 5.1 and 8.
JPEG = ("-pix_fmt", "yuvj420p", "-q:v", "8", "-intra_matrix", scaled(ANNEX_K_LUMA, QUALITY),
        "-chroma_intra_matrix", scaled(ANNEX_K_CHROMA, QUALITY))


def stills_asked(body: bytes) -> tuple[str, dict, list[int], bool]:
    """The creator (their id as the rows write it), the edit, the frames and whether they come on a sheet; a ValueError
    with the line to answer when the body is not that, the edit's files included (M1)."""
    try:
        asked = json.loads(body)
        if not isinstance(asked, dict) or not isinstance(asked.get("user"), str) or not isinstance(asked.get("edit"), dict):
            raise ValueError
        user = str(uuid.UUID(asked["user"]))
        sheet = asked.get("sheet", False)
        if not isinstance(sheet, bool):
            raise ValueError
    except ValueError:
        raise ValueError(STILLS_BODY) from None
    frames = asked.get("frames")
    most = MOST_ON_A_SHEET if sheet else MOST_STILLS
    # type() and not isinstance(): true and false are ints to Python, and no frames.
    if not (isinstance(frames, list) and 1 <= len(frames) <= most and all(type(frame) is int and frame >= 0 for frame in frames)):
        raise ValueError(STILLS_FRAMES)
    # What `addresses` reads of the edit (the app sends edits that passed its schema; anything else is a body, not our failure).
    assets = asked["edit"].get("assets")
    if not (isinstance(assets, list) and all(isinstance(asset, dict) and isinstance(asset.get("id"), str) and isinstance(asset.get("at"), dict)
                                              for asset in assets)):
        raise ValueError(STILLS_ASSETS)
    return user, asked["edit"], frames, sheet


def numbered(pngs: list[bytes], folder: Path) -> Path:
    """The PNGs in a folder as 000.png, 001.png and on, in order: a sequence ffmpeg reads as one input."""
    folder.mkdir(parents=True, exist_ok=True)
    for i, png in enumerate(pngs):
        (folder / f"{i:03d}.png").write_bytes(png)
    return folder


def ffmpeg(*args: str, about: str) -> None:
    run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *args], about)


def jpegs(pngs: list[bytes], work: Path) -> list[bytes]:
    """Each frame as a JPEG of half the stage, in order: one run of ffmpeg for them all."""
    folder = numbered(pngs, work / "stills")
    ffmpeg("-framerate", "1", "-i", str(folder / "%03d.png"), "-vf", f"scale={STILL[0]}:{STILL[1]}:flags=lanczos",
           "-fps_mode", "passthrough", *JPEG, "-start_number", "0", str(folder / "%03d.jpg"), about="the stills")
    return [(folder / f"{i:03d}.jpg").read_bytes() for i in range(len(pngs))]


def sheet_of(pngs: list[bytes], work: Path) -> bytes:
    """The frames on one JPEG, in order, `ACROSS` to a row (fewer when there are fewer), each a quarter of the stage; the
    cells of the last row that no frame fills are black."""
    folder = numbered(pngs, work / "sheet")
    across, down = min(ACROSS, len(pngs)), -(-len(pngs) // ACROSS)
    ffmpeg("-framerate", "1", "-i", str(folder / "%03d.png"),
           "-vf", f"scale={CELL[0]}:{CELL[1]}:flags=lanczos,tile={across}x{down}:color=black",
           "-frames:v", "1", *JPEG, "-update", "1", str(folder / "sheet.jpg"), about="the sheet")
    return (folder / "sheet.jpg").read_bytes()


def stills_request(body: bytes, authorization: str | None, *, secret: str, r2: R2, draw: Callable[[dict, list[int]], list[bytes]],
                   work: Path) -> tuple[int, dict]:
    """The stills route's work, in the render image (part 3, Task 6). The shared secret first (`web` checks it before it reads
    the body, then sends both here): 401. A body it cannot take: 400. Then the edit's files are signed as a render job's are
    (`addresses`, X63), its frames drawn by `draw(props, frames)` (PNGs in the order asked: render.mjs's `stills`, which holds
    each frame to the film's length) and given back as JPEGs: `{"stills": [{"frame", "jpeg"}]}`, each of half the stage, or
    with `sheet`, `{"sheet": <one JPEG>}`, base64 either way. A file refused, or anything the worker said itself (render.mjs's
    marked line: a frame past the film's end, a file that cannot be read): 422 with its line. Anything else is ours: 500, and
    its words go to the log (M2). Status and body."""
    if not allowed(authorization, secret):
        return 401, {"error": "not allowed"}
    try:
        user, edit, frames, sheet = stills_asked(body)
    except ValueError as error:
        return 400, {"error": str(error)}
    try:
        pngs = draw({"edit": edit, "urls": addresses(edit, user, r2)}, frames)
        if len(pngs) != len(frames):
            raise RuntimeError(f"{len(frames)} frames asked, {len(pngs)} drawn")
        if sheet:
            return 200, {"sheet": base64.b64encode(sheet_of(pngs, Path(work))).decode()}
        return 200, {"stills": [{"frame": frame, "jpeg": base64.b64encode(jpeg).decode()} for frame, jpeg in zip(frames, jpegs(pngs, Path(work)))]}
    except Refusal as error:
        return 422, {"error": plain(error)}
    except Exception as error:
        print("the stills failed:", flush=True)
        traceback.print_exception(error)
        return 500, {"error": STILLS_OURS}
