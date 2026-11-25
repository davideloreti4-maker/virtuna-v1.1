#!/usr/bin/env node
/* node scripts/next-look-compare.cjs <baselineDir> <candidateDir>
 *
 * Exit 0 when every probed page has the same URL, <html> attributes, landmarks, body background
 * and token values as the baseline. Only tokens the BASELINE recorded are compared, so names added
 * later do not count. Chrome screenshots are compared by hash and reported: a mismatch there is a
 * prompt to open both images (thread titles in the sidebar can change), not a failure. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: next-look-compare.cjs <baselineDir> <candidateDir>");
  process.exit(2);
}

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 12);
let failed = false;

for (const file of fs.readdirSync(a).filter((f) => f.endsWith(".json")).sort()) {
  const other = path.join(b, file);
  if (!fs.existsSync(other)) {
    console.log(`FAIL ${file}: missing in ${b}`);
    failed = true;
    continue;
  }
  const A = JSON.parse(fs.readFileSync(path.join(a, file), "utf8"));
  const B = JSON.parse(fs.readFileSync(other, "utf8"));
  const diffs = [];
  for (const key of ["url", "bodyBackground", "bodyWeight"]) {
    if (A[key] !== B[key]) diffs.push(`${key}: ${A[key]} -> ${B[key]}`);
  }
  for (const group of ["html", "landmarks", "tokens"]) {
    for (const k of Object.keys(A[group])) {
      if (A[group][k] !== B[group][k]) {
        diffs.push(`${group}.${k}: ${JSON.stringify(A[group][k])} -> ${JSON.stringify(B[group][k])}`);
      }
    }
  }
  if (diffs.length) {
    failed = true;
    console.log(`FAIL ${file}\n  ${diffs.slice(0, 20).join("\n  ")}${diffs.length > 20 ? `\n  … ${diffs.length - 20} more` : ""}`);
  } else {
    console.log(`ok   ${file} (${Object.keys(A.tokens).length} tokens)`);
  }
}

for (const file of fs.readdirSync(a).filter((f) => /-(chrome|bottom)\.png$/.test(f)).sort()) {
  const other = path.join(b, file);
  if (!fs.existsSync(other)) continue;
  const same = sha(path.join(a, file)) === sha(other);
  console.log(`${same ? "same" : "LOOK"} ${file}`);
}

process.exit(failed ? 1 : 0);
