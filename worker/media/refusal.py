"""What a creator is told when a job fails (X66, X71 as amended by the final review, M2).

A failure the worker raises itself, about the creator's take or job ("IMG_0001.MOV is cut short ..."), is a
`Refusal`, and its own words go into the rows. Anything else (a tool's, a library's, the network's, a bug) is
"the analysis failed on our side; try again" or "the render failed on our side; try again" there, and its
words go to the log only (`store.failed`). render.mjs's marked line (`EDIT_ERROR:`) is raised as a Refusal too
(`render/script.py`).
"""


class Refusal(ValueError):
    """A ValueError the worker raises itself: its message is the creator's to read."""
