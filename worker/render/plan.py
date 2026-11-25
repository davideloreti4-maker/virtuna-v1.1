"""How a film is cut into slices and the slices into render containers (X50), and how their calls are waited on.

Every browser draws one slice, so the slices follow the film: as many as there are 60 frames, up to
the 32 browsers of four render containers, all the same length but the last, as the engine's recipe
for a render in parts asks. A 90 s film is 32 slices of 86 frames; a 9 s film is five of 56 in one
container. The last slice is never under 5 frames unless the whole film is (the recipe's seamless
join of the sound needs more than 4 frames a slice).
"""

import math
import time
from collections.abc import Callable
from typing import NamedTuple

from media.refusal import Refusal

LEAST = 60  # frames to a slice at least, but for a film shorter than that
BROWSERS = 8  # to a 16-core render container
MOST_CONTAINERS = 4
BUSY = "the render machines are busy; try again"  # the slices did not come back by the render's deadline (B1)


class Slicing(NamedTuple):
    per: int  # frames to a slice; the last may have fewer
    count: int


def slicing(frames: int) -> Slicing:
    wanted = min(BROWSERS * MOST_CONTAINERS, math.ceil(frames / LEAST))
    per = math.ceil(frames / wanted)
    return Slicing(per, math.ceil(frames / per))


def spread(count: int) -> list[tuple[int, int]]:
    """The slices as runs of consecutive slices, one run to a container: the fewest containers that
    give every slice a browser of its own, and the slices as evenly over them as whole runs allow."""
    containers = math.ceil(count / BROWSERS)
    run = math.ceil(count / containers)
    return [(first, min(count, first + run) - 1) for first in range(0, count, run)]


def collect(calls: list, wait: Callable[[], None], deadline: float | None = None) -> list:
    """What each of `calls` gave (Modal calls of the slices, spawned), in their order. `wait()` passes the time
    between looks, reading the drawing's progress. When one fails, the others are cancelled at once, their
    containers stopped, and its error is raised: one failed slice fails the render then, not when the others end.
    So do the slices still out when `wait()` raises (the job was stopped, B1) or when `deadline` (a time.monotonic()
    time: the render's own container nears its timeout) comes, which fails the render as busy (`BUSY`): slices that
    queue behind other renders for render_slices' four containers would otherwise draw on for a render nobody waits
    for. A cancel that fails is logged and the next tried. Known bound: if the container calling this dies, nobody
    cancels the slices, and they run to their own timeout (600 s)."""
    results: dict[int, object] = {}
    failed: int | None = None
    try:
        while len(results) < len(calls):
            if deadline is not None and time.monotonic() >= deadline:
                raise Refusal(BUSY)
            wait()
            for i, call in enumerate(calls):
                if i in results:
                    continue
                try:
                    results[i] = call.get(timeout=0)
                except TimeoutError:  # not done yet (Modal raises the built-in one for a call still running)
                    continue
                except Exception:
                    failed = i
                    raise
    except BaseException:
        for j, other in enumerate(calls):
            if j != failed and j not in results:
                try:
                    other.cancel(terminate_containers=True)
                except Exception as error:
                    print(f"call {j} was not cancelled: {error}", flush=True)
        raise
    return [results[i] for i in range(len(calls))]
