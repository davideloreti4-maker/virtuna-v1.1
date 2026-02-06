#!/bin/bash
set -euo pipefail

# Merge a completed milestone branch into main with selective file restoration.
#
# Usage: ./merge-milestone.sh <milestone-name>
# Example: ./merge-milestone.sh v3.1-landing-page
#
# What it does:
# 1. Merges milestone/<name> into main with --no-ff --no-commit
# 2. Restores main's active planning state (STATE.md, config.json)
# 3. Keeps the branch's archived milestone additions
# 4. Removes MILESTONE.md (worktree-only file)
# 5. Prompts for manual reconciliation of shared files
# 6. Commits, pushes, and optionally cleans up worktree + branch

MILESTONE_NAME="${1:?Usage: merge-milestone.sh <milestone-name>}"
BRANCH="milestone/${MILESTONE_NAME}"
DRY_RUN="${2:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[merge]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err() { echo -e "${RED}[error]${NC} $1" >&2; exit 1; }

# Verify we're on main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    err "Must be on main branch. Currently on: $CURRENT_BRANCH"
fi

# Verify branch exists
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    err "Branch '$BRANCH' not found. Available milestone branches:"
    git branch -a | grep milestone/ || echo "  (none)"
    exit 1
fi

# Verify clean working tree
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    err "Working tree has uncommitted changes. Commit or stash first."
fi

log "Merging ${BRANCH} into main..."

if [ "$DRY_RUN" = "--dry-run" ]; then
    log "[DRY RUN] Would execute the following:"
    log "  1. git merge --no-ff --no-commit ${BRANCH}"
    log "  2. Restore main's STATE.md and config.json"
    log "  3. Keep branch's milestones/ additions"
    log "  4. Remove MILESTONE.md"
    log "  5. Prompt for PROJECT.md + MILESTONES.md reconciliation"
    log "  6. Commit and push"
    exit 0
fi

# Step 1: Merge without committing
git merge --no-ff --no-commit "$BRANCH" || {
    warn "Merge conflicts detected. Resolve them, then re-run or commit manually."
    exit 1
}

# Step 2: Restore main's active planning state
log "Restoring main's planning state..."
git checkout HEAD -- .planning/STATE.md 2>/dev/null || warn "No STATE.md on main to restore"
git checkout HEAD -- .planning/config.json 2>/dev/null || warn "No config.json on main to restore"

# Step 3: Keep branch's milestone archive (already merged in)
log "Branch's milestones/ directory preserved in merge."

# Step 4: Remove MILESTONE.md (worktree-only)
if [ -f .planning/MILESTONE.md ]; then
    git rm --cached .planning/MILESTONE.md 2>/dev/null || true
    rm -f .planning/MILESTONE.md
    log "Removed MILESTONE.md (worktree-only file)"
fi

# Step 5: Prompt for manual reconciliation
echo ""
warn "Manual reconciliation needed for shared files:"
echo "  - .planning/PROJECT.md — check for updates from the milestone branch"
echo "  - .planning/MILESTONES.md — ensure new milestone entry is added"
echo "  - CLAUDE.md — update phase registry (next available phase number)"
echo ""
read -p "Have you reviewed these files? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    warn "Merge staged but not committed. Review files and run:"
    echo "  git commit -m \"chore: merge milestone/${MILESTONE_NAME} into main\""
    exit 0
fi

# Step 6: Commit
git commit -m "chore: merge milestone/${MILESTONE_NAME} into main

Merges all code changes and planning artifacts from ${BRANCH}.
Planning state (STATE.md, config.json) restored to main's active milestone."

log "Merge committed successfully."

# Step 7: Push
log "Pushing to origin..."
git push origin main

# Step 8: Offer cleanup
echo ""
read -p "Delete worktree and branch for ${MILESTONE_NAME}? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Find and remove worktree
    WORKTREE_PATH=$(git worktree list | grep "$BRANCH" | awk '{print $1}')
    if [ -n "$WORKTREE_PATH" ]; then
        git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || warn "Could not remove worktree at $WORKTREE_PATH"
        log "Removed worktree: $WORKTREE_PATH"
    fi

    # Delete branch
    git branch -d "$BRANCH" 2>/dev/null || warn "Could not delete local branch $BRANCH"
    git push origin --delete "$BRANCH" 2>/dev/null || warn "Could not delete remote branch $BRANCH"
    log "Deleted branch: $BRANCH"
fi

log "Done! Milestone ${MILESTONE_NAME} merged into main."
