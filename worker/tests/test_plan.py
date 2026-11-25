import threading
import time

import pytest

from media.refusal import Refusal
from render.plan import BROWSERS, BUSY, MOST_CONTAINERS, collect, slicing, spread


def sizes(frames: int) -> list[int]:
    """The length of every slice of a film."""
    per, count = slicing(frames)
    return [min(per, frames - i * per) for i in range(count)]


@pytest.mark.parametrize("frames, per, count", [(1, 1, 1), (17, 17, 1), (60, 60, 1), (61, 31, 2), (280, 56, 5), (2726, 86, 32)])
def test_slices_follow_the_film(frames, per, count):
    assert slicing(frames) == (per, count)


def test_a_90_s_film_is_32_slices_over_four_full_containers():
    assert sizes(2726) == [86] * 31 + [60]
    assert spread(32) == [(0, 7), (8, 15), (16, 23), (24, 31)]


def test_a_film_shorter_than_one_slice_is_one_slice_in_one_container():
    assert sizes(17) == [17]
    assert spread(1) == [(0, 0)]


def test_a_9_s_film_is_five_slices_in_one_container():
    assert spread(slicing(280).count) == [(0, 4)]


def test_slices_spread_evenly_over_the_fewest_containers():
    assert spread(9) == [(0, 4), (5, 8)]
    assert spread(17) == [(0, 5), (6, 11), (12, 16)]


def test_every_film_is_cut_into_whole_slices():
    """Every length from 1 frame to 11 minutes."""
    for frames in range(1, 20001):
        per, count = slicing(frames)
        lengths = sizes(frames)
        assert sum(lengths) == frames, frames
        assert all(length > 0 for length in lengths), frames
        assert count <= BROWSERS * MOST_CONTAINERS, frames
        # All the same length but the last, as the engine's recipe asks; and the last never under 5
        # frames, which its seamless sound join needs, unless the whole film is shorter.
        assert all(length == per for length in lengths[:-1]), frames
        assert lengths[-1] >= min(5, frames), frames
        groups = spread(count)
        assert len(groups) <= MOST_CONTAINERS, frames
        assert [i for first, last in groups for i in range(first, last + 1)] == list(range(count)), frames
        assert all(last - first + 1 <= BROWSERS for first, last in groups), frames


class Call:
    """A stand-in for a Modal call of `render_slices` (the boundary this Mac cannot run): it gives `result`, or
    raises `error`, `seconds` after it starts, and answers `get(timeout=0)` and `cancel()` as Modal's FunctionCall does.
    Its timer is a daemon thread, stopped when the test ends (the `calls` fixture)."""

    def __init__(self, seconds: float, result=None, error: Exception | None = None, refuse_cancel: bool = False):
        self.result, self.error, self.refuse_cancel, self.cancelled = result, error, refuse_cancel, None
        self.done = threading.Event()
        self.timer = threading.Timer(seconds, self.done.set)
        self.timer.daemon = True
        self.timer.start()

    def get(self, timeout: float | None = None):
        if not self.done.wait(timeout):
            raise TimeoutError()
        if self.error:
            raise self.error
        return self.result

    def cancel(self, terminate_containers: bool = False):
        if self.refuse_cancel:
            raise ConnectionError("Modal could not be reached")
        self.cancelled = terminate_containers
        self.done.set()


@pytest.fixture
def calls():
    made: list[Call] = []
    yield made
    for call in made:
        call.timer.cancel()


def test_the_calls_results_come_back_in_their_order_whatever_order_they_end_in(calls):
    calls += [Call(0.9, "a"), Call(0.3, "b"), Call(0.6, "c")]
    waits = []
    assert collect(calls, lambda: (waits.append(1), time.sleep(0.02))) == ["a", "b", "c"]
    assert waits and all(call.cancelled is None for call in calls)


def test_one_failed_call_fails_at_once_and_the_others_are_cancelled(calls):
    """The ledger (Task 2): one failed slice fails the render at once, not when the others end."""
    calls += [Call(30, "a"), Call(0.1, error=RuntimeError("slices 4 to 7: no WebGL")), Call(30, "c")]
    started = time.monotonic()
    with pytest.raises(RuntimeError, match="^slices 4 to 7: no WebGL$"):
        collect(calls, lambda: time.sleep(0.02))
    assert time.monotonic() - started < 10  # the others would take 30 s
    assert [call.cancelled for call in calls] == [True, None, True]  # the containers of the others are stopped too


def test_a_cancel_that_fails_is_logged_and_the_slice_s_error_is_the_one_raised(calls, capsys):
    calls += [Call(30, "a", refuse_cancel=True), Call(0.1, error=RuntimeError("slices 4 to 7: no WebGL")), Call(30, "c")]
    with pytest.raises(RuntimeError, match="^slices 4 to 7: no WebGL$"):
        collect(calls, lambda: time.sleep(0.02))
    assert [call.cancelled for call in calls] == [None, None, True]  # the third is cancelled though the first's cancel failed
    assert "call 0 was not cancelled: Modal could not be reached" in capsys.readouterr().out


def test_slices_still_waiting_at_the_deadline_are_cancelled_and_the_render_is_refused_as_busy(calls):
    """B1(a): the slices queue behind other renders (render_slices' cap of four containers) and the render's own container
    nears its timeout. At the deadline every slice not back is cancelled, its container stopped, and the render fails in
    words the creator can act on."""
    calls += [Call(0.05, "a"), Call(30, "b"), Call(30, "c")]
    started = time.monotonic()
    with pytest.raises(Refusal, match=f"^{BUSY}$"):
        collect(calls, lambda: time.sleep(0.02), deadline=started + 0.4)
    assert 0.4 <= time.monotonic() - started < 5
    assert [call.cancelled for call in calls] == [None, True, True]  # the one back is left as it is
    assert BUSY == "the render machines are busy; try again"


def test_a_render_stopped_while_its_slices_draw_cancels_them(calls):
    """B1(b): `wait()` raises when the job was written failed by the app (store.Stopped); every slice still drawing is
    cancelled and that error is raised."""
    calls += [Call(30, "a"), Call(30, "b")]
    looks = []

    def wait():
        looks.append(1)
        time.sleep(0.02)
        if len(looks) == 3:
            raise RuntimeError("the job was stopped")

    with pytest.raises(RuntimeError, match="^the job was stopped$"):
        collect(calls, wait)
    assert [call.cancelled for call in calls] == [True, True]
