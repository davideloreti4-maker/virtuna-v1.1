## Task 2: Echo guard

**Files:**
- Create: `src/lib/engine/remix/echo-guard.ts`
- Test: `src/lib/engine/remix/__tests__/echo-guard.test.ts`

**Interfaces:**
- Produces: `sharedContentTokens(a: string, b: string, exclude?: string): string[]`.

Why this exists: handing a model the source's words invites paraphrase, and this codebase has already been bitten — a few-shot example drawn from the test video came back verbatim and read as a perfect decode. The guard is a **stopword approximation, never POS tagging**: there is no NLP dependency in `package.json` and this must not add one.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/engine/remix/__tests__/echo-guard.test.ts
import { describe, it, expect } from "vitest";
import { sharedContentTokens } from "../echo-guard";

describe("sharedContentTokens", () => {
  it("finds no overlap between two lines on different topics", () => {
    expect(sharedContentTokens(
      "Your protein shake is making you fatter",
      "Your onboarding flow is losing you signups",
    )).toEqual([]);
  });

  it("ignores stopwords entirely", () => {
    // Only stopwords are shared here.
    expect(sharedContentTokens(
      "the and of a to is",
      "the and of a to is",
    )).toEqual([]);
  });

  it("catches a topical echo", () => {
    const shared = sharedContentTokens(
      "I tested creatine on 40 lifters",
      "I tested creatine with 40 athletes",
    );
    expect(shared).toContain("creatine");
    expect(shared).toContain("tested");
  });

  it("is case and punctuation insensitive", () => {
    expect(sharedContentTokens("Creatine, actually!", "creatine")).toEqual(["creatine"]);
  });

  it("excludes terms the creator asked for via the brief", () => {
    const shared = sharedContentTokens(
      "creatine timing is wrong",
      "creatine timing changes everything",
      "creatine timing",
    );
    expect(shared).toEqual([]);
  });

  it("treats an empty or null-ish input as no overlap", () => {
    expect(sharedContentTokens("", "anything")).toEqual([]);
    expect(sharedContentTokens("anything", "")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test -- src/lib/engine/remix/__tests__/echo-guard.test.ts`
Expected: FAIL — `Failed to resolve import "../echo-guard"`.

- [ ] **Step 3: Implement `echo-guard.ts`**

```ts
/**
 * echo-guard.ts — the mechanical guard on the D-01 reversal.
 *
 * D-01 (decode-types.ts:155) prevented the adapt call from ever seeing the source's content, so
 * it could only borrow format. The owner's fidelity ruling (D2, 2026-08-10) requires adapt to see
 * `spoken_text`, which removes that guarantee. This restores the intent by a different route:
 * STRUCTURAL echo (duration, cadence, beat count) is what we want; TOPICAL echo is the failure.
 *
 * Deliberately a stopword approximation, not POS tagging — there is no NLP dependency in this
 * tree and adding one for a test would be the wrong trade.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "so", "because",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "about",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing", "have", "has", "had", "having",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "this", "that", "these", "those",
  "not", "no", "yes", "all", "any", "every", "more", "most", "some", "such",
  "will", "would", "can", "could", "should", "may", "might", "must",
  "what", "when", "where", "who", "why", "how", "which",
  "up", "out", "down", "over", "under", "just", "only", "very", "really",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Content tokens present in BOTH strings.
 *
 * @param exclude terms the creator explicitly asked for (the brief) — shared use of those is
 *                what they requested, not an echo.
 */
export function sharedContentTokens(a: string, b: string, exclude = ""): string[] {
  if (!a || !b) return [];
  const excluded = new Set(tokenize(exclude));
  const left = new Set(tokenize(a).filter((t) => !excluded.has(t)));
  const right = new Set(tokenize(b).filter((t) => !excluded.has(t)));
  return [...left].filter((t) => right.has(t));
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- src/lib/engine/remix/__tests__/echo-guard.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/remix/echo-guard.ts src/lib/engine/remix/__tests__/echo-guard.test.ts
git commit -m "feat(remix): stopword echo guard for the D-01 reversal"
```

---

