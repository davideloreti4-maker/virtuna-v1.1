---
quick_id: 260505-jdk
type: quick
mode: quick
phase: quick-260505-jdk
plan: 01
wave: 1
depends_on: []
files_modified:
  - components.json
  - src/components/ui/command.tsx
  - src/app/globals.css
  - package.json
  - pnpm-lock.yaml
autonomous: true
requirements:
  - QUICK-260505-jdk
must_haves:
  truths:
    - "shadcn CLI is initialized — running `pnpm dlx shadcn@latest add <name>` succeeds without re-running init"
    - "components.json exists at project root with the exact spec shape (style: new-york, baseColor: slate, RSC: true, tsx: true, css: src/app/globals.css)"
    - "src/components/ui/command.tsx exists, imports resolve, project type-checks and builds"
    - "Existing 25 components in src/components/ui/ are byte-identical to pre-task state"
    - "src/lib/utils.ts is byte-identical to pre-task state (existing cn() preserved)"
    - "Existing @theme block in src/app/globals.css preserved — Virtuna coral tokens still present"
  artifacts:
    - path: "components.json"
      provides: "shadcn CLI configuration"
      contains: '"style": "new-york"'
    - path: "src/components/ui/command.tsx"
      provides: "Command palette component (smoke test)"
      contains: "cmdk"
  key_links:
    - from: "components.json"
      to: "src/components/ui/"
      via: "aliases.ui"
      pattern: '"ui": "@/components/ui"'
    - from: "components.json"
      to: "src/lib/utils.ts"
      via: "aliases.utils"
      pattern: '"utils": "@/lib/utils"'
    - from: "src/components/ui/command.tsx"
      to: "cmdk"
      via: "import"
      pattern: 'from ["\x27]cmdk["\x27]'
---

<objective>
Initialize shadcn/ui CLI in Virtuna v1.1 by creating `components.json` at project root, then add the `command` component as a smoke test to prove the CLI works end-to-end.

Purpose: The project has 25 hand-rolled shadcn-style components but no `components.json`, blocking `pnpm dlx shadcn@latest add <name>` and Origin UI / Magic UI paste-install workflows. This task unblocks both.

Output: `components.json` (root) + `src/components/ui/command.tsx` + `cmdk` dep added, with zero regressions to existing components, `cn()`, or `@theme` tokens.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
@./CLAUDE.md
@~/.claude/plans/tranquil-bubbling-globe.md

# Existing files that must be preserved
@src/lib/utils.ts
@src/app/globals.css
@package.json
@tsconfig.json

<interfaces>
<!-- Existing utility — must not be overwritten. shadcn add command will reference this via @/lib/utils alias. -->
From src/lib/utils.ts:
```typescript
export function cn(...inputs: ClassValue[]): string;
```

Path alias from tsconfig.json: `"@/*": ["./src/*"]` — matches shadcn defaults.

Confirmed deps already installed: class-variance-authority@0.7.1, clsx@2.1.1, tailwind-merge@3.4.0, lucide-react@0.563.0, tw-animate-css@1.4.0. `cmdk` is the only expected new dep (added by `shadcn add command`).
</interfaces>

<approach_decision>
Approach (b) chosen — write components.json directly with the exact spec shape, then run `pnpm dlx shadcn@latest add command` (which is non-interactive when components.json exists).

Rationale: Deterministic output, no risk of interactive CLI prompts hanging, no risk of shadcn init touching globals.css or utils.ts. The `add` subcommand only generates the requested component file and (if needed) installs deps.
</approach_decision>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Capture pre-task baseline (snapshots for verification)</name>
  <files>
    (read-only — captures hashes for later diffing)
  </files>
  <action>
Capture file hashes / line counts BEFORE any changes so Task 5 can prove preservation:

```bash
cd /Users/davideloreti/virtuna-v1.1
mkdir -p /tmp/shadcn-init-baseline-260505
shasum -a 256 src/lib/utils.ts > /tmp/shadcn-init-baseline-260505/utils.ts.sha
shasum -a 256 src/app/globals.css > /tmp/shadcn-init-baseline-260505/globals.css.sha
ls src/components/ui/ | sort > /tmp/shadcn-init-baseline-260505/ui-listing.txt
shasum -a 256 src/components/ui/*.tsx 2>/dev/null | sort > /tmp/shadcn-init-baseline-260505/ui-hashes.txt
grep -c "^\s*--color-coral" src/app/globals.css > /tmp/shadcn-init-baseline-260505/coral-token-count.txt
git status --porcelain > /tmp/shadcn-init-baseline-260505/git-status-pre.txt
```

Verify the project is on a clean enough state to proceed. Note: per the handoff plan, pre-flight to commit unrelated dirty changes is the orchestrator's responsibility; this plan assumes the working tree is ready for the shadcn commit.
  </action>
  <verify>
    <automated>test -f /tmp/shadcn-init-baseline-260505/utils.ts.sha && test -f /tmp/shadcn-init-baseline-260505/globals.css.sha && test -f /tmp/shadcn-init-baseline-260505/ui-hashes.txt && test -s /tmp/shadcn-init-baseline-260505/coral-token-count.txt</automated>
  </verify>
  <done>Baseline captured: utils.ts hash, globals.css hash, ui/*.tsx hashes, ui directory listing, coral token count, git status all stored under /tmp/shadcn-init-baseline-260505/.</done>
</task>

<task type="auto">
  <name>Task 2: Write components.json with the exact spec shape</name>
  <files>components.json</files>
  <action>
Use the Write tool to create `/Users/davideloreti/virtuna-v1.1/components.json` with the EXACT contents below (no additions, no reformatting):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

Notes:
- `tailwind.config: ""` is intentional and correct for Tailwind v4 (no separate config file — `@theme` block handles it).
- DO NOT run `pnpm dlx shadcn@latest init` — it is interactive and may attempt to overwrite `src/lib/utils.ts` or modify `src/app/globals.css`. Writing the file directly is deterministic.
  </action>
  <verify>
    <automated>node -e "const c=require('/Users/davideloreti/virtuna-v1.1/components.json'); if(c.style!=='new-york'||c.rsc!==true||c.tsx!==true||c.tailwind.css!=='src/app/globals.css'||c.tailwind.baseColor!=='slate'||c.tailwind.cssVariables!==true||c.aliases.components!=='@/components'||c.aliases.utils!=='@/lib/utils'||c.aliases.ui!=='@/components/ui'){console.error('SHAPE MISMATCH',JSON.stringify(c));process.exit(1)}console.log('components.json shape OK')"</automated>
  </verify>
  <done>components.json exists at project root with all required fields matching the spec exactly. Schema validation passes.</done>
</task>

<task type="auto">
  <name>Task 3: Add the `command` component via shadcn CLI</name>
  <files>
    src/components/ui/command.tsx
    package.json
    pnpm-lock.yaml
  </files>
  <action>
With `components.json` now present, the shadcn `add` command runs non-interactively. Execute:

```bash
cd /Users/davideloreti/virtuna-v1.1
pnpm dlx shadcn@latest add command --yes --overwrite=false
```

Flag rationale:
- `--yes` skips any remaining prompts
- `--overwrite=false` is defensive — there is no existing `src/components/ui/command.tsx`, but this guarantees no clobber if shadcn ever resolves a conflict differently

Expected outcomes:
- New file: `src/components/ui/command.tsx`
- New dep: `cmdk` added to `dependencies` in `package.json` (and `pnpm-lock.yaml` updated)
- NO modification to `src/lib/utils.ts` (shadcn detects existing file via the `@/lib/utils` alias and reuses it)
- NO modification to existing 25 components

If the CLI prompts to overwrite anything (it should not), abort and investigate before proceeding. If `cmdk` install fails, run `pnpm add cmdk` manually and retry.
  </action>
  <verify>
    <automated>test -f /Users/davideloreti/virtuna-v1.1/src/components/ui/command.tsx && grep -q '"cmdk"' /Users/davideloreti/virtuna-v1.1/package.json && grep -q "from ['\"]cmdk['\"]" /Users/davideloreti/virtuna-v1.1/src/components/ui/command.tsx</automated>
  </verify>
  <done>`src/components/ui/command.tsx` exists and imports from `cmdk`. `cmdk` dep present in `package.json`. `pnpm-lock.yaml` updated.</done>
</task>

<task type="auto">
  <name>Task 4: Verify preservation of utils.ts, globals.css, and existing components</name>
  <files>
    (read-only diff — verifies Tasks 2 and 3 did not touch protected files)
  </files>
  <action>
Diff against the Task 1 baseline to PROVE no protected files changed. This is the critical safety gate per the handoff plan's "DO NOT" list.

```bash
cd /Users/davideloreti/virtuna-v1.1

# 1. utils.ts must be byte-identical
shasum -a 256 -c /tmp/shadcn-init-baseline-260505/utils.ts.sha || { echo "FAIL: src/lib/utils.ts was modified — REVERT IT"; exit 1; }

# 2. Existing components must be byte-identical (compare via diff of hash listing)
shasum -a 256 src/components/ui/*.tsx 2>/dev/null | grep -v "command.tsx" | sort > /tmp/shadcn-init-baseline-260505/ui-hashes-post.txt
# Strip command.tsx (new) from baseline too if it accidentally appears; baseline was captured before it existed
diff /tmp/shadcn-init-baseline-260505/ui-hashes.txt /tmp/shadcn-init-baseline-260505/ui-hashes-post.txt || { echo "FAIL: existing components were modified"; exit 1; }

# 3. globals.css — coral tokens must still exist (count >= baseline)
PRE_CORAL=$(cat /tmp/shadcn-init-baseline-260505/coral-token-count.txt)
POST_CORAL=$(grep -c "^\s*--color-coral" src/app/globals.css)
if [ "$POST_CORAL" -lt "$PRE_CORAL" ]; then echo "FAIL: coral tokens removed (was $PRE_CORAL, now $POST_CORAL)"; exit 1; fi

# 4. globals.css — verify the @theme block opening still exists with primitive tokens
grep -q "^@theme {" src/app/globals.css || { echo "FAIL: @theme block missing"; exit 1; }
grep -q -- "--color-coral-500: oklch(0.72 0.16 40)" src/app/globals.css || { echo "FAIL: coral-500 token missing/altered"; exit 1; }

# 5. If shadcn appended :root/.dark blocks, that is acceptable — log the diff for review
git diff -- src/app/globals.css | head -100

echo "PRESERVATION CHECK: PASS"
```

If ANY of these checks fail:
- For utils.ts: `git checkout -- src/lib/utils.ts` to restore
- For globals.css: manually revert the `@theme` block while preserving any new shadcn-added `:root { --background: ... }` tokens AT THE END of the file
- For existing components: `git checkout -- src/components/ui/<filename>` to restore each modified one
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-v1.1 && shasum -a 256 -c /tmp/shadcn-init-baseline-260505/utils.ts.sha && shasum -a 256 src/components/ui/*.tsx 2>/dev/null | grep -v "command.tsx" | sort > /tmp/shadcn-init-baseline-260505/ui-hashes-post.txt && diff /tmp/shadcn-init-baseline-260505/ui-hashes.txt /tmp/shadcn-init-baseline-260505/ui-hashes-post.txt && grep -q "^@theme {" src/app/globals.css && grep -q -- "--color-coral-500: oklch(0.72 0.16 40)" src/app/globals.css</automated>
  </verify>
  <done>utils.ts unchanged. All 25 existing components in src/components/ui/ unchanged. globals.css @theme block preserved with all coral tokens intact. Any shadcn additions to globals.css are appended (coexist), not replacements.</done>
</task>

<task type="auto">
  <name>Task 5: Type-check, build, and atomic commit</name>
  <files>
    (verification + git commit — no file edits)
  </files>
  <action>
Prove the addition does not break the project, then commit atomically.

```bash
cd /Users/davideloreti/virtuna-v1.1

# 1. Type check (project uses strict TS, no `any`)
pnpm exec tsc --noEmit || { echo "FAIL: type errors"; exit 1; }

# 2. Production build
pnpm build || { echo "FAIL: build broken"; exit 1; }

# 3. Stage ONLY the expected files (per project rule: avoid `git add .`)
git add components.json src/components/ui/command.tsx package.json pnpm-lock.yaml
# Stage globals.css ONLY if shadcn appended tokens to it
if ! git diff --cached --quiet -- src/app/globals.css 2>/dev/null && ! git diff --quiet -- src/app/globals.css 2>/dev/null; then
  git add src/app/globals.css
fi

# 4. Confirm staged files are exactly what we expect
git diff --cached --name-only

# 5. Atomic commit (per handoff plan, exact message)
git commit -m "chore: initialize shadcn/ui CLI with components.json and command component"

# 6. Confirm commit landed
git log --oneline -1
```

Note: Auto-push is handled by `.githooks/post-commit` — no manual push required (per ~/.claude/rules/gsd-worktree.md).

If type-check or build fails: investigate the new `command.tsx` for missing peer deps. The most common cause is `cmdk` peer-dep mismatch with the React 19 / Next 16 stack — if so, add a follow-up note but do NOT modify command.tsx in this task; surface to the user.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-v1.1 && pnpm exec tsc --noEmit && git log -1 --pretty=%s | grep -q "initialize shadcn/ui CLI"</automated>
  </verify>
  <done>`pnpm exec tsc --noEmit` passes. `pnpm build` succeeds. Atomic commit `chore: initialize shadcn/ui CLI with components.json and command component` is at HEAD with exactly the expected files staged.</done>
</task>

</tasks>

<verification>

End-to-end checks (manual sanity, after Task 5):

1. **Config exists with correct shape:**
   ```bash
   cat /Users/davideloreti/virtuna-v1.1/components.json | python3 -m json.tool
   ```
   Returns the exact JSON from Task 2.

2. **Command component is importable:**
   ```bash
   grep -E "^export" /Users/davideloreti/virtuna-v1.1/src/components/ui/command.tsx
   ```
   Lists the expected exports (`Command`, `CommandDialog`, `CommandInput`, etc).

3. **No regressions in existing components:**
   ```bash
   git diff HEAD~1 -- src/components/ui/ | head -5
   ```
   Shows only `+++ b/src/components/ui/command.tsx` (new file), no other changes.

4. **`cn()` untouched:**
   ```bash
   git diff HEAD~1 -- src/lib/utils.ts
   ```
   Empty output.

5. **globals.css coral tokens preserved:**
   ```bash
   grep -c "^\s*--color-coral" /Users/davideloreti/virtuna-v1.1/src/app/globals.css
   ```
   Returns 9 (coral-100 through coral-900).

6. **Build is clean:** `pnpm build` exits 0.

7. **Type check is clean:** `pnpm exec tsc --noEmit` exits 0.

</verification>

<success_criteria>

- [ ] `components.json` exists at project root with exact spec shape (style: new-york, slate, RSC: true, tsx: true, css: src/app/globals.css, three aliases correct)
- [ ] `src/components/ui/command.tsx` exists, imports from `cmdk`, exports the `Command` component family
- [ ] `cmdk` added as dependency in `package.json`, `pnpm-lock.yaml` updated
- [ ] `src/lib/utils.ts` byte-identical to pre-task (SHA matches baseline)
- [ ] All 25 existing files in `src/components/ui/*.tsx` byte-identical to pre-task (SHA-listing matches baseline)
- [ ] `src/app/globals.css` `@theme` block preserved; coral-500 token intact at `oklch(0.72 0.16 40)`; any shadcn additions are appended, not replacements
- [ ] `pnpm exec tsc --noEmit` passes
- [ ] `pnpm build` passes
- [ ] Single atomic commit at HEAD: `chore: initialize shadcn/ui CLI with components.json and command component`
- [ ] Auto-push hook fires (verify with `git log @{u}..HEAD` returning empty)

</success_criteria>

<rollback>

If anything goes wrong AFTER the commit:
```bash
cd /Users/davideloreti/virtuna-v1.1
git reset --hard HEAD~1
rm -f components.json src/components/ui/command.tsx
# pnpm-lock.yaml and package.json restored by reset
pnpm install
```

If issues are caught BEFORE the commit (Tasks 1-4):
```bash
cd /Users/davideloreti/virtuna-v1.1
git checkout -- src/lib/utils.ts src/app/globals.css src/components/ui/  # revert any unintended modifications
rm -f components.json src/components/ui/command.tsx
# Manually edit package.json to remove "cmdk" entry if added, then `pnpm install`
```

</rollback>

<output>
After completion, append to `.planning/STATE.md` under a "Quick Tasks Completed" section (create section if it does not exist):

```markdown
## Quick Tasks Completed

- 2026-05-05 — `260505-jdk` — Initialized shadcn/ui CLI: created `components.json` (new-york / slate / RSC), added `command` component as smoke test. No regressions to existing 25 components, `cn()`, or `@theme` tokens. Single commit: `chore: initialize shadcn/ui CLI with components.json and command component`.
```

Do NOT update ROADMAP.md (quick tasks are out-of-band per the constraints).

Optional summary file (only if executor finds it useful for handoff):
`.planning/quick/260505-jdk-initialize-shadcn-ui-cli-components-json/260505-jdk-SUMMARY.md`
</output>
