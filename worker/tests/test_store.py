"""The worker's outer layer (`store.py`): R2's keys and addresses, the rows over PostgREST, progress
throttled with a heartbeat, the two jobs by id and the web address's check.

R2 and Supabase cannot be reached from here, so they are stood in (`postgrest.py`: a PostgREST on
127.0.0.1 and a folder for the bucket), and so are Modal's spawn and the render (render_film needs
Modal's containers). Everything else runs for real: boto3 signs addresses as it will, the analysis
makes its copies and measures them (its words and faces stood in, as in test_analyse.py), and time is
real time, made short. The end-to-end run on Modal proves the boundaries (plan, Task 6).
"""

import base64
import json
import subprocess
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

import store
from helpers import a_still, ffmpeg, streams, talking_head
from media.refusal import Refusal
from media.words import nothing
from postgrest import Bucket, PostgREST
from render import script

KEY = "service-key-for-the-stand-in"
USER, OTHER = "00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b"
TAKE, JOB = "10000000-0000-4000-8000-00000000000a", "20000000-0000-4000-8000-00000000000a"


@pytest.fixture
def supabase():
    stand_in = PostgREST(KEY)
    yield stand_in
    stand_in.close()


@pytest.fixture
def rows(supabase) -> store.Rows:
    return store.Rows(supabase.url, KEY)


def a_job(supabase: PostgREST, kind: str = "analyse", status: str = "queued", **fields) -> dict:
    return supabase.put("edit_jobs", {"id": JOB, "user_id": USER, "kind": kind, "take_id": TAKE if kind == "analyse" else None,
                                      "input": None, "status": status, "stage": None, "progress": 0, "result": None, "error": None,
                                      "call_id": None, "started_at": None, "finished_at": None, **fields})


def a_take(supabase: PostgREST, bucket: Bucket, source: Path | None, name: str = "IMG_0001.MOV", **fields) -> dict:
    path = store.take_key(USER, TAKE, "source")
    if source:
        bucket.upload(source, path, "video/quicktime")
    return supabase.put("edit_takes", {"id": TAKE, "user_id": USER, "status": "analysing", "name": name,
                                       "bytes": source.stat().st_size if source else 1000, "source_path": path,
                                       "facts": None, "words": None, "analysis": None, "error": None, **fields})


# R2 (X43)

def test_the_keys_are_the_plan_s():
    assert store.take_key(USER, TAKE, "source") == f"u/{USER}/takes/{TAKE}/source"
    assert store.take_key(USER, TAKE, "full.mp4") == f"u/{USER}/takes/{TAKE}/full.mp4"
    assert store.film_key(USER, JOB, "mp4") == f"u/{USER}/films/{JOB}.mp4"


def test_r2_is_reached_at_the_eu_address_and_signs_reads_for_two_hours():
    """boto3 signs locally, so this is the real signature, made with made-up keys."""
    r2 = store.R2("0123abcd", "key-id", "key-secret", "edit-media")
    assert r2.client.meta.endpoint_url == "https://0123abcd.eu.r2.cloudflarestorage.com"
    assert r2.client.meta.region_name == "auto"
    url = urlsplit(r2.sign(f"u/{USER}/takes/{TAKE}/full.mp4"))
    query = parse_qs(url.query)
    assert (url.scheme, url.hostname, url.path) == ("https", "0123abcd.eu.r2.cloudflarestorage.com", f"/edit-media/u/{USER}/takes/{TAKE}/full.mp4")
    assert query["X-Amz-Expires"] == ["7200"] and query["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
    assert query["X-Amz-Credential"][0].startswith("key-id/") and query["X-Amz-Credential"][0].endswith("/auto/s3/aws4_request")
    assert len(query["X-Amz-Signature"][0]) == 64


def test_r2_is_made_from_the_secret_s_names():
    env = {"R2_ACCOUNT_ID": "0123abcd", "R2_ACCESS_KEY_ID": "id", "R2_SECRET_ACCESS_KEY": "secret", "R2_BUCKET": "edit-media"}
    r2 = store.R2.from_env(env)
    assert r2.bucket == "edit-media" and r2.client.meta.endpoint_url == "https://0123abcd.eu.r2.cloudflarestorage.com"
    with pytest.raises(KeyError, match="R2_BUCKET"):
        store.R2.from_env({k: v for k, v in env.items() if k != "R2_BUCKET"})


# The rows (X41, X42)

def test_rows_are_read_and_written_with_the_service_key_in_both_headers(supabase, rows):
    a_job(supabase)
    assert rows.job(JOB)["status"] == "queued"
    assert rows.job("30000000-0000-4000-8000-000000000000") is None
    with pytest.raises(RuntimeError, match="401"):
        store.Rows(supabase.url, "another-key").job(JOB)


def test_a_job_is_claimed_once(supabase, rows):
    a_job(supabase)
    claimed = rows.claim(JOB, "fc-1")
    assert (claimed["status"], claimed["call_id"]) == ("running", "fc-1") and claimed["started_at"]
    assert rows.claim(JOB, "fc-2") is None
    assert supabase.row("edit_jobs", JOB)["call_id"] == "fc-1"
    assert supabase.patches()[0].filters == {"id": f"eq.{JOB}", "status": "eq.queued"}


def test_a_job_is_finished_only_while_it_runs(supabase, rows):
    a_job(supabase, status="running")
    rows.finish(JOB, "done", progress=1, result={"x": 1})
    job = supabase.row("edit_jobs", JOB)
    assert (job["status"], job["progress"], job["result"]) == ("done", 1, {"x": 1}) and job["finished_at"]
    rows.finish(JOB, "failed", error="late")
    assert supabase.row("edit_jobs", JOB)["status"] == "done"


# Progress (X41): at most every `every` seconds, at once at a change of stage, and a heartbeat

def written(supabase: PostgREST) -> list[tuple]:
    return [(x.body.get("stage"), x.body.get("progress")) for x in supabase.patches()]


def test_progress_is_written_at_most_every_interval_but_always_at_a_change_of_stage(supabase, rows):
    a_job(supabase, status="running")
    with store.Progress(rows, JOB, every=0.5, heartbeat=60) as progress:
        progress.tell("copies", 0.0)
        progress.tell("copies", 0.1)  # too soon: not written
        progress.tell("words", 0.2)  # a new stage: written at once
        progress.tell("words", 0.25)  # too soon
        time.sleep(1.5)
        progress.tell("words", 0.3)  # the interval is up
        progress.tell("words", 0.35)  # too soon again
    assert written(supabase) == [("copies", 0.0), ("words", 0.2), ("words", 0.3)]
    assert all(x.filters == {"id": f"eq.{JOB}", "status": "eq.running"} for x in supabase.patches())
    assert supabase.row("edit_jobs", JOB)["progress"] == 0.3


def test_a_heartbeat_touches_the_row_while_a_long_stage_runs_and_stops_with_the_job(supabase, rows):
    a_job(supabase, status="running")
    with store.Progress(rows, JOB, every=0.05, heartbeat=0.5) as progress:
        progress.tell("words", 0.4)
        time.sleep(3.2)  # a long stage: nothing told; touches due every 0.5 s
    touches = supabase.patches()[1:]
    # As the gaps' bounds allow in 3.2 s: at least one every 1.5 s, at most one every 0.45 s.
    assert 2 <= len(touches) <= 7, [round(x.at, 2) for x in supabase.patches()]
    gaps = [b.at - a.at for a, b in zip(supabase.patches(), supabase.patches()[1:])]
    assert all(0.45 <= gap <= 1.5 for gap in gaps), gaps  # never sooner than the interval, never three times later
    assert all(x.body == {"stage": "words", "progress": 0.4} and x.filters["status"] == "eq.running" for x in touches)
    ended = len(supabase.patches())
    time.sleep(1.5)
    assert len(supabase.patches()) == ended  # no touch once the job's thread has left


def test_the_heartbeat_waits_for_a_write_it_was_not_part_of(supabase, rows):
    """A told progress counts as a touch: the heartbeat comes a whole interval after the last write."""
    a_job(supabase, status="running")
    with store.Progress(rows, JOB, every=0.05, heartbeat=1.5) as progress:
        progress.tell("drawing", 0.1)
        time.sleep(1.2)
        progress.tell("drawing", 0.2)
        time.sleep(1.0)  # 2.2 s from the first write, past a heartbeat counted from it; 1.0 s from the second
    assert written(supabase) == [("drawing", 0.1), ("drawing", 0.2)]


def stopped_by_the_app(supabase: PostgREST) -> None:
    """What the app writes into a job it reads as stopped (X41, X75): failed, and so no longer running."""
    with supabase.lock:
        supabase.tables["edit_jobs"][JOB].update(status="failed", error="the worker stopped")


def test_a_write_that_matches_no_row_tells_the_job_it_was_stopped(supabase, rows):
    """B1(b): the app wrote the job failed, so a progress write matches no running row (and PostgREST raises nothing).
    From then on, telling progress raises Stopped; the heartbeat finds it too."""
    a_job(supabase, status="running")
    with store.Progress(rows, JOB, every=0.05, heartbeat=60) as progress:
        progress.tell("copies", 0.1)
        stopped_by_the_app(supabase)
        with pytest.raises(store.Stopped):
            progress.tell("words", 0.3)  # a new stage: written, matched nothing
        with pytest.raises(store.Stopped):
            progress.tell("words", 0.31)  # too soon to write, still stopped
    a_job(supabase, status="running")
    with store.Progress(rows, JOB, every=0.05, heartbeat=0.3) as progress:
        progress.tell("drawing", 0.1)
        stopped_by_the_app(supabase)
        time.sleep(1.0)  # the heartbeat's touch matches nothing
        with pytest.raises(store.Stopped):
            progress.tell("drawing", 0.1)
    assert supabase.row("edit_jobs", JOB)["error"] == "the worker stopped"


# The analyse job

@pytest.fixture
def bucket(tmp_path: Path) -> Bucket:
    folder = tmp_path / "bucket"
    folder.mkdir()
    return Bucket(folder)


def test_an_analyse_job_stores_the_copies_and_writes_the_take_and_the_job(stood_in, supabase, rows, bucket, tmp_path: Path):
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    a_take(supabase, bucket, source)
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key="a-key", work=tmp_path / "work", threads=3)

    job, take = supabase.row("edit_jobs", JOB), supabase.row("edit_takes", TAKE)
    assert (job["status"], job["progress"], job["error"], job["call_id"]) == ("done", 1, None, "fc-1")
    assert job["started_at"] and job["finished_at"] and job["result"]["take"] == TAKE
    assert take["status"] == "ready" and take["error"] is None
    # The copies in R2 under the take's keys (X43), and nothing else: no analysis.json, no 16 kHz sound.
    keys = {kind: store.take_key(USER, TAKE, name) for kind, name in [("full", "full.mp4"), ("preview", "preview.mp4"), ("poster", "poster.jpg")]}
    uploaded = {key: kind for key, kind in bucket.types.items() if key != take["source_path"]}
    assert uploaded == {keys["full"]: "video/mp4", keys["preview"]: "video/mp4", keys["poster"]: "image/jpeg"}
    stored = {path.relative_to(bucket.folder).as_posix() for path in bucket.folder.rglob("*") if path.is_file()}
    assert stored == {take["source_path"], *keys.values()}
    # The row: the facts with the stored length, the words, and the rest of the analysis with the copies' keys.
    assert set(take["facts"]) == {"source", "full", "preview", "ms"} and abs(take["facts"]["ms"] - 3000) <= 50
    assert take["facts"]["full"]["w"] == 720 and take["facts"]["full"]["sound"] is True
    assert take["words"] == []
    assert take["analysis"]["files"] == keys
    assert set(take["analysis"]) == {"files", "language", "untimed", "apart", "gaveWay", "trimmed", "dropped", "pauses", "faces", "cuts", "picture",
                                     "loudness", "fellBack"}
    assert take["analysis"]["cuts"] == [] and len(take["analysis"]["picture"]) == 6
    assert take["analysis"]["loudness"]["lufs"] == pytest.approx(-23, abs=0.2)
    # The speech step was given the key and the cores; a job with no input (as Task 7 of part 2 writes one) is a take's, not a reference's.
    assert [(key, threads, reference) for _, _, key, threads, reference in stood_in["words"]] == [("a-key", 3, False)]
    # Progress: every stage written as it began, the share only going forward, and the end written with the job.
    stages = [stage for stage, _ in written(supabase)[1:-1]]  # between the claim and the end
    assert [s for i, s in enumerate(stages) if i == 0 or stages[i - 1] != s] == ["fetching", "copies", "words", "faces", "cuts", "picture", "loudness",
                                                                                 "storing"]
    shares = [share for _, share in written(supabase)[1:-1]]
    assert shares == sorted(shares) and all(0 <= share < 1 for share in shares)


def test_a_source_of_another_size_than_the_upload_fails_the_take_and_the_job(stood_in, supabase, rows, bucket, tmp_path: Path):
    """The ledger (Task 3): an upload cut short. Its size in R2 is held to the size the upload was signed for."""
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    a_take(supabase, bucket, source, bytes=source.stat().st_size + 4096)
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    job, take = supabase.row("edit_jobs", JOB), supabase.row("edit_takes", TAKE)
    message = f"IMG_0001.MOV did not arrive whole: {source.stat().st_size} of its {source.stat().st_size + 4096} bytes are stored"
    assert (job["status"], job["error"]) == ("failed", message) and job["finished_at"]
    assert (take["status"], take["error"]) == ("failed", message)
    assert stood_in["words"] == [] and set(bucket.types) == {take["source_path"]}


def test_a_source_that_never_arrived_fails_saying_so(stood_in, supabase, rows, bucket, tmp_path: Path):
    a_take(supabase, bucket, None)
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert supabase.row("edit_jobs", JOB)["error"] == "IMG_0001.MOV is not in storage: its upload did not arrive"


def test_a_failed_analysis_writes_its_plain_message_and_logs_the_trace(stood_in, supabase, rows, bucket, tmp_path: Path, capsys):
    source = tmp_path / "clip.webm"
    ffmpeg("-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30:duration=1", "-c:v", "libvpx-vp9", "-deadline", "realtime", str(source))
    a_take(supabase, bucket, source, name="../../clip.webm")
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    job, take = supabase.row("edit_jobs", JOB), supabase.row("edit_takes", TAKE)
    assert job["error"] == take["error"] == "clip.webm is not an MP4 or QuickTime file (it is Matroska / WebM)"
    assert (job["status"], job["stage"]) == ("failed", "copies")  # where it stopped stays in the row
    assert "Traceback" in capsys.readouterr().err
    # The name as the device gave it is a file name inside the worker's folder, never a path out of it.
    assert list((tmp_path / "work").rglob("clip.webm")) == [tmp_path / "work" / "take" / "clip.webm"]


def test_a_failure_the_worker_did_not_raise_itself_is_told_as_ours_and_its_words_go_to_the_log(stood_in, supabase, rows, bucket,
                                                                                                 tmp_path: Path, capsys):
    """M2: what a tool says (here ffprobe's words on a file that is no video) is not the creator's to read. The rows say
    the analysis failed on our side; the log has the tool's words, naming the file."""
    source = tmp_path / "notes.mov"
    source.write_text("not a video\n" * 100)
    a_take(supabase, bucket, source, name="notes.mov")
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    job, take = supabase.row("edit_jobs", JOB), supabase.row("edit_takes", TAKE)
    assert job["error"] == take["error"] == "the analysis failed on our side; try again"
    assert (job["status"], take["status"]) == ("failed", "failed")
    assert "notes.mov: ffprobe failed" in capsys.readouterr().err


def test_a_job_that_is_not_queued_is_not_run(stood_in, supabase, rows, bucket, tmp_path: Path):
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    a_take(supabase, bucket, source)
    a_job(supabase, status="running", call_id="fc-0")
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert supabase.row("edit_jobs", JOB)["call_id"] == "fc-0" and supabase.row("edit_takes", TAKE)["status"] == "analysing"
    assert stood_in["words"] == [] and len(supabase.patches()) == 1  # the claim, which matched nothing


def test_a_job_never_writes_another_creator_s_take(stood_in, supabase, rows, bucket, tmp_path: Path):
    """The review's case (I1): a job of one creator naming another's take leaves that take as it was, and fails."""
    theirs = a_take(supabase, bucket, None, user_id=OTHER, status="ready", analysis={"files": {}}, source_path=store.take_key(OTHER, TAKE, "source"))
    before = supabase.row("edit_takes", TAKE)
    a_job(supabase)  # USER's job, naming the take
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert supabase.row("edit_takes", TAKE) == before and before["status"] == theirs["status"] == "ready"
    assert (supabase.row("edit_jobs", JOB)["status"], supabase.row("edit_jobs", JOB)["error"]) == ("failed", "the job's take is not there")
    assert all(x.filters.get("user_id") == f"eq.{USER}" for x in supabase.patches("edit_takes")) and stood_in["words"] == []


def test_a_take_s_source_is_where_its_upload_was_signed_for(stood_in, supabase, rows, bucket, tmp_path: Path):
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    elsewhere = f"u/{USER}/takes/30000000-0000-4000-8000-000000000000/source"
    bucket.upload(source, elsewhere, "video/quicktime")
    a_take(supabase, bucket, None, source_path=elsewhere, bytes=source.stat().st_size)
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert supabase.row("edit_jobs", JOB)["error"] == "the take's source is not where its upload was signed for" and stood_in["words"] == []


@pytest.mark.parametrize(("run", "kind", "other"), [("analyse_job", "render", "analyse"), ("render_job", "analyse", "render")])
def test_a_job_of_the_other_kind_is_failed_not_left_running(supabase, rows, bucket, tmp_path: Path, run: str, kind: str, other: str):
    a_take(supabase, bucket, None, status="ready")
    a_job(supabase, kind=kind, input={"edit": an_edit(store.take_key(USER, TAKE, "full.mp4"))})
    given = {"render": Render()} if run == "render_job" else {"key": None}
    getattr(store, run)(JOB, rows=rows, r2=bucket, call="fc-1", work=tmp_path / "work", **given)
    job = supabase.row("edit_jobs", JOB)
    assert (job["status"], job["error"]) == ("failed", f"this is a {kind} job, not an {other} job" if other == "analyse" else f"this is an {kind} job, not a {other} job")
    assert supabase.row("edit_takes", TAKE)["status"] == "ready"


def test_a_failed_analysis_of_a_ready_take_keeps_the_take_ready(stood_in, supabase, rows, bucket, tmp_path: Path):
    """X71: a take analysed once stays usable; only the job that analysed it again fails."""
    a_take(supabase, bucket, None, status="ready", analysis={"files": {"full": "kept"}})
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    take = supabase.row("edit_takes", TAKE)
    assert (take["status"], take["analysis"], take["error"]) == ("ready", {"files": {"full": "kept"}}, None)
    assert supabase.row("edit_jobs", JOB)["status"] == "failed"


@pytest.mark.parametrize(("before", "after"), [("analysing", "failed"), ("ready", "ready")])
def test_a_take_over_ten_minutes_fails_its_job_with_a_plain_message_and_makes_no_copy(stood_in, supabase, rows, bucket, tmp_path: Path,
                                                                                     before: str, after: str):
    """X56 in the worker: refused after its probe, stored as any failure is (X71: a ready take stays ready)."""
    source = tmp_path / "long.mov"
    ffmpeg("-f", "lavfi", "-i", "color=c=gray:size=64x64:rate=1:duration=601", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(source))
    a_take(supabase, bucket, source, name="IMG_0002.MOV", status=before)
    a_job(supabase)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    job, take = supabase.row("edit_jobs", JOB), supabase.row("edit_takes", TAKE)
    assert (job["status"], job["stage"], job["error"]) == ("failed", "copies", "IMG_0002.MOV is longer than 10 minutes (it is 10:01)")
    assert (take["status"], take["error"]) == (after, job["error"] if after == "failed" else None)
    assert set(bucket.types) == {take["source_path"]} and stood_in["words"] == [] and stood_in["faces"] == []


@pytest.mark.parametrize(("given", "reference"), [({"reference": True}, True), ({"reference": False}, False), ({}, False)],
                         ids=["a reference", "said not to be", "no word of it"])
def test_the_job_s_input_says_whether_its_take_is_a_reference(stood_in, supabase, rows, bucket, tmp_path: Path, given: dict, reference: bool):
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    a_take(supabase, bucket, source)
    a_job(supabase, input=given)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert supabase.row("edit_jobs", JOB)["status"] == "done"
    assert [x[4] for x in stood_in["words"]] == [reference]
    # Task 9c: a reference stores its sheet only, and its row names it; a take its three copies.
    take = supabase.row("edit_takes", TAKE)
    uploaded = {key: kind for key, kind in bucket.types.items() if key != take["source_path"]}
    stored = {path.relative_to(bucket.folder).as_posix() for path in bucket.folder.rglob("*") if path.is_file()}
    if reference:
        assert uploaded == {store.take_key(USER, TAKE, "sheet.jpg"): "image/jpeg"}
        assert take["analysis"]["files"] == {"sheet": store.take_key(USER, TAKE, "sheet.jpg")} and "full" not in take["facts"]
        assert take["analysis"]["sheet"]["file"] == "sheet.jpg" and take["analysis"]["loudness"] is None
        # X96: its source goes once its analysis and sheet are written; the sheet is all that is left of it.
        assert bucket.deleted == [take["source_path"]] and stored == {store.take_key(USER, TAKE, "sheet.jpg")}
    else:
        assert sorted(uploaded.values()) == ["image/jpeg", "video/mp4", "video/mp4"] and set(take["analysis"]["files"]) == {"full", "preview", "poster"}
        assert bucket.deleted == [] and take["source_path"] in stored  # a creator's own take keeps its source


def test_a_reference_whose_source_cannot_be_deleted_is_still_ready_and_says_so_in_the_log(stood_in, supabase, rows, bucket, tmp_path: Path, monkeypatch, capsys):
    """The delete is the last of the analysis's work: one R2 refuses leaves the reference read, its source to the app's sweep."""
    a_take(supabase, bucket, talking_head(tmp_path, a_still(tmp_path), name="head.mov"))
    a_job(supabase, input={"reference": True})

    def refused(key: str) -> None:
        raise RuntimeError("R2 answered 500")

    monkeypatch.setattr(bucket, "delete", refused)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    take = supabase.row("edit_takes", TAKE)
    assert supabase.row("edit_jobs", JOB)["status"] == "done" and take["status"] == "ready"
    assert bucket.size(take["source_path"]) is not None
    assert f"reference {TAKE}: its source could not be deleted, left to the app's sweep: R2 answered 500" in capsys.readouterr().out


def test_a_reference_over_three_minutes_fails_its_job_with_a_plain_message_and_makes_no_copy(stood_in, supabase, rows, bucket, tmp_path: Path):
    """X98 through the job: its input says it is a reference, so it is held to three minutes."""
    source = tmp_path / "outlier.mov"
    ffmpeg("-f", "lavfi", "-i", "color=c=gray:size=64x64:rate=1:duration=181", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(source))
    a_take(supabase, bucket, source, name="IMG_0002.MOV")
    a_job(supabase, input={"reference": True})
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    job, take = supabase.row("edit_jobs", JOB), supabase.row("edit_takes", TAKE)
    assert (job["status"], job["stage"], job["error"]) == ("failed", "copies", "IMG_0002.MOV is longer than 3 minutes (it is 3:01)")
    assert (take["status"], take["error"]) == ("failed", job["error"])
    assert set(bucket.types) == {take["source_path"]} and stood_in["words"] == []


@pytest.mark.parametrize("given", [{"reference": "yes"}, {"reference": 1}, ["reference"]], ids=["a word", "a number", "a list"])
def test_an_input_that_does_not_say_true_or_false_fails_on_our_side_before_anything_is_fetched(stood_in, supabase, rows, bucket, tmp_path: Path,
                                                                                               capsys, given):
    """What the app writes is its own: an input it should not have written is ours to fix, not the creator's to read (M2)."""
    a_take(supabase, bucket, talking_head(tmp_path, a_still(tmp_path), name="head.mov"))
    a_job(supabase, input=given)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    job = supabase.row("edit_jobs", JOB)
    assert (job["status"], job["error"], job["stage"]) == ("failed", "the analysis failed on our side; try again", None)
    assert "is not true or false" in capsys.readouterr().err and not (tmp_path / "work").exists()


class Cancelled(BaseException):
    """What Modal raises in a function whose input was cancelled: not an Exception."""


def test_a_cancelled_analysis_still_writes_both_rows_failed_and_goes_on_being_cancelled(stood_in, supabase, rows, bucket, monkeypatch, tmp_path: Path):
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    a_take(supabase, bucket, source)
    a_job(supabase)

    def cancelled(*args, **kwargs):
        raise Cancelled("the input was cancelled")

    monkeypatch.setattr("media.words.words", cancelled)
    with pytest.raises(Cancelled):
        store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert supabase.row("edit_takes", TAKE)["status"] == supabase.row("edit_jobs", JOB)["status"] == "failed"
    assert supabase.row("edit_jobs", JOB)["error"] == "the analysis failed on our side; try again"  # M2: not the worker's own


def test_an_analysis_the_app_wrote_failed_is_given_up_at_its_next_stage(stood_in, supabase, rows, bucket, monkeypatch, tmp_path: Path, capsys):
    """B1(b): the app writes the job failed while its words are heard (it read the job as stopped). At the next stage
    the worker gives the job up: no faces, no copies stored, and neither row written again; the take follows its job
    in the app (takeState)."""
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    a_take(supabase, bucket, source)
    a_job(supabase)

    def words(sound16k, language, key, *, threads=0, reference=False):
        stopped_by_the_app(supabase)
        return nothing(language)

    monkeypatch.setattr("media.words.words", words)
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    job, take = supabase.row("edit_jobs", JOB), supabase.row("edit_takes", TAKE)
    assert (job["status"], job["error"], take["status"]) == ("failed", "the worker stopped", "analysing")
    assert stood_in["faces"] == [] and set(bucket.types) == {take["source_path"]}
    assert supabase.patches("edit_takes") == [] and "was stopped" in capsys.readouterr().out


def test_the_take_s_ready_write_and_the_job_s_end_are_tried_again(stood_in, supabase, rows, bucket, monkeypatch, tmp_path: Path):
    """M3: the last two writes of an analysis each fail once (an outage of a moment), and are tried again after a pause."""
    monkeypatch.setattr(store, "RETRY_S", (0.05, 0.1))
    source = talking_head(tmp_path, a_still(tmp_path), name="head.mov")
    a_take(supabase, bucket, source)
    a_job(supabase)
    refused = []

    def once(asked) -> bool:
        last = (asked.table, (asked.body or {}).get("status"))
        if last in (("edit_takes", "ready"), ("edit_jobs", "done")) and last not in refused:
            refused.append(last)
            return True
        return False

    supabase.failing = once
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert refused == [("edit_takes", "ready"), ("edit_jobs", "done")]
    assert supabase.row("edit_takes", TAKE)["status"] == "ready" and supabase.row("edit_jobs", JOB)["status"] == "done"
    ready = [x for x in supabase.patches("edit_takes") if x.body.get("status") == "ready"]
    assert len(ready) == 2 and ready[1].at - ready[0].at >= 0.05


def test_a_write_that_keeps_failing_is_tried_three_times_in_all(supabase, rows, monkeypatch):
    monkeypatch.setattr(store, "RETRY_S", (0.01, 0.02))
    a_job(supabase, status="running")
    supabase.refused.add("edit_jobs")
    with pytest.raises(RuntimeError, match="500"):
        rows.finish(JOB, "done", progress=1)
    assert len(supabase.patches()) == 3


def test_the_job_is_failed_even_when_its_take_cannot_be_written(stood_in, supabase, rows, bucket, tmp_path: Path):
    a_take(supabase, bucket, None)
    a_job(supabase)
    supabase.refused.add("edit_takes")
    store.analyse_job(JOB, rows=rows, r2=bucket, call="fc-1", key=None, work=tmp_path / "work")
    assert supabase.row("edit_jobs", JOB)["status"] == "failed" and supabase.row("edit_takes", TAKE)["status"] == "analysing"


def test_a_row_s_error_is_one_line_with_no_folder_in_it(stood_in, supabase, rows, bucket, tmp_path: Path):
    """I2: the message line only; the trace and the rest go to the log. Any absolute folder is taken out, a slice
    container's included, and an address is left whole."""
    error = RuntimeError("slices 4 to 7: Error: the file \"take\" cannot be read (403 Forbidden) at /tmp/tmpq1w2e3/parts/v004.ts"
                         " from https://r2.test/edit-media/u/x/full.mp4\n    at checkFiles (file:///edit/render.mjs:117:30)\n    at async withFilm")
    assert store.plain(error) == 'slices 4 to 7: Error: the file "take" cannot be read (403 Forbidden) at v004.ts from https://r2.test/edit-media/u/x/full.mp4'
    assert store.plain(RuntimeError("\n\n  ")) == "RuntimeError" and store.plain(ValueError("x" * 2000)).endswith("…")
    # A file address's folders too (a Node stack's first line, as the fall-back line once held it).
    assert store.plain(RuntimeError("the film: at checkFiles (file:///tmp/tmpq1w2e3/edit/render.mjs:117:30)")) == "the film: at checkFiles (render.mjs:117:30)"


# The render job

def an_edit(path: str, kit: bool = True) -> dict:
    assets = [{"id": "take", "origin": "filmed", "at": {"bucket": "edit-media", "path": path}, "kind": "video", "ms": 3000, "w": 720,
               "h": 1280, "sound": True, "words": None}]
    if kit:
        assets.append({"id": "pop", "origin": "kit", "at": {"kit": "sounds/pop.wav"}, "kind": "audio", "ms": 300})
    return {"v": 1, "stage": {"w": 1080, "h": 1920, "fps": 30}, "assets": assets}


class Render:
    """A stand-in for `render_film` (it spreads the slices over Modal's containers): it says what it was given,
    tells progress as the real one does, and leaves a film and a cover made with ffmpeg."""

    def __init__(self, error: Exception | None = None):
        self.given, self.error = [], error

    def __call__(self, props: dict, cover_frame: int | None, on_progress, out: Path) -> dict:
        self.given.append((props, cover_frame))
        on_progress("sizing", 0.0)
        if self.error:
            raise self.error
        on_progress("drawing", 0.5)
        out.mkdir(parents=True, exist_ok=True)
        ffmpeg("-f", "lavfi", "-i", "testsrc2=size=108x192:rate=30:duration=1", "-c:v", "libx264", "-preset", "ultrafast", str(out / "film.mp4"))
        ffmpeg("-f", "lavfi", "-i", "testsrc2=size=108x192:rate=1:duration=1", "-frames:v", "1", str(out / "cover.jpg"))
        on_progress("levelling", 1.0)
        return {"mp4": str(out / "film.mp4"), "jpg": str(out / "cover.jpg"), "frames": 280, "lufs": -14.4, "truePeak": -1.3,
                "lra": 3.5, "lufsFirst": -14.4, "truePeakFirst": -1.3, "guarded": False,
                "lufsBase": -14.4, "truePeakBase": -1.3, "raised": None, "raisedPosted": False}


def test_a_render_job_signs_the_creator_s_takes_renders_and_stores_the_film(supabase, rows, bucket, tmp_path: Path):
    full = store.take_key(USER, TAKE, "full.mp4")
    a_job(supabase, kind="render", input={"edit": an_edit(full), "cover": 45})
    render = Render()
    store.render_job(JOB, rows=rows, r2=bucket, call="fc-1", render=render, work=tmp_path / "work")

    [(props, cover)] = render.given
    assert props == {"edit": an_edit(full), "urls": {"take": bucket.sign(full)}} and cover == 45  # kit files keep their place
    job = supabase.row("edit_jobs", JOB)
    path, jpg = store.film_key(USER, JOB, "mp4"), store.film_key(USER, JOB, "jpg")
    assert (job["status"], job["progress"], job["error"]) == ("done", 1, None)
    assert job["result"] == {"path": path, "cover": jpg, "ms": 9333, "lufs": -14.4, "truePeak": -1.3}
    assert bucket.types == {path: "video/mp4", jpg: "image/jpeg"}
    stages = [stage for stage, _ in written(supabase)[1:-1]]
    assert stages == ["sizing", "drawing", "levelling", "storing"]
    assert [share for _, share in written(supabase)[1:-1]] == sorted(share for _, share in written(supabase)[1:-1])


def test_a_render_without_a_cover_frame_has_its_cover_at_the_start(supabase, rows, bucket, tmp_path: Path):
    a_job(supabase, kind="render", input={"edit": an_edit(store.take_key(USER, TAKE, "full.mp4"))})
    render = Render()
    store.render_job(JOB, rows=rows, r2=bucket, call="fc-1", render=render, work=tmp_path / "work")
    assert render.given[0][1] == 0 and supabase.row("edit_jobs", JOB)["status"] == "done"


@pytest.mark.parametrize("path", [store.take_key(OTHER, TAKE, "full.mp4"), f"u/{USER}/films/x.mp4",
                                  f"u/{USER}/takes/../../{OTHER}/takes/{TAKE}/full.mp4"],
                         ids=["another creator's take", "not a take", "climbing out"])
def test_a_render_of_a_file_that_is_not_the_creator_s_take_fails_before_it_renders(supabase, rows, bucket, tmp_path: Path, path: str):
    a_job(supabase, kind="render", input={"edit": an_edit(path)})
    render = Render()
    store.render_job(JOB, rows=rows, r2=bucket, call="fc-1", render=render, work=tmp_path / "work")
    job = supabase.row("edit_jobs", JOB)
    assert (job["status"], job["error"]) == ("failed", 'the file "take" is not one of this creator\'s takes') and render.given == []


@pytest.mark.parametrize(("error", "told"), [
    (Refusal('slices 4 to 7: the look cannot be drawn on the file "take": the browser cannot read it itself (hevc)'),
     'slices 4 to 7: the look cannot be drawn on the file "take": the browser cannot read it itself (hevc)'),
    (RuntimeError("slices 4 to 7: Error: Protocol error (Target.attachToTarget): Target closed at /tmp/x/render.mjs"),
     "the render failed on our side; try again"),
], ids=["render.mjs's marked line", "anything else"])
def test_a_failed_render_fails_the_job_with_its_own_words_only_when_they_are_the_worker_s(supabase, rows, bucket, tmp_path: Path, capsys,
                                                                                          error: Exception, told: str):
    """M2: a render's failure keeps its words when the worker said them (render.mjs's EDIT_ERROR line, raised as a
    Refusal); anything else is ours, its words in the log."""
    a_job(supabase, kind="render", input={"edit": an_edit(store.take_key(USER, TAKE, "full.mp4"), kit=False)})
    store.render_job(JOB, rows=rows, r2=bucket, call="fc-1", render=Render(error), work=tmp_path / "work")
    job = supabase.row("edit_jobs", JOB)
    assert (job["status"], job["error"], job["stage"]) == ("failed", told, "sizing")
    assert bucket.types == {} and str(error) in capsys.readouterr().err


@pytest.mark.parametrize("kit", ["../bundle/index.html", "sounds/../../bundle/x.js", "/etc/passwd", "sounds//pop.wav", "Sounds/pop.wav", ".hidden",
                                 "a" * 81, 5], ids=["climbing out", "climbing out later", "absolute", "an empty part", "upper case", "a dot first",
                                                    "too long", "not a path"])
def test_a_render_of_a_kit_path_the_app_would_refuse_fails_before_it_renders(supabase, rows, bucket, tmp_path: Path, kit):
    """M1: a kit file's path is held to the app's own rule (`KitPath`, src/lib/edit/doc.ts), so a forged job cannot have
    the renderer serve a file from outside the kit."""
    edit = an_edit(store.take_key(USER, TAKE, "full.mp4"))
    edit["assets"][1]["at"] = {"kit": kit}
    a_job(supabase, kind="render", input={"edit": edit})
    render = Render()
    store.render_job(JOB, rows=rows, r2=bucket, call="fc-1", render=render, work=tmp_path / "work")
    job = supabase.row("edit_jobs", JOB)
    assert (job["status"], job["error"]) == ("failed", 'the file "pop" is not one of the kit\'s files') and render.given == []


def test_a_render_the_app_wrote_failed_is_given_up_and_stores_nothing(supabase, rows, bucket, tmp_path: Path):
    """B1(b): written failed by the app while it draws; the next progress it tells raises, so nothing is stored."""
    a_job(supabase, kind="render", input={"edit": an_edit(store.take_key(USER, TAKE, "full.mp4"))})

    def drawing(props, cover_frame, on_progress, out):
        stopped_by_the_app(supabase)
        return Render()(props, cover_frame, on_progress, out)  # it would draw on, and make its film

    store.render_job(JOB, rows=rows, r2=bucket, call="fc-1", render=drawing, work=tmp_path / "work")
    assert supabase.row("edit_jobs", JOB)["error"] == "the worker stopped" and bucket.types == {}


def test_a_render_job_without_an_edit_fails_saying_so(supabase, rows, bucket, tmp_path: Path):
    a_job(supabase, kind="render", input={})
    store.render_job(JOB, rows=rows, r2=bucket, call="fc-1", render=Render(), work=tmp_path / "work")
    assert supabase.row("edit_jobs", JOB)["error"] == "the job's input holds no edit"


# The web address (X41): POST /start {"job": id}, Bearer <EDIT_WORKER_SECRET>

class Spawn:
    """A stand-in for Modal's spawn of the job's function."""

    def __init__(self):
        self.asked = []

    def __call__(self, kind: str, job: str) -> str:
        self.asked.append((kind, job))
        return f"fc-{len(self.asked)}"


def started(rows, body, authorization: str | None = "Bearer the-secret", spawn: Spawn | None = None):
    return store.start(json.dumps(body).encode() if isinstance(body, dict) else body, authorization, secret="the-secret", rows=rows,
                       spawn=spawn or Spawn())


def test_start_spawns_the_job_s_function_from_its_row_and_writes_the_call(supabase, rows):
    a_job(supabase, kind="render", input={"edit": {}})
    spawn = Spawn()
    assert started(rows, {"job": JOB}, spawn=spawn) == (202, {"call": "fc-1"})
    assert spawn.asked == [("render", JOB)]  # the kind is the row's (X41), not the caller's
    assert supabase.row("edit_jobs", JOB)["call_id"] == "fc-1"
    assert supabase.patches()[-1].filters == {"id": f"eq.{JOB}", "call_id": "is.null"}


@pytest.mark.parametrize("authorization", [None, "", "Bearer the-secreT", "Bearer the-secret ", "the-secret", "Bearer ünïcode"])
def test_start_refuses_a_wrong_secret_before_it_reads_anything(supabase, rows, authorization):
    a_job(supabase)
    spawn = Spawn()
    assert started(rows, {"job": JOB}, authorization, spawn)[0] == 401
    assert supabase.asked == [] and spawn.asked == []


def test_start_refuses_when_the_worker_has_no_secret(supabase, rows):
    a_job(supabase)
    status, _ = store.start(json.dumps({"job": JOB}).encode(), "Bearer ", secret="", rows=rows, spawn=Spawn())
    assert status == 401


@pytest.mark.parametrize("body", [b"", b"not json", b"[]", {"job": 5}, {"job": "not-a-uuid"}, {"take": JOB}])
def test_start_answers_400_to_a_body_that_names_no_job(supabase, rows, body):
    assert started(rows, body)[0] == 400 and supabase.asked == []


@pytest.mark.parametrize("status", [None, "running", "done", "failed"])
def test_start_answers_404_unless_the_job_is_queued(supabase, rows, status):
    if status:
        a_job(supabase, status=status)
    spawn = Spawn()
    assert started(rows, {"job": JOB}, spawn=spawn)[0] == 404 and spawn.asked == []


# The stills (part 3, Task 6): POST /stills {"user", "edit", "frames", "sheet"?}, Bearer <EDIT_WORKER_SECRET>, answered in the
# render image (`stills_answer`), which signs the edit's files, draws the frames and gives them back as JPEGs.

# The JPEG standard's example tables (ITU-T T.81, Annex K, K.1 and K.2), row by row, and libjpeg's scaling of them for a
# quality (jcparam.c): what "quality 85" means.
ANNEX_K_LUMA = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
                14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
                49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99]
ANNEX_K_CHROMA = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99,
                  47, 66, 99, 99, 99, 99, 99, 99] + [99] * 32
ZIGZAG = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
          35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63]


def libjpeg(table: list[int], quality: int) -> list[int]:
    scale = 5000 // quality if quality < 50 else 200 - 2 * quality
    return [min(255, max(1, (q * scale + 50) // 100)) for q in table]


def quantization(jpeg: bytes) -> dict[int, list[int]]:
    """A JPEG's quantization tables (its DQT segments), by table number, row by row."""
    tables, at = {}, 2
    while at < len(jpeg) and jpeg[at] == 0xFF and jpeg[at + 1] != 0xDA:
        length = int.from_bytes(jpeg[at + 2:at + 4], "big")
        if jpeg[at + 1] == 0xDB:
            segment = jpeg[at + 4:at + 2 + length]
            for start in range(0, len(segment), 65):
                assert segment[start] >> 4 == 0, "8-bit tables"
                row_by_row = [0] * 64
                for k, z in enumerate(ZIGZAG):
                    row_by_row[z] = segment[start + 1 + k]
                tables[segment[start] & 15] = row_by_row
        at += 2 + length
    return tables


COLOURS = ["ff0000", "00ff00", "0000ff", "ffff00", "ff00ff", "00ffff", "ffffff", "808080", "ff8000", "8000ff", "00ff80", "804000"]


def solid(folder: Path, colour: str) -> bytes:
    """A frame of the stage's size in one colour, as a PNG, made by ffmpeg (the render image has no Pillow)."""
    path = folder / f"{colour}.png"
    if not path.exists():
        ffmpeg("-f", "lavfi", "-i", f"color=c=0x{colour}:size=1080x1920:rate=1:duration=1", "-frames:v", "1", str(path))
    return path.read_bytes()


def pixels(jpeg: bytes, folder: Path) -> tuple[int, int, bytes]:
    """A JPEG's width, height and RGB pixels, decoded by ffmpeg."""
    path = folder / "seen.jpg"
    path.write_bytes(jpeg)
    [video] = streams(path, "video")
    raw = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         check=True, capture_output=True).stdout
    return video["width"], video["height"], raw


def colour_at(width: int, raw: bytes, x0: int, y0: int, w: int, h: int) -> tuple[float, float, float]:
    """The mean colour of a box, its edges left out (JPEG's blocks blur them)."""
    sums, n = [0, 0, 0], 0
    for y in range(y0 + h // 4, y0 + 3 * h // 4, 4):
        for x in range(x0 + w // 4, x0 + 3 * w // 4, 4):
            at = (y * width + x) * 3
            for c in range(3):
                sums[c] += raw[at + c]
            n += 1
    return tuple(s / n for s in sums)


def near(seen: tuple[float, float, float], colour: str, levels: float = 6) -> bool:
    return all(abs(s - int(colour[2 * c:2 * c + 2], 16)) <= levels for c, s in enumerate(seen))


class Draw:
    """A stand-in for the drawing (render.mjs's `stills`, a browser in the render image): it says what it was given and gives a
    PNG of the stage's size for each frame, the n-th asked in the n-th colour, so the order can be read back; or raises."""

    def __init__(self, folder: Path, error: Exception | None = None):
        self.folder, self.error, self.given = folder, error, []

    def __call__(self, props: dict, frames: list[int]) -> list[bytes]:
        self.given.append((props, frames))
        if self.error:
            raise self.error
        return [solid(self.folder, COLOURS[i]) for i in range(len(frames))]


def asked_for_stills(bucket, draw: Draw, body, authorization: str | None = "Bearer the-secret", secret: str = "the-secret", work: Path | None = None):
    return store.stills_request(json.dumps(body).encode() if isinstance(body, dict) else body, authorization, secret=secret, r2=bucket,
                                draw=draw, work=work or draw.folder / "work")


def a_body(path: str | None = None, frames: list | None = None, **more) -> dict:
    return {"user": USER, "edit": an_edit(path or store.take_key(USER, TAKE, "full.mp4")), "frames": [0, 45, 300] if frames is None else frames, **more}


@pytest.fixture
def draw(tmp_path: Path) -> Draw:
    return Draw(tmp_path)


@pytest.mark.parametrize("authorization", [None, "", "Bearer the-secreT", "Bearer the-secret ", "the-secret", "Bearer ünïcode"])
def test_stills_refuse_a_wrong_secret_before_they_read_the_body(bucket, draw, authorization):
    assert asked_for_stills(bucket, draw, b"not even json", authorization) == (401, {"error": "not allowed"}) and draw.given == []


def test_stills_are_refused_when_the_worker_has_no_secret(bucket, draw):
    assert asked_for_stills(bucket, draw, a_body(), "Bearer ", secret="")[0] == 401 and draw.given == []


BODY = 'the body is {"user": "<the creator\'s id>", "edit": <an edit>, "frames": [<frame>, …], "sheet": <true or false, or left out>}'
FRAMES = "frames are 1 to 6 whole numbers from 0, or 1 to 12 on a sheet"
ASSETS = 'the edit\'s "assets" are not a list of files, each with its "id" and its "at"'


@pytest.mark.parametrize(("body", "told"), [
    (b"", BODY), (b"not json", BODY), (b"\xff\xfe", BODY), (b"[]", BODY), ({"edit": {}, "frames": [0]}, BODY),
    ({"user": "not-a-uuid", "edit": {}, "frames": [0]}, BODY), ({"user": 5, "edit": {}, "frames": [0]}, BODY),
    ({"user": USER, "edit": [], "frames": [0]}, BODY), ({"user": USER, "edit": {}, "frames": [0], "sheet": "yes"}, BODY),
    ({"user": USER, "edit": {}, "frames": [0], "sheet": None}, BODY),
    ({"user": USER, "edit": {}}, FRAMES), ({"user": USER, "edit": {}, "frames": []}, FRAMES), ({"user": USER, "edit": {}, "frames": 0}, FRAMES),
    ({"user": USER, "edit": {}, "frames": ["0"]}, FRAMES), ({"user": USER, "edit": {}, "frames": [1.5]}, FRAMES),
    ({"user": USER, "edit": {}, "frames": [-1]}, FRAMES), ({"user": USER, "edit": {}, "frames": [True]}, FRAMES),
    ({"user": USER, "edit": {}, "frames": list(range(7))}, FRAMES),
    ({"user": USER, "edit": {}, "frames": list(range(13)), "sheet": True}, FRAMES),
    ({"user": USER, "edit": {}, "frames": [0]}, ASSETS), ({"user": USER, "edit": {"assets": {}}, "frames": [0]}, ASSETS), ({"user": USER, "edit": {"assets": ["take"]}, "frames": [0]}, ASSETS),
    ({"user": USER, "edit": {"assets": [{"at": {"kit": "sounds/pop.wav"}}]}, "frames": [0]}, ASSETS),
    ({"user": USER, "edit": {"assets": [{"id": 5, "at": {"kit": "sounds/pop.wav"}}]}, "frames": [0]}, ASSETS),
    ({"user": USER, "edit": {"assets": [{"id": "pop", "at": "sounds/pop.wav"}]}, "frames": [0]}, ASSETS),
], ids=["empty", "not json", "not utf-8", "not an object", "no user", "user not a uuid", "user not text", "edit not an object",
        "sheet not a boolean", "sheet null", "no frames", "no frame", "frames not a list", "a frame as text", "a fraction",
        "a frame before the film", "a boolean", "seven stills", "thirteen on a sheet", "no assets", "assets not a list", "a file not an object",
        "a file without an id", "an id not text", "a file kept nowhere"])
def test_stills_answer_400_to_a_body_they_cannot_take(bucket, draw, body, told):
    assert asked_for_stills(bucket, draw, body) == (400, {"error": told}) and draw.given == []


@pytest.mark.parametrize("path", [store.take_key(OTHER, TAKE, "full.mp4"), f"u/{USER}/films/x.mp4",
                                  f"u/{USER}/takes/../../{OTHER}/takes/{TAKE}/full.mp4"],
                         ids=["another creator's take", "not a take", "climbing out"])
def test_stills_of_a_file_that_is_not_the_creator_s_take_are_refused_before_anything_is_drawn(bucket, draw, path):
    """X63, as the render job holds it: every file kept in R2 is one of the creator's takes."""
    assert asked_for_stills(bucket, draw, a_body(path)) == (422, {"error": 'the file "take" is not one of this creator\'s takes'})
    assert draw.given == []


def test_stills_of_a_kit_path_the_app_would_refuse_are_refused_before_anything_is_drawn(bucket, draw):
    body = a_body()
    body["edit"]["assets"][1]["at"] = {"kit": "../bundle/index.html"}
    assert asked_for_stills(bucket, draw, body) == (422, {"error": 'the file "pop" is not one of the kit\'s files'}) and draw.given == []


def test_a_frame_past_the_film_s_end_is_refused_in_the_drawing_s_own_words(bucket, tmp_path):
    """The worker cannot lay an edit out (X63): render.mjs, which sizes the film, refuses a frame past its end before it draws
    any (test_render.py), and its marked line is raised as the worker's own words."""
    draw = Draw(tmp_path, Refusal("frame 300 is past the film's end: it has 280 frames"))
    assert asked_for_stills(bucket, draw, a_body()) == (422, {"error": "frame 300 is past the film's end: it has 280 frames"})


# What render.mjs wrote to stderr for a real engine failure (a still with a look, drawn with a GL that has no WebGL 2, on this
# Mac, 2026-11-21, fix round 1): no line of it marked, and the engine's words hold the browsers' own address.
ENGINE_FAILED = """[Tab 0, node_modules/.pnpm/remotion@4.0.545_react-dom@19.2.3_react@19.2.3__react@19.2.3/node_modules/remotion/dist/esm/index.mjs:7017]
Error: WebGL context remained unavailable while rendering effects. Recovery failed after two retries. Try reducing rendering concurrency or GPU memory usage. Failed to acquire WebGL2 context for effects.
    at Object.runEffectChain (http://localhost:3000/bundle.js:104620:17)
    at async http://localhost:3000/bundle.js:23254:31
"""


def test_stills_that_fail_where_the_worker_did_not_say_why_are_told_as_ours_and_its_words_go_to_the_log(bucket, tmp_path, capsys):
    """I1: an engine failure is not the worker's to word: render.mjs leaves it unmarked, `script.run` raises it as a RuntimeError
    (as here, from its real output), and the stills answer 500 as ours, the engine's words and addresses in the log only.
    test_render.py drives render.mjs into this failure for real."""
    failure = script.failure(None, ENGINE_FAILED)
    assert type(failure) is RuntimeError
    status, answer = asked_for_stills(bucket, Draw(tmp_path, failure), a_body())
    assert (status, answer) == (500, {"error": "the stills failed on our side; try again"})
    said = capsys.readouterr()
    assert "node_modules/.pnpm/remotion@4.0.545" in said.out + said.err


def test_stills_are_drawn_from_the_creator_s_takes_signed_and_come_back_as_jpegs_of_half_the_stage_at_quality_85(bucket, draw, tmp_path):
    full = store.take_key(USER, TAKE, "full.mp4")
    status, answer = asked_for_stills(bucket, draw, a_body(full, [300, 0, 45]))
    assert status == 200, answer
    # Drawn with a signed read of the take, the kit file in its place (as a render job is), the frames in the order asked.
    assert draw.given == [({"edit": an_edit(full), "urls": {"take": bucket.sign(full)}}, [300, 0, 45])]
    assert [still["frame"] for still in answer["stills"]] == [300, 0, 45]
    for i, still in enumerate(answer["stills"]):
        jpeg = base64.b64decode(still["jpeg"], validate=True)
        assert jpeg[:3] == b"\xff\xd8\xff"
        width, height, raw = pixels(jpeg, tmp_path)
        assert (width, height) == (540, 960)
        assert near(colour_at(width, raw, 0, 0, width, height), COLOURS[i])
        # libjpeg's tables at quality 85, but for the DC step, which ffmpeg's encoder keeps at its own 8 (libjpeg's is 5).
        tables = quantization(jpeg)
        assert sorted(tables) == [0, 1]
        assert tables[0][1:] == libjpeg(ANNEX_K_LUMA, 85)[1:] and tables[1][1:] == libjpeg(ANNEX_K_CHROMA, 85)[1:]
        assert tables[0][0] == tables[1][0] == 8


def test_a_still_is_the_whole_frame_made_smaller_not_a_part_of_it(bucket, tmp_path):
    """A frame red above and blue below its middle, white in its right quarter: the still keeps all three where they were."""
    frame = tmp_path / "parts.png"
    ffmpeg("-f", "lavfi", "-i", "color=c=red:size=1080x960:d=1[t];color=c=blue:size=1080x960:d=1[b];[t][b]vstack,"
           "drawbox=x=810:y=0:w=270:h=1920:color=white:t=fill", "-frames:v", "1", str(frame))

    class Parts(Draw):
        def __call__(self, props, frames):
            return [frame.read_bytes()]

    status, answer = asked_for_stills(bucket, Parts(tmp_path), a_body(frames=[0]))
    assert status == 200
    width, height, raw = pixels(base64.b64decode(answer["stills"][0]["jpeg"]), tmp_path)
    assert near(colour_at(width, raw, 0, 0, 405, 480), "ff0000") and near(colour_at(width, raw, 0, 480, 405, 480), "0000ff")
    assert near(colour_at(width, raw, 405, 0, 135, 960), "ffffff")


@pytest.mark.parametrize(("count", "size"), [(1, (270, 480)), (3, (810, 480)), (4, (1080, 480)), (5, (1080, 960)), (12, (1080, 1440))])
def test_a_sheet_is_one_jpeg_four_across_each_frame_a_quarter_of_the_stage_in_the_order_asked_its_gaps_black(bucket, draw, tmp_path, count, size):
    """For the style read (Task 9): up to 12 frames on one sheet; seven or more only on a sheet."""
    frames = list(range(0, 30 * count, 30))[::-1]
    status, answer = asked_for_stills(bucket, draw, a_body(frames=frames, sheet=True))
    assert status == 200 and list(answer) == ["sheet"] and draw.given[0][1] == frames
    jpeg = base64.b64decode(answer["sheet"], validate=True)
    width, height, raw = pixels(jpeg, tmp_path)
    assert (width, height) == size
    for cell in range(4 * (height // 480)):
        seen = colour_at(width, raw, 270 * (cell % 4), 480 * (cell // 4), 270, 480) if 270 * (cell % 4) < width else None
        if seen is not None:
            assert near(seen, COLOURS[cell] if cell < count else "000000"), (cell, seen)
    assert quantization(jpeg)[0][1:] == libjpeg(ANNEX_K_LUMA, 85)[1:]


def test_seven_frames_come_on_a_sheet_and_not_as_stills(bucket, draw):
    assert asked_for_stills(bucket, draw, a_body(frames=list(range(7))))[0] == 400
    assert asked_for_stills(bucket, draw, a_body(frames=list(range(7)), sheet=True))[0] == 200


def test_the_creator_s_id_is_read_in_any_of_its_spellings(bucket, draw):
    """The folder is the id as the rows write it, lower case; the app may send it otherwise."""
    assert asked_for_stills(bucket, draw, {**a_body(frames=[0]), "user": USER.upper()})[0] == 200
