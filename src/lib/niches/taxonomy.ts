/**
 * Niche taxonomy — hardcoded 2-level tree shared by Card 1 (PROFILE-04) and
 * Phase 4 niche detector (CONTENT-02).
 *
 * Source of truth per Phase 02 decision D-10: typed TS const tree, type-safe,
 * versioned in git, no runtime fetches. The Phase 4 AI niche detector handles
 * `micro_niche` automatically per D-09, so depth-coverage here is intentionally
 * light (2 levels: primary → sub).
 *
 * 10 primaries: anchored on the 5 Phase 1 corpus niches (Beauty, Fitness,
 * Education, Comedy, Lifestyle) + 5 extensions for creator-coverage breadth
 * (Food & Cooking, Tech & Gadgets, Gaming, Fashion & Style, Music & Performance).
 *
 * Slug convention: lowercase, hyphen-separated, no spaces/underscores/uppercase.
 *   Examples: "Skincare Reviews" → "skincare-reviews",
 *             "Get Ready With Me" → "get-ready-with-me",
 *             "Coding/Programming" → "coding-programming" (label: "Coding / Programming").
 */

export type NicheSubItem = { slug: string; label: string };

/**
 * Phase 4 (D-13): persona allocation per primary niche.
 * Consumed by Phase 7's 10-persona simulation. Weight is the count out of 10 personas.
 * Sum of weights across the mix MUST equal 10 (enforced by taxonomy.test.ts).
 */
export type PersonaMix = {
  archetype: string;
  weight: number;
};

/**
 * Phase 4 (D-14): benchmark retrieval filter per primary niche.
 * Consumed by Phase 8's pgvector top-K query against scraped_videos.
 * tag_filters: hashtag tokens commonly attached to videos in this niche (no `#` prefix).
 * min_corpus_size: minimum number of corpus videos needed before retrieval signal is trusted.
 */
export type BenchmarkFilters = {
  tag_filters: string[];
  min_corpus_size: number;
};

export type NichePrimary = {
  slug: string;
  label: string;
  subs: NicheSubItem[];
  personas: PersonaMix[];              // NEW Phase 4 (D-13)
  benchmark_filters: BenchmarkFilters; // NEW Phase 4 (D-14)
};

export type NicheTree = NichePrimary[];

export const NICHE_TREE: NicheTree = [
  {
    slug: "beauty",
    label: "Beauty",
    subs: [
      { slug: "skincare", label: "Skincare" },
      { slug: "makeup", label: "Makeup" },
      { slug: "hair", label: "Hair" },
      { slug: "nails", label: "Nails" },
      { slug: "fragrance", label: "Fragrance" },
      { slug: "skincare-reviews", label: "Skincare Reviews" },
      { slug: "get-ready-with-me", label: "Get Ready With Me" },
      { slug: "tutorials", label: "Tutorials" },
      { slug: "hauls", label: "Hauls" },
    ],
    personas: [
      { archetype: "fyp-female-gen-z", weight: 3 },
      { archetype: "fyp-female-millennial", weight: 2 },
      { archetype: "fyp-balanced-gen-z", weight: 1 },
      { archetype: "niche-beauty-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["beauty", "makeup", "skincare", "skincareroutine", "grwm", "makeuptutorial", "haircare", "beautytips"],
      min_corpus_size: 20,
    },
  },
  {
    slug: "fitness",
    label: "Fitness",
    subs: [
      { slug: "strength-training", label: "Strength Training" },
      { slug: "calisthenics", label: "Calisthenics" },
      { slug: "yoga", label: "Yoga" },
      { slug: "running", label: "Running" },
      { slug: "home-workouts", label: "Home Workouts" },
      { slug: "nutrition-diet", label: "Nutrition / Diet" },
      { slug: "mobility", label: "Mobility" },
      { slug: "crossfit", label: "Crossfit" },
      { slug: "powerlifting", label: "Powerlifting" },
      { slug: "bodybuilding", label: "Bodybuilding" },
    ],
    personas: [
      { archetype: "fyp-male-gen-z", weight: 2 },
      { archetype: "fyp-female-gen-z", weight: 2 },
      { archetype: "fyp-male-millennial", weight: 1 },
      { archetype: "fyp-female-millennial", weight: 1 },
      { archetype: "niche-fitness-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["fitness", "gym", "workout", "fittok", "fitnessmotivation", "gymtok", "yoga", "calisthenics", "homeworkout"],
      min_corpus_size: 20,
    },
  },
  {
    slug: "education",
    label: "Education",
    subs: [
      { slug: "coding-programming", label: "Coding / Programming" },
      { slug: "personal-finance", label: "Personal Finance" },
      { slug: "career-advice", label: "Career Advice" },
      { slug: "language-learning", label: "Language Learning" },
      { slug: "science", label: "Science" },
      { slug: "history", label: "History" },
      { slug: "self-improvement", label: "Self-Improvement" },
      { slug: "study-tips", label: "Study Tips" },
    ],
    personas: [
      { archetype: "fyp-male-gen-z", weight: 2 },
      { archetype: "fyp-male-millennial", weight: 2 },
      { archetype: "fyp-balanced-gen-z", weight: 1 },
      { archetype: "fyp-balanced-millennial", weight: 1 },
      { archetype: "niche-education-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["learnontiktok", "edutok", "studytok", "learn", "coding", "programming", "personalfinance", "studytips", "careertips"],
      min_corpus_size: 15,
    },
  },
  {
    slug: "comedy",
    label: "Comedy",
    subs: [
      { slug: "skits", label: "Skits" },
      { slug: "stand-up-clips", label: "Stand-Up Clips" },
      { slug: "parody", label: "Parody" },
      { slug: "observational", label: "Observational" },
      { slug: "pranks", label: "Pranks" },
      { slug: "memes", label: "Memes" },
      { slug: "storytelling", label: "Storytelling" },
      { slug: "character-persona", label: "Character / Persona" },
      { slug: "reactions", label: "Reactions" },
    ],
    personas: [
      { archetype: "fyp-balanced-gen-z", weight: 3 },
      { archetype: "fyp-balanced-millennial", weight: 2 },
      { archetype: "fyp-female-gen-z", weight: 1 },
      { archetype: "niche-comedy-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["comedy", "funny", "humor", "skit", "lol", "memes", "fyp", "comedyskit", "tiktokcomedy"],
      min_corpus_size: 25,
    },
  },
  {
    slug: "lifestyle",
    label: "Lifestyle",
    subs: [
      { slug: "day-in-the-life", label: "Day in the Life" },
      { slug: "travel", label: "Travel" },
      { slug: "home-decor", label: "Home Decor" },
      { slug: "productivity", label: "Productivity" },
      { slug: "routines", label: "Routines" },
      { slug: "minimalism", label: "Minimalism" },
      { slug: "sustainable-living", label: "Sustainable Living" },
      { slug: "hauls", label: "Hauls" },
    ],
    personas: [
      { archetype: "fyp-female-gen-z", weight: 2 },
      { archetype: "fyp-female-millennial", weight: 2 },
      { archetype: "fyp-balanced-gen-z", weight: 1 },
      { archetype: "fyp-balanced-millennial", weight: 1 },
      { archetype: "niche-lifestyle-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["lifestyle", "dayinmylife", "vlog", "routine", "morningroutine", "aesthetic", "thatgirl", "lifestyleblogger"],
      min_corpus_size: 20,
    },
  },
  {
    slug: "food-cooking",
    label: "Food & Cooking",
    subs: [
      { slug: "quick-recipes", label: "Quick Recipes" },
      { slug: "restaurant-reviews", label: "Restaurant Reviews" },
      { slug: "baking", label: "Baking" },
      { slug: "healthy-eating", label: "Healthy Eating" },
      { slug: "meal-prep", label: "Meal Prep" },
      { slug: "international-cuisine", label: "International Cuisine" },
      { slug: "drink-cocktails", label: "Drink / Cocktails" },
      { slug: "food-hacks", label: "Food Hacks" },
    ],
    personas: [
      { archetype: "fyp-female-gen-z", weight: 2 },
      { archetype: "fyp-female-millennial", weight: 2 },
      { archetype: "fyp-male-millennial", weight: 1 },
      { archetype: "fyp-balanced-gen-z", weight: 1 },
      { archetype: "niche-food-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["food", "foodtok", "recipe", "cooking", "baking", "easyrecipe", "foodie", "homemade", "mealprep"],
      min_corpus_size: 20,
    },
  },
  {
    slug: "tech-gadgets",
    label: "Tech & Gadgets",
    subs: [
      { slug: "smartphone-reviews", label: "Smartphone Reviews" },
      { slug: "apps", label: "Apps" },
      { slug: "gaming-gear", label: "Gaming Gear" },
      { slug: "tutorials", label: "Tutorials" },
      { slug: "productivity-tools", label: "Productivity Tools" },
      { slug: "ai-tools", label: "AI Tools" },
      { slug: "smart-home", label: "Smart Home" },
      { slug: "unboxings", label: "Unboxings" },
    ],
    personas: [
      { archetype: "fyp-male-gen-z", weight: 2 },
      { archetype: "fyp-male-millennial", weight: 2 },
      { archetype: "fyp-balanced-millennial", weight: 1 },
      { archetype: "fyp-balanced-gen-z", weight: 1 },
      { archetype: "niche-tech-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["tech", "techtok", "gadgets", "techreview", "iphone", "android", "smartphone", "ai", "aitools", "apps"],
      min_corpus_size: 15,
    },
  },
  {
    slug: "gaming",
    label: "Gaming",
    subs: [
      { slug: "mobile-games", label: "Mobile Games" },
      { slug: "pc-gaming", label: "PC Gaming" },
      { slug: "console-gaming", label: "Console Gaming" },
      { slug: "speedruns", label: "Speedruns" },
      { slug: "tips-tutorials", label: "Tips / Tutorials" },
      { slug: "streaming-highlights", label: "Streaming Highlights" },
      { slug: "esports", label: "Esports" },
      { slug: "indie-games", label: "Indie Games" },
    ],
    personas: [
      { archetype: "fyp-male-gen-z", weight: 3 },
      { archetype: "fyp-male-millennial", weight: 1 },
      { archetype: "fyp-balanced-gen-z", weight: 2 },
      { archetype: "niche-gaming-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["gaming", "gamingtok", "gamer", "gameplay", "videogames", "minecraft", "fortnite", "valorant", "mobilegames"],
      min_corpus_size: 20,
    },
  },
  {
    slug: "fashion-style",
    label: "Fashion & Style",
    subs: [
      { slug: "ootd", label: "OOTD" },
      { slug: "thrifting", label: "Thrifting" },
      { slug: "sustainable-fashion", label: "Sustainable Fashion" },
      { slug: "streetwear", label: "Streetwear" },
      { slug: "vintage", label: "Vintage" },
      { slug: "capsule-wardrobes", label: "Capsule Wardrobes" },
      { slug: "style-tips", label: "Style Tips" },
      { slug: "outfit-inspiration", label: "Outfit Inspiration" },
    ],
    personas: [
      { archetype: "fyp-female-gen-z", weight: 3 },
      { archetype: "fyp-female-millennial", weight: 2 },
      { archetype: "fyp-balanced-gen-z", weight: 1 },
      { archetype: "niche-fashion-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["fashion", "fashiontiktok", "outfit", "ootd", "style", "thrifted", "streetwear", "fashioninspo", "stylingtips"],
      min_corpus_size: 20,
    },
  },
  {
    slug: "music-performance",
    label: "Music & Performance",
    subs: [
      { slug: "singing", label: "Singing" },
      { slug: "dancing", label: "Dancing" },
      { slug: "instrument-covers", label: "Instrument Covers" },
      { slug: "music-production", label: "Music Production" },
      { slug: "songwriting", label: "Songwriting" },
      { slug: "reactions-to-music", label: "Reactions to Music" },
      { slug: "live-performance", label: "Live Performance" },
      { slug: "music-tutorials", label: "Music Tutorials" },
    ],
    personas: [
      { archetype: "fyp-balanced-gen-z", weight: 3 },
      { archetype: "fyp-balanced-millennial", weight: 1 },
      { archetype: "fyp-female-gen-z", weight: 1 },
      { archetype: "fyp-male-gen-z", weight: 1 },
      { archetype: "niche-music-enthusiast", weight: 2 },
      { archetype: "loyalist-existing-follower", weight: 1 },
      { archetype: "cross-niche-curious", weight: 1 },
    ],
    benchmark_filters: {
      tag_filters: ["music", "singing", "musician", "songwriter", "dance", "danceperformance", "instrument", "musicproducer"],
      min_corpus_size: 20,
    },
  },
];

export function getNicheBranches(primarySlug: string): NicheSubItem[] {
  return NICHE_TREE.find((p) => p.slug === primarySlug)?.subs ?? [];
}

export function getPrimaryLabel(slug: string): string | null {
  return NICHE_TREE.find((p) => p.slug === slug)?.label ?? null;
}

export function getSubLabel(primarySlug: string, subSlug: string): string | null {
  return getNicheBranches(primarySlug).find((s) => s.slug === subSlug)?.label ?? null;
}
