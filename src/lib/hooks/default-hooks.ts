/**
 * default-hooks.ts — Discover Feed Hooks vault (UI-refinement, v1 seed).
 *
 * A curated SEED of proven viral hook TEMPLATES for the /feed/hooks vault. Each carries a
 * category, the creator it's inspired by, and an illustrative outlier/views signal. The
 * vault's "Showing format" toggle swaps the bracketed `template` for a filled `example`.
 *
 * This is the "Default hooks" section. "Hooks from your analyzed videos" comes from the
 * analyze pipeline (Phase 3) — until that ships the vault shows an empty state for it.
 * Counts are static illustration; refine freely. Multipliers under 1 are real (a famous
 * template that under-performed for that specific post) — the vault shows the honest signal.
 */
export const HOOK_CATEGORIES = [
  "Question",
  "Personal Experience",
  "Secret Reveal Breakdown",
  "Authority",
  "Contrarian",
  "List",
] as const;
export type HookCategory = (typeof HOOK_CATEGORIES)[number];

export interface DefaultHook {
  id: string;
  /** The hook with [bracketed] placeholders. */
  template: string;
  /** A filled-in example (shown when "Showing format" is off). */
  example: string;
  category: HookCategory;
  /** Creator handle the template is inspired by (no '@'). */
  inspiredBy: string;
  /** Illustrative outlier multiplier (vs the creator's baseline). */
  multiplier: number;
  /** Illustrative views on the source post. */
  views: number;
}

export const DEFAULT_HOOKS: DefaultHook[] = [
  {
    id: "personal-most-adjective",
    template: "I just got the most [adjective] [noun] ever.",
    example: "I just got the most unhinged DM from a brand ever.",
    category: "Personal Experience",
    inspiredBy: "chloe.shih",
    multiplier: 0.8,
    views: 298_000,
  },
  {
    id: "secret-technique-result",
    template: "This [technique/system] has gotten me [impressive result], but [reason it's rare/secret].",
    example: "This posting system has gotten me 2M views a month, but almost nobody does it because it's boring.",
    category: "Secret Reveal Breakdown",
    inspiredBy: "rico.incarnati",
    multiplier: 5.3,
    views: 114_000,
  },
  {
    id: "authority-took-me-time",
    template: "I'm a [Professional]. It took me [Time] to learn this and I'm gonna teach you in [Short Time].",
    example: "I'm a psychologist. It took me 10 years to learn this and I'm gonna teach you in 30 seconds.",
    category: "Authority",
    inspiredBy: "the.pocket.psychologist",
    multiplier: 114,
    views: 7_200_000,
  },
  {
    id: "secret-wave-trend",
    template: "There's a wave of [trend] blowing up right now that [benefit], but [common barrier].",
    example: "There's a wave of faceless channels blowing up right now that print money, but everyone quits in week two.",
    category: "Secret Reveal Breakdown",
    inspiredBy: "rico.incarnati",
    multiplier: 18.8,
    views: 405_000,
  },
  {
    id: "contrarian-everything-lie",
    template: "Everything you heard about [Subject] was a lie.",
    example: "Everything you heard about posting times was a lie.",
    category: "Contrarian",
    inspiredBy: "artofhaf",
    multiplier: 5.7,
    views: 157_000,
  },
  {
    id: "list-only-n",
    template: "These are the only [number] [category] you need to [action] if you want to [desired outcome].",
    example: "These are the only 3 hooks you need to memorize if you want to go viral this month.",
    category: "List",
    inspiredBy: "thomas.grammm",
    multiplier: 2,
    views: 3_300_000,
  },
  {
    id: "question-what-separates",
    template: "What separates the [group] who [positive outcome] from the ones who [negative outcome]?",
    example: "What separates the creators who blow up from the ones who post for years to nobody?",
    category: "Question",
    inspiredBy: "personalbrandlaunch",
    multiplier: 3.1,
    views: 220_000,
  },
  {
    id: "question-why-nobody-tells",
    template: "Why does nobody tell you that [counterintuitive truth] before you [common action]?",
    example: "Why does nobody tell you that your first 100 videos are supposed to flop before you start?",
    category: "Question",
    inspiredBy: "vanessalau",
    multiplier: 4.4,
    views: 410_000,
  },
  {
    id: "personal-tried-for-days",
    template: "I tried [challenge] for [time period] and [surprising outcome].",
    example: "I tried posting 3x a day for 30 days and the results genuinely shocked me.",
    category: "Personal Experience",
    inspiredBy: "natalie.barbu",
    multiplier: 2.6,
    views: 540_000,
  },
  {
    id: "authority-ive-done-x",
    template: "I've [done impressive thing] [number] times — here's the [pattern] nobody talks about.",
    example: "I've scripted over 500 viral videos — here's the structure nobody talks about.",
    category: "Authority",
    inspiredBy: "brendanjkane",
    multiplier: 6.9,
    views: 1_100_000,
  },
  {
    id: "contrarian-stop-doing",
    template: "Stop [common advice]. It's quietly killing your [goal].",
    example: "Stop chasing trends. It's quietly killing your reach.",
    category: "Contrarian",
    inspiredBy: "garyvee",
    multiplier: 3.4,
    views: 2_100_000,
  },
  {
    id: "list-things-i-wish",
    template: "[number] things I wish I knew before I [milestone].",
    example: "5 things I wish I knew before I hit my first million views.",
    category: "List",
    inspiredBy: "jennyhoyos",
    multiplier: 8.2,
    views: 1_700_000,
  },
];
