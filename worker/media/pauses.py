"""Where a cut may land (X47, N3): the pauses in a take's sound, measured, never read off a transcript.

Silero VAD says where speech is, on a grid of 32 ms windows. Each gap between two of its speech
segments is then placed on the sound itself: on its energy above 300 Hz (where speech is; a room's
hum lies below it), in 10 ms windows of RMS energy a millisecond apart:
- the gap's floor is the 20th percentile of the windows inside it, so a breath or a click does not set it;
- its edges are where the speech's sound meets it: from where Silero ended the speech, the sound is
  followed into the gap while it stands 6 dB above the floor (as far as the gap's middle), so a
  fading end or a soft start ("s", "h") that Silero leaves out stays out of the pause; where Silero's
  boundary is already quiet, the nearest window above it is looked for up to 64 ms (two of Silero's
  windows) back into the speech. The same from where Silero started the next speech. Each edge is
  the millisecond where the last loud window and its quiet neighbour differ (M5);
- gaps whose measured edges overlap or touch (around a short sound Silero calls speech that the edges
  pass over) are one (F1);
- a gap of at least 120 ms is a pause; so are the take's head (from 0) and tail (to the sound's end),
  measured the same way, since the first and the last cut trim them (X54). Pauses come in order, none
  touching the next, checked;
- its cut is the middle of its quietest 10 ms by the whole sound's energy (M12: a cut must not land on
  a low thump the edges do not hear); where several windows are equally quiet (digital silence), the
  middle of the longest run of them.

A pause's edges lean inward: anything 6 dB above the room counts as sound, so a pause never takes in
the tail of a word or a breath before one. Between two abrupt sounds a pause reads a few ms shorter
than its silence, where the high-pass filter rings after the sound before it.

Why above 300 Hz: on the owner's take the room hums under 300 Hz louder than a quiet "We" (4.21 s);
in the whole sound's energy that word does not stand 6 dB over the floor, and a pause took it in.

Silero is set so that it hides no gap and keeps every word (plan, Task 4):
- `speech_pad_ms=0`: its padding would cover 30 ms of each gap's edges;
- `min_silence_duration_ms=32`: a segment ends once two of its windows read as not speech, so a
  gap of 120 ms (three windows and more) is never merged into the speech around it;
- `min_speech_duration_ms=0`: no speech is thrown away, so a short word never lies inside a pause;
- `threshold=0.35` (and its exit threshold 0.2 with it), under Silero's own 0.5: a word missed is a
  cut inside it, a pause missed only one place less to cut. On the owner's take the quiet "We" reads
  0.49, the room in its pauses 0.02 to 0.14 and a mouth click 0.43.
"""

import math
from array import array
from functools import cache
from collections.abc import Callable, Sequence
from itertools import accumulate
from pathlib import Path
from typing import TypedDict

from media.sound import PER_MS, as_float, read16k

HIGH_PASS_HZ = 300
MIN_PAUSE_MS = 120
WINDOW_MS = 10
REACH_MS = 64
ABOVE_FLOOR = 4.0  # in energy: 6 dB
FLOOR_SHARE = 0.2

SILERO = {"threshold": 0.35, "min_speech_duration_ms": 0, "min_silence_duration_ms": 32, "speech_pad_ms": 0}


class Pause(TypedDict):
    startMs: int
    endMs: int
    cutMs: int  # where a cut lands: the middle of the pause's quietest 10 ms


def pauses(sound16k: str | Path) -> list[Pause]:
    """The pauses in a 16 kHz sound (sound16k.wav), in order."""
    samples = read16k(sound16k)
    return pauses_between(samples, speech(samples))


def speech(samples: array) -> list[tuple[int, int]]:
    """Silero VAD's speech segments, (start, end) in samples; none for a sound of no samples, before any
    model is loaded. Needs torch and Silero: the speech image."""
    if not samples:
        return []
    import torch

    threads = torch.get_num_threads()
    from silero_vad import get_speech_timestamps, load_silero_vad

    torch.set_num_threads(threads)  # importing Silero sets torch to one thread for the whole process
    found = get_speech_timestamps(torch.from_numpy(as_float(samples)), load_silero_vad(), sampling_rate=16000, **SILERO)
    return [(segment["start"], segment["end"]) for segment in found]


def pauses_between(samples: Sequence[int], speech: list[tuple[int, int]]) -> list[Pause]:
    """The pauses between speech segments given in samples, and the take's head and tail (X54), placed on
    the energy of `samples` (16 kHz) above 300 Hz and cut on the whole sound's. None without speech."""
    if not speech:
        return []
    energy, cut = Energy(above(HIGH_PASS_HZ, samples)), cutter(samples)
    found = []
    # The head runs from the sound's start to the first speech, the tail from the last speech to the
    # sound's end: each measured like a gap, its speech side found the same way.
    gaps = [(None, 0, speech[0][0], speech[0][1]), *((a, b, c, d) for (a, b), (c, d) in zip(speech, speech[1:])),
            (speech[-1][0], speech[-1][1], len(samples), None)]
    for before_start, gap_start, gap_end, after_end in gaps:
        g0, g1 = gap_start // PER_MS, -(-gap_end // PER_MS)
        inside = energy.windows(g0, g1)
        if not inside:
            continue
        floor = sorted(inside)[int(FLOOR_SHARE * len(inside))]
        loud = ABOVE_FLOOR * floor
        middle = g0 if before_start is None else g1 if after_end is None else (g0 + g1) // 2
        start = 0 if before_start is None else energy.edge(loud, g0, toward=middle, back_to=max(g0 - REACH_MS, before_start // PER_MS))
        end = len(samples) // PER_MS if after_end is None else energy.edge(loud, g1, toward=middle, back_to=min(g1 + REACH_MS, after_end // PER_MS))
        if end <= start:
            continue
        # Pauses that overlap or touch are one (F1): the edges can pass over a short sound Silero calls speech.
        if found and start <= found[-1][1]:
            found[-1] = (found[-1][0], max(found[-1][1], end))
        else:
            found.append((start, end))
    return in_order([Pause(startMs=a, endMs=b, cutMs=cut(a, b)) for a, b in found if b - a >= MIN_PAUSE_MS])


def in_order(pauses: list[Pause]) -> list[Pause]:
    """`pauses`, checked to be in order, each with its cut inside it and none touching the next (F1)."""
    for pause, after in zip(pauses, [*pauses[1:], None]):
        if not pause["startMs"] <= pause["cutMs"] <= pause["endMs"] or (after and pause["endMs"] >= after["startMs"]):
            raise RuntimeError(f"pauses out of order or overlapping: {pauses}")
    return pauses


def cutter(samples: Sequence[int]) -> Callable[[int, int], int]:
    """Where a cut lands between two ms of `samples`: the middle of the quietest 10 ms by the whole sound's
    RMS energy (M12), so a cut never lands on a thump below 300 Hz that the edges do not hear. Its table
    of energies is built at the first cut asked for, so only when one is (N6)."""
    energy = cache(lambda: Energy(samples))
    return lambda a, b: energy().quietest(a, b)


def above(hz: float, samples: Sequence[int]) -> list[int]:
    """The sound above `hz`: two second-order Butterworth high-passes, 24 dB an octave below it. In
    whole 16-bit steps, so that energies add up exactly and a filter's fading tail ends in silence."""
    w = 2 * math.pi * hz / 16000
    cos, alpha = math.cos(w), math.sin(w) / math.sqrt(2)
    b0, b1, a1, a2 = (1 + cos) / 2 / (1 + alpha), -(1 + cos) / (1 + alpha), -2 * cos / (1 + alpha), (1 - alpha) / (1 + alpha)
    out = samples
    for _ in range(2):
        passed, z1, z2 = [], 0.0, 0.0
        for s in out:
            y = b0 * s + z1
            z1, z2 = b1 * s - a1 * y + z2, b0 * s - a2 * y
            passed.append(y)
        out = passed
    return [round(y) for y in out]


class Energy:
    """The mean square of the 10 ms window starting at each millisecond of a 16 kHz sound."""

    def __init__(self, samples: Sequence[int]):
        self.sums = list(accumulate((s * s for s in samples), initial=0))
        self.last = (len(self.sums) - 1) // PER_MS - WINDOW_MS  # the last window that fits

    def at(self, ms: int) -> float:
        a, b = ms * PER_MS, (ms + WINDOW_MS) * PER_MS
        return (self.sums[b] - self.sums[a]) / (b - a)

    def windows(self, a: int, b: int) -> list[float]:
        """The windows wholly inside [a, b) ms."""
        return [self.at(ms) for ms in range(max(a, 0), min(b - WINDOW_MS, self.last) + 1)]

    def edge(self, level: float, at: int, toward: int, back_to: int) -> int:
        """Where the sound at Silero's boundary `at` (ms) meets the gap: from the window there, followed into
        the gap while windows stay above `level`, as far as `toward` (the gap's middle); or, when that
        window is already quiet, from the nearest window above it back to `back_to`, in the speech
        (`back_to` itself when none is). The edge is the millisecond by which that last loud window
        differs from its quiet neighbour: its first when the gap lies after it, its last when before (M5)."""
        step = 1 if toward > at else -1
        if self.loud(at, level):
            while at + step != toward and self.loud(at + step, level):
                at += step
        else:
            at = next((ms for ms in range(at - step, back_to - step, -step) if self.loud(ms, level)), None)
            if at is None:
                return back_to
        return at + 1 if step > 0 else at + WINDOW_MS - 1

    def loud(self, ms: int, level: float) -> bool:
        return 0 <= ms <= self.last and self.at(ms) > level

    def quietest(self, a: int, b: int) -> int:
        """The middle of the quietest window wholly inside [a, b) ms, or of the longest run of equally quiet ones."""
        first = max(a, 0)
        inside = self.windows(first, b)
        least = min(inside)
        best_at, best_len, run_at = first, 0, None
        for i, value in enumerate(inside + [None]):
            if value == least:
                run_at = i if run_at is None else run_at
                continue
            if run_at is not None and i - run_at > best_len:
                best_at, best_len = run_at, i - run_at
            run_at = None
        # The run's windows start at best_at … best_at + best_len - 1; its middle is halfway between their middles.
        return first + best_at + (best_len - 1) // 2 + WINDOW_MS // 2
