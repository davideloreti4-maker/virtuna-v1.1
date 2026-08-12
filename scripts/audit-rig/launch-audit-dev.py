#!/usr/bin/env python3
"""Detach the audit dev server into its own session so later foreground Bash
calls in the harness can't signal its process group (the exit-144 trap).
macOS has no `setsid` binary — fork + os.setsid() is the portable equivalent.
"""
import os
import subprocess
import sys

CWD = "/Users/davideloreti/virtuna-e2e-audit"
LOG = "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/dev-3040.log"

if os.fork() != 0:
    sys.exit(0)

os.setsid()

env = dict(os.environ)
env["NODE_OPTIONS"] = "--max-old-space-size=2048"

with open(LOG, "w") as log:
    subprocess.Popen(
        ["node", "./node_modules/next/dist/bin/next", "dev", "-p", "3040"],
        cwd=CWD,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )

os._exit(0)
