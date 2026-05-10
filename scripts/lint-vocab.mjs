#!/usr/bin/env node
// Scans for banned vocabulary in customer-facing source files.
// Exits 1 if violations found, 0 if clean.
// No third-party deps -- Node >=20 standard library only.
// See .planning/reference/BRAND-SPINE.md §4 for the vocab rules this enforces.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { argv, exit } from "node:process";

// Banned patterns. Each: regex, replacement hint, severity.
// severity 'error' fails the build; 'warn' logs but does not fail.
const BANNED = [
  { rx: /\bviral\b/gi, hint: "use 'breakout' or 'high-performing'", severity: "error" },
  { rx: /\bgo viral\b/gi, hint: "use 'land with audience'", severity: "error" },
  { rx: /\bAI\b(?!.*\bai-powered\b)/gi, hint: "use 'behavioral simulation' or 'engine'", severity: "error" },
  { rx: /\busers\b/gi, hint: "use 'creators' (or specific role)", severity: "warn" },
  // Library-import drift detection (per RESEARCH.md Pitfall 5)
  { rx: /from ['"]framer-motion['"]/gi, hint: "import from 'motion/react' (legacy uses grandfathered)", severity: "warn" },
];

// Inline override marker -- developers can opt out a single line for legitimate uses.
const SUPPRESS_RX = /vocab-lint-disable-next-line/;

// Hardcoded default scan roots (D-12 scope: landing + onboarding + dashboard-visible copy).
// Hardcoding prevents path-traversal abuse if the script is ever invoked with
// untrusted argv (e.g. from a malicious pre-commit hook patch).
const DEFAULT_DIRS = ["src/app", "src/components/landing", "src/components/onboarding"];

// Extensions to scan -- JSX text + markdown copy + TS string literals.
const SCANNABLE_EXTS = new Set([".ts", ".tsx", ".md"]);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // Directory does not exist (e.g. fresh clone before src/ structure created)
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, .git, dotdirs in general
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else if (SCANNABLE_EXTS.has(extname(entry.name))) {
      yield full;
    }
  }
}

// Allowlist roots — only paths under these roots are scanned, even when
// individual files are passed via argv. Prevents the hook from scanning
// unrelated source while still letting it accept a list of staged files.
const ALLOWED_ROOTS = ["src/app", "src/components/landing", "src/components/onboarding"];

function isUnderAllowedRoot(path) {
  return ALLOWED_ROOTS.some((root) => path === root || path.startsWith(root + "/"));
}

function* expandPaths(paths) {
  for (const p of paths) {
    if (!isUnderAllowedRoot(p)) continue;
    let stat;
    try {
      stat = statSync(p);
    } catch {
      // Path doesn't exist (deleted, renamed, etc.) — skip silently
      continue;
    }
    if (stat.isDirectory()) {
      yield* walk(p);
    } else if (SCANNABLE_EXTS.has(extname(p))) {
      yield p;
    }
  }
}

function main() {
  const inputs = argv.slice(2).length > 0 ? argv.slice(2) : DEFAULT_DIRS;
  let errors = 0;
  let warnings = 0;
  for (const file of expandPaths(inputs)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      // Inline override -- skip if the previous line carries the disable marker
      if (i > 0 && SUPPRESS_RX.test(lines[i - 1])) return;
      for (const { rx, hint, severity } of BANNED) {
        // Reset regex lastIndex for global flags between lines
        rx.lastIndex = 0;
        for (const match of line.matchAll(rx)) {
          const tag = severity === "error" ? "ERROR" : "WARN ";
          console.error(`${tag} ${file}:${i + 1}  "${match[0]}" -> ${hint}`);
          if (severity === "error") errors++;
          else warnings++;
        }
      }
    });
  }
  console.error(`\n[lint-vocab] ${errors} error(s), ${warnings} warning(s)`);
  exit(errors > 0 ? 1 : 0);
}

main();
