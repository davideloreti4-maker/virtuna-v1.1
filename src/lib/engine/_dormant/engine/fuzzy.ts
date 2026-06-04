/**
 * Jaro-Winkler string similarity — pure TypeScript, zero dependencies.
 *
 * Used by trends.ts to fuzzy-match content text against trending sound names.
 * Threshold >= 0.7 replaces exact substring matching (Phase 11 SIG-01).
 */

/**
 * Compute Jaro-Winkler similarity between two strings.
 * Returns a value between 0 (no similarity) and 1 (identical).
 *
 * - Case-insensitive comparison (both inputs lowercased internally).
 * - Empty string → 0.0, identical strings → 1.0.
 * - Winkler prefix boost: up to 4 common prefix characters, p = 0.1.
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();

  // Edge cases
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  // Match window: floor(max(|a|,|b|) / 2) - 1
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);

  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches within the window
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(b.length - 1, i + matchWindow);

    for (let j = lo; j <= hi; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  // Jaro distance
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler modification: boost for common prefix (max 4 chars)
  let prefixLen = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefixLen++;
    else break;
  }

  const winklerBoost = prefixLen * 0.1 * (1 - jaro);
  return jaro + winklerBoost;
}

/**
 * Find the best fuzzy match of `target` within `content`.
 *
 * Strategy:
 * 1. Exact substring match → score 1.0 (fast path).
 * 2. Sliding n-gram window over content words matching target length.
 * 3. Return best Jaro-Winkler score above threshold.
 *
 * @param target  - The string to search for (e.g. a sound name).
 * @param content - The text to search within (e.g. content description).
 * @param threshold - Minimum similarity score to count as a match (default 0.7).
 */
export function bestFuzzyMatch(
  target: string,
  content: string,
  threshold: number = 0.7
): { score: number; matched: boolean } {
  const targetLower = target.toLowerCase().trim();
  const contentLower = content.toLowerCase();

  if (!targetLower || !contentLower) {
    return { score: 0, matched: false };
  }

  // Fast path: exact substring match
  if (contentLower.includes(targetLower)) {
    return { score: 1.0, matched: true };
  }

  // Split content into words
  const words = contentLower.split(/[\s\-_.,;:!?()[\]{}|/\\]+/).filter(Boolean);
  const targetWords = targetLower.split(/[\s\-_]+/).filter(Boolean);
  const targetWordCount = targetWords.length;

  let bestScore = 0;

  // Sliding window: compare n-grams of the same word count as target
  for (let windowSize = 1; windowSize <= Math.min(targetWordCount + 1, words.length); windowSize++) {
    for (let i = 0; i <= words.length - windowSize; i++) {
      const phrase = words.slice(i, i + windowSize).join(" ");
      const score = jaroWinklerSimilarity(targetLower, phrase);
      if (score > bestScore) bestScore = score;
    }
  }

  // Also try individual words against individual target words for single-word targets
  if (targetWordCount === 1) {
    for (const word of words) {
      const score = jaroWinklerSimilarity(targetLower, word);
      if (score > bestScore) bestScore = score;
    }
  }

  return {
    score: Math.round(bestScore * 1000) / 1000,
    matched: bestScore >= threshold,
  };
}
