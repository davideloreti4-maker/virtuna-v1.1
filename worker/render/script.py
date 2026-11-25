"""Running render.mjs: the JSON lines it prints, and on a failure only its message (I2).

render.mjs writes the whole error to stderr, stack and all, and, for a failure it worded for the creator
(its `Said`), last the message alone on a line marked `EDIT_ERROR: `. That line is what a failure says,
raised as the worker's own words (a Refusal, so it goes into a job's row, M2); everything else it wrote goes
to the log. A failure with no marked line (the engine's own) is not the worker's to say: its first line is
raised as a RuntimeError, and the row says the render failed on our side.
"""

import json
import subprocess
import sys
from pathlib import Path

from media.refusal import Refusal

MARK = "EDIT_ERROR: "


def message(said: str) -> str:
    """The error's message from what render.mjs wrote to stderr: its marked line, else the first line written."""
    lines = [line.strip() for line in said.splitlines() if line.strip()]
    marked = [line.removeprefix(MARK) for line in lines if line.startswith(MARK)]
    return marked[-1] if marked else (lines[0] if lines else "no message")


def failure(about: str | None, said: str) -> Exception:
    """What a failed run of render.mjs raises, from what it wrote to stderr: its marked line as the worker's own words
    (a Refusal), else its first line as a RuntimeError; "<about>: <the message>" either way, or the message alone
    without an `about` (the stills route answers render.mjs's words as they are)."""
    marked = any(line.strip().startswith(MARK) for line in said.splitlines())
    return (Refusal if marked else RuntimeError)(f"{about}: {message(said)}" if about else message(said))


def run(script: str | Path, *args: str, about: str | None, env: dict | None = None) -> list[dict]:
    """Runs render.mjs and gives the JSON lines it printed. A failure raises `failure(about, …)` and logs all it wrote."""
    done = subprocess.run(["node", str(script), *args], capture_output=True, text=True, errors="replace", env=env)
    if done.returncode != 0:
        print(done.stderr, file=sys.stderr, flush=True)
        raise failure(about, done.stderr)
    return [json.loads(line) for line in done.stdout.splitlines() if line.startswith("{")]
