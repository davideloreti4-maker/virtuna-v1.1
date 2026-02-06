# Git Hooks

This directory contains git hooks that are tracked in the repository.

## Setup (one-time per clone/worktree)

```bash
git config core.hooksPath .githooks
```

## Hooks

### post-commit

Auto-pushes to origin after every commit. This ensures Web Claude sessions can access branches without manual `git push`.

Fails silently if offline or no remote is configured.
