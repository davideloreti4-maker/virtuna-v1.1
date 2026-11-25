"""What is said in a take, each word timed on the take's own sound (X46, N3), agreed with its pauses (X54).

Silero first (`media/pauses.py`): a take where it hears no speech has no words and no pauses, and no
text model or aligner runs (R6). Otherwise the pauses are measured, and the text comes from a model
that listens: Scribe when there is an ElevenLabs key, faster-whisper `large-v3-turbo` (int8, on the
CPU) when there is not, given only the stretches of sound between the pauses (R6). When Scribe answers
429 or 5xx (ElevenLabs busy or failing, not the take), Whisper hears the words in its place, and the
analysis records it (`fellBack`, M4). Neither one's times are used, not even a segment's: the aligner is
given the whole text and the whole sound.

The times come from WhisperX's forced aligner (`load_align_model` and `align`): a wav2vec2 model
that hears letters, laid along the text by CTC, its emissions heard in windows (R2). It is given the
words as they are said (`say`): lower case, no punctuation, numbers and symbols spelled out in the
language. A word keeps the text the listening model gave it, punctuation attached, in pieces of at
most 80 characters (M4). A word the aligner cannot time (one with nothing to say, such as a dash)
takes the span between its timed neighbours: still the sound's times. Such words are counted, as
`untimed`. Last, the words and the pauses are made to meet (`agree`, X54): a pause gives way to a word
only where Silero hears speech inside it (H1); elsewhere the word is trimmed out of it (`trimmed`), or
taken out of the words when nothing of it is left (`dropped`).

A reference (part 3) is never heard (X103, which narrows X98): no listening model and no aligner run, Scribe is not
called, and it keeps only its pauses, as Silero measures them, since its pace is read from its cuts and pauses and its
captions from its picture (X101). So it may be in any language, and its words are neither paid for nor stored. A language
given is held to X55 all the same: it is the caller's word.

Scribe's model is `scribe_v3`: ElevenLabs' current model for recorded audio, which their models page
(read 2026-11-20) calls their most accurate for it; `scribe_v2` is its legacy predecessor and
`scribe_v1` is deprecated.

The models run in the speech image, where `media/models.py` puts them; the rest is plain Python.
"""

import json
import re
import unicodedata
import urllib.error
import urllib.request
import uuid
from decimal import Decimal
from functools import cache
from pathlib import Path
from collections.abc import Callable, Sequence
from typing import TypedDict

from num2words import num2words

from media.models import ALIGN_DIR, ALIGNERS, WHISPER_DIR
from media.pauses import MIN_PAUSE_MS, Pause, cutter, in_order, pauses_between, speech
from media.refusal import Refusal
from media.sound import PER_MS, RATE, as_float, length_ms, read16k

SCRIBE_URL = "https://api.elevenlabs.io/v1/speech-to-text"
SCRIBE_MODEL = "scribe_v3"
WHISPER = {"beam_size": 5, "word_timestamps": False, "vad_filter": False}
# One cased, punctuated sentence a language, sharing no word with the owner's take (R3).
PROMPTS = {
    "en": "Okay, so today I'm showing you something new.",
    "de": "Okay, heute zeige ich euch etwas Neues.",
    "it": "Okay, oggi vi mostro qualcosa di nuovo.",
}

# ISO 639-3 and 639-2 codes (Scribe may answer "eng") to 639-1, for the languages that have an aligner.
ISO_639_1 = {"eng": "en", "deu": "de", "ger": "de", "ita": "it"}


class Word(TypedDict):
    text: str
    startMs: int
    endMs: int


class Agreed(TypedDict):
    """The words and the pauses once they meet (`agree`), and what meeting did, for the record."""

    words: list[Word]
    pauses: list[Pause]
    apart: int  # words around a pause left where the aligner put them, more than 250 ms from its edge
    gaveWay: int  # pauses that gave way where Silero hears speech inside them under a word (H1)
    trimmed: int  # words trimmed out of a pause where Silero hears no speech: the aligner laid them over silence (H1)
    dropped: int  # words taken out of `words`: wholly inside such a pause, further than 60 ms from both its edges (H1)


class Speech(Agreed):
    language: str | None  # ISO 639-1; None when nothing was said and none was given
    untimed: int  # words given their neighbours' span, for the record
    fellBack: int | None  # Scribe's answer (429 or 5xx) when Whisper heard the words in its place (M4); None otherwise


def nothing(language: str | None, pauses: Sequence[Pause] = ()) -> Speech:
    """No words: a take with no speech, too little of it, no sound, or nothing the aligner can say (with its pauses)."""
    return Speech(language=language, words=[], untimed=0, apart=0, gaveWay=0, trimmed=0, dropped=0, pauses=list(pauses), fellBack=None)


def words(sound16k: str | Path, language: str | None = None, key: str | None = None, *, threads: int = 0,
          reference: bool = False) -> Speech:
    """The words said in a 16 kHz sound (sound16k.wav), timed on it, and its pauses, agreed (X54).
    `language` (ISO 639-1) or found by the listening model; `key`, an ElevenLabs key, chooses Scribe.
    `threads` 0 leaves the libraries theirs. `reference`: the sound is a reference's, which is not heard (X103).

    Raises ValueError for a language with no aligner in the image (X55): a given one before any model
    runs (a reference's too), a detected one before any aligner loads."""
    if language is not None:
        language = language_of(language)
    samples = read16k(sound16k)
    return hear(sound16k, samples, speech(samples), language, key, threads, reference)


MIN_HEARD_MS = 500  # less speech than this, and no text model runs (G2)


def hear(sound16k: str | Path, samples, found_speech: list[tuple[int, int]], language: str | None, key: str | None, threads: int,
         reference: bool = False) -> Speech:
    """`words` from Silero's speech segments (in samples) on: the pauses, then the text and its times.

    No speech, or under half a second of it to hear (G2), gives no words and no pauses, `language` as
    given, and no text model runs: on a click or a lone sound, language detection and Whisper's prompt
    are how B-roll would get a made-up word or a wrong language. A take whose only speech is one very
    short word gets no words (X54's limit). With a key, Scribe hears the whole sound; its text is text
    only, and the aligner places it (N5, N3).

    A reference (X103) is not heard: it has no words, no language (none was heard) and the pauses as found
    here, where a take's would be heard; with no speech, or too little, it has neither, as a take has. No
    listening model, no aligner and no service is asked."""
    if reference:
        language = None
    if not found_speech:
        return nothing(language)
    found_pauses = pauses_between(samples, found_speech)
    speech_ms = [(a // PER_MS, -(-b // PER_MS)) for a, b in found_speech]
    to_hear = stretches(found_pauses, length_ms(samples), speech_ms)
    if too_little(to_hear):
        return nothing(language)
    if reference:
        return nothing(None, found_pauses)
    fell_back = None
    if key:
        try:
            texts, language = scribe(sound16k, language, key)
        except ScribeFailing as failing:  # ElevenLabs' moment, not the take's (M4)
            print(f"Scribe answered {failing.status}: Whisper hears the words in its place", flush=True)
            fell_back = failing.status
    if not key or fell_back is not None:
        texts, language = whisper(samples, to_hear, language, threads)
    return {**timed(texts, language, samples, found_pauses, speech_ms, threads), "fellBack": fell_back}


def too_little(to_hear: list[tuple[int, int]]) -> bool:
    """Whether stretches (ms) add up to less than half a second of sound to hear (G2)."""
    return sum(b - a for a, b in to_hear) < MIN_HEARD_MS


def timed(texts: list[str], language: str, samples, found_pauses: list[Pause], found_speech: list[tuple[int, int]], threads: int) -> Speech:
    """The words of `texts` timed on `samples` by the aligner and agreed with the pauses and Silero's speech
    segments (ms). Text with nothing the aligner can say (only "…" or "—") gives no words, and the aligner
    does not run."""
    spoken = [say(text, language) for text in texts]
    if not any(spoken):
        return nothing(language, found_pauses)
    aligned = align([token for tokens in spoken for token in tokens], language, samples, threads)
    found, untimed = place(texts, spoken, aligned, length_ms(samples))
    agreed = agree(found, found_pauses, found_speech, length_ms(samples), cutter(samples))
    return Speech(language=language, untimed=untimed, fellBack=None, **agreed)


def load(language: str, key: str | None = None, *, threads: int = 0) -> None:
    """Loads the models `words` would use for `language`, so their loading can be timed apart."""
    if not key:
        _whisper(threads)
    _aligner(language_of(language))


class NoAligner(Refusal):
    """A language whose aligner is not in the image (X55); `code` as it was given or heard."""

    def __init__(self, code: str):
        super().__init__(f"no aligner for the language {code!r}: the image has {', '.join(ALIGNERS)}")
        self.code = code

    def __reduce__(self):  # made again from its code when it is unpickled (Modal sends a function's error back so)
        return NoAligner, (self.code,)


def language_of(code: str) -> str:
    """ISO 639-1 for a language that has an aligner; NoAligner (a ValueError) for any other."""
    iso = ISO_639_1.get(code.lower(), code.lower())
    if iso not in ALIGNERS:
        raise NoAligner(code)
    return iso


# The words as the aligner is given them.

APOSTROPHES = "'’ʼ`´"
CURRENCY = "$€£"
NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
SAID = {
    "en": {"&": "and", "+": "plus", "%": "percent", "@": "at", "=": "equals", "$": "dollars", "€": "euros", "£": "pounds"},
    "de": {"&": "und", "+": "plus", "%": "prozent", "@": "at", "=": "gleich", "$": "dollar", "€": "euro", "£": "pfund"},
    "it": {"&": "e", "+": "più", "%": "percento", "@": "chiocciola", "=": "uguale", "$": "dollari", "€": "euro", "£": "sterline"},
}
# Decimal point and thousands separator, as each language writes them.
SEPARATORS = {"en": (".", ","), "de": (",", "."), "it": (",", ".")}


def say(text: str, language: str) -> list[str]:
    """`text` as it is said: lower-case words without punctuation, numbers and symbols spelled out."""
    text = unicodedata.normalize("NFC", text).lower()
    for mark in APOSTROPHES:
        text = text.replace(mark, "")  # don't → dont: one word
    text = re.sub(rf"([{CURRENCY}])\s*({NUMBER.pattern})", r"\2 \1", text)  # $5 is said "five dollars"
    if language == "en":
        text = re.sub(r"(\d+)(?:st|nd|rd|th)\b", lambda m: f" {num2words(int(m[1]), lang='en', to='ordinal')} ", text)
    text = re.sub(r"(?<=\d)(?=[^\W\d_])|(?<=[^\W\d_])(?=\d)", " ", text)  # 3d → 3 d
    text = NUMBER.sub(lambda m: f" {spell(m[0], language)} ", text)
    text = "".join(f" {SAID[language][c]} " if c in SAID[language] else c for c in text)
    return [word for word in re.split(r"[\W_]+", text.lower()) if word]


def spell(number: str, language: str) -> str:
    """A number written with digits, in words: 1,000 and 3.5 in English, 1.000 and 3,5 in German and Italian."""
    point, thousands = SEPARATORS[language]
    number = re.sub(rf"{re.escape(thousands)}(?=\d{{3}}(?!\d))", "", number)
    if thousands in number or number.count(point) > 1:  # not one number: each said apart (1,2 in English)
        return " ".join(spell(part, language) for part in re.split(r"[.,]", number) if part)
    whole, _, fraction = number.partition(point)
    try:
        if fraction:
            return num2words(Decimal(f"{whole}.{fraction}"), lang=language)
        if len(whole) == 4 and 1100 <= int(whole) <= 2099:
            return num2words(int(whole), lang=language, to="year")  # 2026: twenty twenty-six
        return num2words(int(whole), lang=language)
    except (OverflowError, NotImplementedError):
        return " ".join(num2words(int(digit), lang=language) for digit in number if digit.isdigit())


# The aligner's times as words.

def place(texts: list[str], spoken: list[list[str]], aligned: list[tuple[float, float] | None], sound_ms: int) -> tuple[list[Word], int]:
    """`Word[]` from the aligner's (start, end) in seconds for each spoken word, in order (None where it
    gave none); a word of several spoken ones spans them all. Whole ms; starts never decrease; no end
    past `sound_ms`. Gives the words and how many were untimed. RuntimeError when none was timed."""
    if sum(map(len, spoken)) != len(aligned):
        raise Refusal(f"{len(aligned)} times for {sum(map(len, spoken))} spoken words")
    spans: list[tuple[int, int] | None] = []
    at = 0
    for tokens in spoken:
        timed = [span for span in aligned[at:at + len(tokens)] if span is not None]
        at += len(tokens)
        spans.append((round(min(a for a, _ in timed) * 1000), round(max(b for _, b in timed) * 1000)) if timed else None)
    if not any(spans):
        raise RuntimeError(f"the aligner timed none of the {len(texts)} words")

    found: list[Word] = []
    last = 0
    for i, (text, span) in enumerate(zip(texts, spans)):
        if span is None:
            before = next((s[1] for s in reversed(spans[:i]) if s), 0)
            after = next((s[0] for s in spans[i + 1:] if s), sound_ms)
            span = (before, max(before, after))
        start = min(max(span[0], last), sound_ms)
        found += pieces(text, start, min(max(span[1], start), sound_ms))
        last = start
    return found, spans.count(None)


MOST_CHARACTERS = 80  # a word's text in an edit (src/lib/edit/atoms.ts)


def pieces(text: str, start: int, end: int) -> list[Word]:
    """`text` from `start` to `end` as words of at most 80 characters (M4), the span shared by characters."""
    if len(text) <= MOST_CHARACTERS:
        return [Word(text=text, startMs=start, endMs=end)]
    found, at = [], start
    for first in range(0, len(text), MOST_CHARACTERS):
        piece = text[first:first + MOST_CHARACTERS]
        until = start + round((end - start) * (first + len(piece)) / len(text))
        found.append(Word(text=piece, startMs=at, endMs=until))
        at = until
    return found


# Words and pauses agree (X54, as amended in fix round 1 and by H1).

AGREE_MS = 250  # a word this near a pause's edge, outside it, is moved to the edge
INTO_MS = 60  # a word this far into a pause is moved to its edge (test 5's mark); further, it is trimmed or the pause gives way


def agree(found: list[Word], pauses: list[Pause], speech: list[tuple[int, int]], sound_ms: int, cut: Callable[[int, int], int]) -> Agreed:
    """The words and the pauses made to meet (X54): a cut lands only in a pause, so no word lies inside one.
    `speech` is Silero's speech segments, in ms.

    - First, a word reaching more than 60 ms into a pause makes it give way only where Silero hears speech
      inside it under the word (H1): the speech segments lying wholly inside the pause, the ones its
      measured edges passed over (G1's quiet word, F1's merged click). A segment that crosses a pause's
      edge is the speech on that side, whose edge the sound's energy already placed: up to 64 ms into
      Silero's speech where it is quiet there (`REACH_MS` in pauses.py), so it never makes a pause give way.
      Where the pause gives way it is cut out under the word's speech; a part under 120 ms goes, a part
      left is cut again where `cut` says.
    - Then a word that still reaches into a pause left is trimmed out of it: when it starts before the pause
      and ends inside it or at its end, its end is moved to the pause's start; otherwise its start is moved
      to the pause's end, so a word over the whole pause keeps its end, since the aligner's known failure is
      to pull a word's start into the silence before it (F2). One reaching at most 60 ms in is X54's move to
      the edge (G3: never to an edge that is gone); one reaching further is counted in `trimmed`. A word
      wholly inside a pause is shifted out to the nearer edge with its length kept when it lies within 60 ms
      of it (not into the pause beside it), else taken out of the words and counted in `dropped`.
    - A pause that gave way under speech no word is left over, once the words are trimmed, takes that
      stretch back; given back all of it, it is as it was and did not give way. The words are then trimmed
      out of what it took back.
    - Then, around each pause, the last word before it ends at its start and the first word after it
      starts at its end, when within 250 ms outside it; a word further off is left where the aligner put
      it and counted in `apart`. Nothing lies before a head from 0 or after a tail to `sound_ms`.
    RuntimeError if a word still lies inside a pause, or spans one (the rule above makes that impossible)."""
    agreed = [Word(text=x["text"], startMs=x["startMs"], endMs=x["endMs"]) for x in found]
    # First every pause gives way where Silero hears speech inside it under a word reaching more than 60 ms in (G3, H1) ...
    ways: list[tuple[Pause, list[tuple[int, int]]]] = []  # each pause, and the stretches it gives way over
    for pause in sorted(pauses, key=lambda q: q["startMs"]):
        a, b = pause["startMs"], pause["endMs"]
        heard_inside = [(s, e) for s, e in speech if a <= s and e <= b]
        under = [(max(s, word["startMs"]), min(e, word["endMs"])) for word in agreed
                 if word["endMs"] > a and word["startMs"] < b and not near(word, a, b) for s, e in heard_inside]
        ways.append((pause, [(s, e) for s, e in under if s < e]))
    trimmed, dropped = set(), set()

    def trim(kept: list[Pause]) -> None:
        """... then every word still in a pause is moved, trimmed or shifted out of it, or dropped."""
        for i, pause in enumerate(kept):
            a, b = pause["startMs"], pause["endMs"]
            for n, word in enumerate(agreed):
                if n in dropped or not (word["startMs"] < b and a < word["endMs"]):
                    continue
                start, end, far = word["startMs"], word["endMs"], not near(word, a, b)
                if a <= start and end <= b and min(b - start, end - a) <= INTO_MS:  # wholly inside, at an edge
                    if b - start <= end - a:
                        span = b, min(b + end - start, kept[i + 1]["startMs"] if i + 1 < len(kept) else sound_ms)
                    else:
                        span = max(a - (end - start), kept[i - 1]["endMs"] if i else 0), a
                    if span[0] < span[1]:
                        word["startMs"], word["endMs"] = span
                    else:  # no room: the take's head before it, or its tail after it (155)
                        dropped.add(n)
                    continue
                if start < a and end <= b:
                    word["endMs"] = a
                else:
                    word["startMs"] = b
                if far:
                    (dropped if word["startMs"] >= word["endMs"] else trimmed).add(n)

    kept = given_way(ways, cut)
    trim(kept)
    # ... and a pause takes back the stretches no word is left over (M1).
    ways = [(pause, [(s, e) for s, e in under if any(x["startMs"] < e and s < x["endMs"] for n, x in enumerate(agreed) if n not in dropped)])
            for pause, under in ways]
    kept = given_way(ways, cut)
    trim(kept)
    gave_way = sum(1 for _, under in ways if under)
    agreed = [word for n, word in enumerate(agreed) if n not in dropped]

    left = set()
    for i, pause in enumerate(kept):
        before = [n for n, x in enumerate(agreed) if x["endMs"] <= pause["startMs"] and (i == 0 or x["startMs"] >= kept[i - 1]["endMs"])]
        after = [n for n, x in enumerate(agreed) if x["startMs"] >= pause["endMs"] and (i == len(kept) - 1 or x["endMs"] <= kept[i + 1]["startMs"])]
        if before and pause["startMs"] > 0:
            word = agreed[before[-1]]
            if pause["startMs"] - word["endMs"] <= AGREE_MS:
                word["endMs"] = pause["startMs"]
            else:
                left.add(before[-1])
        if after and pause["endMs"] < sound_ms:
            word = agreed[after[0]]
            if word["startMs"] - pause["endMs"] <= AGREE_MS:
                word["startMs"] = pause["endMs"]
            else:
                left.add(after[0])

    last = 0
    for word in agreed:
        word["startMs"] = last = max(word["startMs"], last)
        word["endMs"] = max(word["endMs"], word["startMs"])
    return Agreed(words=outside_pauses(agreed, kept), pauses=in_order(kept), apart=len(left), gaveWay=gave_way,
                  trimmed=len(trimmed), dropped=len(dropped))


def given_way(ways: list[tuple[Pause, list[tuple[int, int]]]], cut: Callable[[int, int], int]) -> list[Pause]:
    """The pauses once each has given way over its stretches (ms): what is left of it, parts under 120 ms gone and the
    rest cut again where `cut` says; a pause with none, as it was."""
    kept: list[Pause] = []
    for pause, under in ways:
        parts = [(pause["startMs"], pause["endMs"])]
        for s, e in under:
            parts = [(x, y) for c, d in parts for x, y in ((c, min(d, s)), (max(c, e), d)) if x < y]
        kept += [Pause(startMs=s, endMs=e, cutMs=cut(s, e)) for s, e in parts if e - s >= MIN_PAUSE_MS] if under else [pause]
    return kept


def near(word: Word, a: int, b: int) -> bool:
    """Whether `word` reaches at most 60 ms into the pause from `a` to `b` ms across one of its edges (X54's move)."""
    return (word["startMs"] < a < word["endMs"] <= b and word["endMs"] - a <= INTO_MS
            or a <= word["startMs"] < b < word["endMs"] and b - word["startMs"] <= INTO_MS)


def outside_pauses(found: list[Word], pauses: list[Pause]) -> list[Word]:
    """`found`, checked to have no word inside a pause: none shares a millisecond with one, whether it
    starts or ends inside it or spans all of it. A word may meet a pause at its edges. RuntimeError
    naming the first that does not."""
    for word in found:
        if any(word["startMs"] < q["endMs"] and q["startMs"] < word["endMs"] for q in pauses):
            raise RuntimeError(f"{word} lies inside a pause after agreeing: {pauses}")
    return found


# The aligner's windows (R2): wav2vec2 hears 400 samples for each frame, every 320 (20 ms). A long sound
# is heard 30 s at a time with 3 s more on each side, and only each window's middle frames are kept, so
# memory does not grow with the square of the sound's length; the whole text is then aligned at once.

FRAME, HEARD = 320, 400
WINDOW_FRAMES, CONTEXT_FRAMES = 30 * 50, 3 * 50


def frames(samples: int) -> int:
    """wav2vec2's frames for a sound of `samples` samples."""
    return 0 if samples < HEARD else (samples - HEARD) // FRAME + 1


def windows(samples: int, per: int = WINDOW_FRAMES, context: int = CONTEXT_FRAMES) -> list[tuple[int, int, int, int]]:
    """The windows a sound of `samples` samples is heard in: (first sample, last sample (exclusive), the
    first of its frames kept, how many). Each keeps `per` frames, heard with up to `context` frames more
    on each side; joined, the kept frames are the whole sound's, each from the same samples."""
    total = frames(samples)
    found = []
    for a in range(0, total, per):
        b = min(a + per, total)
        before, after = min(context, a), min(context, total - b)
        found.append(((a - before) * FRAME, (b - 1 + after) * FRAME + HEARD, before, b - a))
    return found


# The models (in the speech image).

def whisper(samples, to_hear: list[tuple[int, int]], language: str | None, threads: int) -> tuple[list[str], str]:
    """faster-whisper's words, as it writes them, and the language: the one given, or the one it detects.

    Whisper hears only `to_hear` (`stretches`, R6 and G1): Silero's speech and the stretches between the
    measured pauses, so no room tone, music or noise, and it makes up no text there. They are joined by
    faster-whisper's own `collect_chunks`, as its VAD path joins its own chunks; their times are never
    used. A language with no aligner fails as soon as it is detected,
    before the words are heard or any aligner loads (X55, M3). Whisper is then prompted with one cased
    and punctuated sentence in that language (`PROMPTS`, R3), so it writes so too."""
    import numpy as np
    from faster_whisper.vad import collect_chunks

    audio = as_float(samples)
    audio = np.concatenate(collect_chunks(audio, [{"start": a * PER_MS, "end": b * PER_MS} for a, b in to_hear])[0])
    model = _whisper(threads)
    if language is None:
        language = language_of(model.detect_language(audio)[0])
    segments, _ = model.transcribe(audio, language=language, initial_prompt=PROMPTS[language], **WHISPER)
    return " ".join(segment.text for segment in segments).split(), language


def stretches(found_pauses: list[Pause], sound_ms: int, found_speech: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """What Whisper hears of a sound of `sound_ms` (G1): Silero's speech segments (ms) and the stretches
    between the pauses, merged and in order. A quiet word Silero hears inside a measured pause is heard,
    so the aligner places it and the pause gives way to it (X54)."""
    between, at = [], 0
    for pause in sorted(found_pauses, key=lambda q: q["startMs"]):
        if pause["startMs"] > at:
            between.append((at, pause["startMs"]))
        at = max(at, pause["endMs"])
    between += [(at, sound_ms)] if at < sound_ms else []
    found: list[tuple[int, int]] = []
    for a, b in sorted([*between, *((max(a, 0), min(b, sound_ms)) for a, b in found_speech)]):
        if found and a <= found[-1][1]:
            found[-1] = (found[-1][0], max(found[-1][1], b))
        elif a < b:
            found.append((a, b))
    return found


@cache
def _whisper(threads: int):
    from faster_whisper import WhisperModel

    return WhisperModel(WHISPER_DIR, device="cpu", compute_type="int8", cpu_threads=threads)


def align(spoken: list[str], language: str, samples, threads: int) -> list[tuple[float, float] | None]:
    """Each spoken word's (start, end) in seconds on the sound, by WhisperX's aligner; None where it gave none.
    The whole text on the whole sound as one segment, its emissions heard in windows (`windows`)."""
    import torch
    import whisperx

    if threads:
        torch.set_num_threads(threads)
    model, metadata = _aligner(language)
    segment = {"text": " ".join(spoken), "start": 0.0, "end": len(samples) / RATE}
    # Every word given has a letter, and WhisperX aligns every character (one outside its dictionary as
    # a wildcard), so every word gets a start and an end and no NaN reaches its pandas steps; "ignore"
    # only says that WhisperX is to fill in nothing if one ever did (M2).
    placed = whisperx.align([segment], in_windows(model), metadata, as_float(samples), "cpu", interpolate_method="ignore")["word_segments"]
    if len(placed) != len(spoken):
        raise RuntimeError(f"the aligner placed {len(placed)} of {len(spoken)} words")
    return [(float(w["start"]), float(w["end"])) if "start" in w and "end" in w else None for w in placed]


def in_windows(model):
    """`model` (torchaudio's wav2vec2) hearing a sound window by window: its emissions for each window's
    own frames, joined along time, are what WhisperX's trellis and backtrack then align the whole text on."""
    import torch

    def emissions(waveform, lengths=None):
        if lengths is not None:  # WhisperX pads a sound under 400 samples and says how long it was: one window
            return model(waveform, lengths=lengths)
        heard = [model(waveform[:, first:last])[0][:, keep:keep + count] for first, last, keep, count in windows(waveform.shape[-1])]
        return torch.cat(heard, dim=1), None

    return emissions


@cache
def _aligner(language: str):
    import whisperx

    return whisperx.load_align_model(language, "cpu", model_dir=ALIGN_DIR)


# Scribe.

class ScribeFailing(RuntimeError):
    """Scribe answered 429 (too many requests) or 5xx (`status`): ElevenLabs busy or failing, so Whisper can hear the take instead."""

    status: int


def scribe(sound16k: str | Path, language: str | None, key: str) -> tuple[list[str], str]:
    """Scribe's words, punctuation attached as it writes them, and the language it heard or was given (ISO 639-1)."""
    sound = Path(sound16k)
    fields = {"model_id": SCRIBE_MODEL, "tag_audio_events": "false", **({"language_code": language} if language else {})}
    boundary = uuid.uuid4().hex
    request = urllib.request.Request(SCRIBE_URL, data=_form(fields, sound, boundary), method="POST",
                                     headers={"xi-api-key": key, "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            answer = json.load(response)
    except urllib.error.HTTPError as refused:
        said = f"Scribe refused {sound.name}: {refused.code} {refused.read()[:500].decode(errors='replace')}"
        if refused.code == 429 or refused.code >= 500:
            failing = ScribeFailing(said)
            failing.status = refused.code
            raise failing from None
        raise RuntimeError(said) from None
    said = "".join(item["text"] for item in answer.get("words") or [] if item["type"] in ("word", "spacing"))
    return said.split(), language_of(answer["language_code"])


def _form(fields: dict[str, str], file: Path, boundary: str) -> bytes:
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode() for name, value in fields.items()]
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file.name}"\r\n'
                 f"Content-Type: audio/wav\r\n\r\n".encode() + file.read_bytes() + b"\r\n")
    return b"".join(parts) + f"--{boundary}--\r\n".encode()
