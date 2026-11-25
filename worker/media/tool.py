"""Running ffmpeg and ffprobe so that a failure says which file and what the tool itself said."""

import subprocess
from pathlib import Path


def run(cmd: list[str], about: str | Path) -> str:
    """Runs `cmd` and gives its output; raises RuntimeError naming `about` (the file) with the tool's own words."""
    return _run(cmd, about).stdout


def report(cmd: list[str], about: str | Path) -> str:
    """Runs `cmd` and gives what it wrote to stderr, where ffmpeg's filters say what they measured. Fails as `run` does,
    but its message's first line ends with the tool's last line (the cause; what it wrote first is the input's header),
    and the rest of what it wrote follows."""
    return _run(cmd, about, last=True).stderr


def _run(cmd: list[str], about: str | Path, last: bool = False) -> subprocess.CompletedProcess:
    # Bytes that are not UTF-8 (a take's tag may hold them) are read as replacement characters, not a decoding error.
    done = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if done.returncode != 0:
        said = done.stderr.strip()
        cause = f"{said.splitlines()[-1].strip()}\n{said}" if last and said else said
        raise RuntimeError(f"{about}: {cmd[0]} failed ({done.returncode}): {cause}")
    return done
