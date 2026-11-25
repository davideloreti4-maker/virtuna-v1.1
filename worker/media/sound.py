"""The take's sound for speech, sound16k.wav as `transcode` makes it: 16 kHz, one channel, 16 bits."""

import wave
from array import array
from pathlib import Path

from media.refusal import Refusal

RATE = 16000
PER_MS = RATE // 1000


def read16k(path: str | Path) -> array:
    """Its samples, as 16-bit integers. Raises ValueError for any other kind of WAV."""
    with wave.open(str(path)) as file:
        kind = (file.getframerate(), file.getnchannels(), file.getsampwidth())
        if kind != (RATE, 1, 2):
            raise Refusal(f"{path}: {kind[0]} Hz, {kind[1]} channels, {8 * kind[2]} bits; the speech steps take 16 kHz, one channel, 16 bits")
        # WAV is little-endian, as the worker's machines (x86 and ARM) are, so the bytes are the samples.
        return array("h", file.readframes(file.getnframes()))


def write16k(samples: array, path: str | Path) -> Path:
    """`samples` (16-bit integers) as a 16 kHz, one-channel WAV at `path`."""
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(samples.tobytes())
    return Path(path)


def as_float(samples: array):
    """The samples as numpy float32 from -1 to 1, as the models take them (numpy: the speech image)."""
    import numpy as np

    return np.frombuffer(samples, dtype=np.int16).astype(np.float32) / 32768


def length_ms(samples: array) -> int:
    """Whole milliseconds, rounded down: never longer than the sound."""
    return len(samples) // PER_MS
