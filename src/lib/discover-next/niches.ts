/**
 * Niches as Discover names them. The library stores a niche
 * per video as a slug; two of them are one niche to a creator ("comedy" and "comedy-entertainment"),
 * and the drawing names the rest short ("Fitness", not "Health fitness"). Pure.
 */

/**
 * The niche keys the address holds (`?niche=`), and so the only ones the filter offers: a key it
 * offered but the address could not keep would be lost on the first write.
 */
export const NICHE_KEY_PATTERN = /^[a-z0-9-]{1,40}$/;

/** The stored values that are another niche's key. */
const SAME_AS: Readonly<Record<string, string>> = { "comedy-entertainment": "comedy" };

/** The names a creator reads: short, as the filter's chips need them ("Fitness", not "Health fitness"). */
export const NICHE_LABELS: Readonly<Record<string, string>> = {
  "content-creation": "Content creation",
  comedy: "Comedy",
  "self-improvement": "Self-improvement",
  business: "Business",
  tech: "Tech",
  lifestyle: "Lifestyle",
  "health-fitness": "Fitness",
  "beauty-fashion": "Beauty",
  "education-science": "Education",
  "relationships-family": "Family",
  food: "Food",
  "art-design": "Art and design",
  travel: "Travel",
  career: "Career",
  sports: "Sports",
  finance: "Finance",
  other: "Other",
};

const own = (map: Readonly<Record<string, string>>, key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

/** A stored niche as its key: trimmed and lowercased, the two comedy values one; empty is null. */
export function nicheKeyOf(raw: string | null | undefined): string | null {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return null;
  return own(SAME_AS, key) ?? key;
}

/** A niche's name: as drawn, else the key with hyphens as spaces and a capital first letter. */
export function nicheLabel(key: string): string {
  const known = own(NICHE_LABELS, key);
  if (known) return known;
  const words = key.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface NicheOption {
  key: string;
  label: string;
  /** How many of the videos it was counted over are in it. */
  count: number;
}

/** The niches that have videos and the address can hold: most videos first, ties by name. */
export function nicheOptions(videos: readonly { niche: string | null }[]): NicheOption[] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    const key = nicheKeyOf(video.niche);
    if (key !== null && NICHE_KEY_PATTERN.test(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({ key, label: nicheLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "en"));
}
