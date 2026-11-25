"""Where a take's picture changes from one shot to the next (X97): its scene changes, on the preview copy.

ffmpeg's `scdet` scores each frame against the one before it, on the luma alone: `mafd` is the mean absolute
difference of their luma in percent of the range (8-bit: 25.6 levels are 10), and the score is the smaller of `mafd`
and how far it moved from the last frame's, so a steady motion or a fade's even drift, whose difference stays the same
from frame to frame, scores low. A frame scoring `THRESHOLD` or more is the first frame of a new shot; its `ms` is its
time in the preview copy, round(pts_time × 1000). The preview copy starts at 0 (X44).

The threshold's measure (part 3, Task 8; every score of every frame, ffmpeg 8 on this Mac):
- the tests' files: hard changes between colours of other brightness 53 to 80; slowly drifting grain 0.33 at most,
  a camera's grain (new every frame) 4.7, a one-second cross-fade 1.2;
- part 2's 90 s film (its edit's 40 shots of the owner's take, its preview copy as the worker makes it): its 31 hard
  cuts (jump cuts within the take, the cutaways in and out, a punch-in's tight shot cut back to the full frame) 13.0 to
  28.9, each on its own frame; the two pushes crossed it one frame into their slide (10.9, 14.5) and the punch
  transition at its swap, three frames in (11.4); its fades (a punch-in inside each), wipe, iris and clock 3.3 at
  most; nothing else in the film over 5.2;
- the owner's take, one shot: 4.5 at most.
So 10 lies between 5.2 and 13.0. Known limits: a cut between two shots of the same brightness everywhere (two plain
colours of one luma) scores nothing, since the colour is not read; a full-contrast grain with no likeness between
neighbouring pixels, panned unevenly (1 then 2 pixels a frame), scored 12.4, which footage does not look like.

The worker's image is Debian 12, whose ffmpeg is 5.1: `scdet` and `metadata` are in it as used here.
"""

import re
from pathlib import Path

from media.tool import run

THRESHOLD = 10
# What `metadata` prints for each frame `scdet` passes on: a line of its number and times, then its keys.
CUT = re.compile(r"^frame:\d+\s+pts:\S+\s+pts_time:(\S+)", re.MULTILINE)


def cuts(preview: str | Path) -> list[int]:
    """The ms of each scene change in `preview`, in order; [] for one continuous shot. RuntimeError naming the file with
    ffmpeg's own words."""
    said = run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(preview), "-map", "0:v:0",
                "-vf", f"scdet=threshold={THRESHOLD}:sc_pass=1,metadata=mode=print:file=-", "-f", "null", "-"], preview)
    return [round(float(seconds) * 1000) for seconds in CUT.findall(said)]
