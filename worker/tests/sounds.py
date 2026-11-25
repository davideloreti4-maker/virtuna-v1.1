"""What the speech tests share: generated sounds at 16 kHz, and the owner's take where it is (the speech image on Modal)."""

import importlib.util
import math
import random
from array import array
from pathlib import Path

import pytest

from media.sound import PER_MS

# The owner's take's 16 kHz sound in the Volume edit-dev-media, mounted in the suite's container.
TAKE = Path("/dev-media/takes/take.mp4/sound16k.wav")
TAKE_MS = 12714

in_the_speech_image = pytest.mark.skipif(
    importlib.util.find_spec("whisperx") is None or not TAKE.exists(),
    reason="the models and the owner's take are in the speech image on Modal",
)


def sine(ms: int, amp: int = 8000, hz: float = 440) -> array:
    return array("h", (round(amp * math.sin(2 * math.pi * hz * i / 16000)) for i in range(ms * PER_MS)))


def noise(ms: int, rms: float, seed: int = 1) -> array:
    """Low noise standing in for a room: Gaussian, about `rms` in 16-bit units."""
    rnd = random.Random(seed)
    return array("h", (max(-32768, min(32767, round(rnd.gauss(0, rms)))) for _ in range(ms * PER_MS)))


def silence(ms: int) -> array:
    return array("h", bytes(2 * ms * PER_MS))


def mixed(*sounds: array) -> array:
    return array("h", (max(-32768, min(32767, sum(s))) for s in zip(*sounds)))


def segments(*ms: tuple[int, int]) -> list[tuple[int, int]]:
    """Speech segments in samples, as Silero gives them, from milliseconds."""
    return [(a * PER_MS, b * PER_MS) for a, b in ms]
