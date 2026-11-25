"""Stand-ins for the worker's two outside services, which this Mac cannot reach: Supabase's REST API
(PostgREST) and the R2 bucket. The end-to-end run proves `store` against the real ones (plan, Task 6).

`PostgREST` is a server on 127.0.0.1 that keeps the two tables in memory and answers what `store.Rows`
asks as PostgREST does: filters `col=eq.value`, `col=is.null` and `col=in.(a,b)`, GET, and PATCH
answered with the rows it changed (`Prefer: return=representation`), `updated_at` stamped on every
update as the migration's trigger stamps it. A request without the service key in both headers is
refused (401); writes to a table in `refused` are answered 500, as an outage would be, and so is any write
`failing` picks (a write that fails once, M3). Every request is recorded, with when it came.

`Bucket` is a folder with `store.R2`'s four calls.
"""

import json
import shutil
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from collections.abc import Callable
from typing import NamedTuple
from urllib.parse import parse_qsl, urlsplit


class Asked(NamedTuple):
    method: str
    table: str
    filters: dict[str, str]
    body: dict | None
    at: float  # time.monotonic()


class PostgREST:
    def __init__(self, key: str):
        self.key = key
        self.tables: dict[str, dict[str, dict]] = {"edit_takes": {}, "edit_jobs": {}}
        self.asked: list[Asked] = []
        self.refused: set[str] = set()  # tables whose writes are answered 500, as an outage would
        self.failing: Callable[[Asked], bool] | None = None  # a write it says yes to is answered 500 too
        self.lock = threading.Lock()
        stand_in = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # no lines on stderr
                pass

            def answer(self, status: int, body=None):
                data = b"" if body is None else json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                self.serve("GET")

            def do_PATCH(self):
                self.serve("PATCH")

            def serve(self, method: str):
                url = urlsplit(self.path)
                table = url.path.removeprefix("/rest/v1/")
                filters = {k: v for k, v in parse_qsl(url.query, keep_blank_values=True) if k != "select"}
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length)) if length else None
                with stand_in.lock:
                    asked = Asked(method, table, filters, body, time.monotonic())
                    stand_in.asked.append(asked)
                    if self.headers.get("apikey") != stand_in.key or self.headers.get("Authorization") != f"Bearer {stand_in.key}":
                        return self.answer(401, {"message": "Invalid API key"})
                    if table not in stand_in.tables:
                        return self.answer(404, {"code": "42P01", "message": f'relation "public.{table}" does not exist'})
                    if method == "PATCH" and (table in stand_in.refused or (stand_in.failing and stand_in.failing(asked))):
                        return self.answer(500, {"message": "the stand-in refuses writes to this table"})
                    rows = [row for row in stand_in.tables[table].values() if matches(row, filters)]
                    if method == "PATCH":
                        for row in rows:
                            row.update(body or {})
                            row["updated_at"] = datetime.now(timezone.utc).isoformat()
                        if "return=representation" not in (self.headers.get("Prefer") or ""):
                            return self.answer(204)
                    return self.answer(200, [dict(row) for row in rows])

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def put(self, table: str, row: dict) -> dict:
        with self.lock:
            self.tables[table][row["id"]] = {"updated_at": datetime.now(timezone.utc).isoformat(), **row}
        return row

    def row(self, table: str, id: str) -> dict:
        with self.lock:
            return dict(self.tables[table][id])

    def patches(self, table: str = "edit_jobs") -> list[Asked]:
        with self.lock:
            return [x for x in self.asked if x.method == "PATCH" and x.table == table]

    def close(self):
        self.server.shutdown()
        self.server.server_close()


def matches(row: dict, filters: dict[str, str]) -> bool:
    for column, test in filters.items():
        op, _, value = test.partition(".")
        if op == "eq" and (row.get(column) is None or str(row[column]) != value):
            return False
        if op == "is" and value == "null" and row.get(column) is not None:
            return False
        if op == "in" and str(row.get(column)) not in value.strip("()").split(","):
            return False
        if op not in ("eq", "is", "in"):
            raise ValueError(f"the stand-in knows no filter {test!r}")
    return True


class Bucket:
    """The R2 bucket as a folder: `size` (HEAD), `download`, `upload` (recording each file's type), `sign` and `delete`
    (recording each key)."""

    def __init__(self, folder: Path, bucket: str = "edit-media"):
        self.folder, self.bucket = folder, bucket
        self.types: dict[str, str] = {}
        self.deleted: list[str] = []

    def size(self, key: str) -> int | None:
        path = self.folder / key
        return path.stat().st_size if path.is_file() else None

    def download(self, key: str, path: Path) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(self.folder / key, path)

    def upload(self, path: str | Path, key: str, content_type: str) -> None:
        (self.folder / key).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, self.folder / key)
        self.types[key] = content_type

    def sign(self, key: str, seconds: int = 7200) -> str:
        return f"https://r2.test/{self.bucket}/{key}?expires={seconds}"

    def delete(self, key: str) -> None:
        (self.folder / key).unlink(missing_ok=True)
        self.deleted.append(key)
