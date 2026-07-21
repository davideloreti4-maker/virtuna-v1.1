/**
 * STREAM primitives — the closed 21-primitive vocabulary behind the `composed` block
 * (THE STREAM rework, phase 1; rev 9 hybrid — the 1:1 skill cards delegate to their
 * shipped renderers).
 *
 * Design contract: docs/prototypes/stream-concept-rev7.html (frozen 2026-07-20) —
 * answer-first thread: prose is the backbone; structure appears inline only where the
 * content earns it. Skill runners compose these deterministically; the chat agent will
 * compose them ad-hoc (phase 5). Both paths validate here — THREAD-04 ("no
 * model-generated UI") holds because a composition is DATA against this registry, and
 * composed-block.tsx owns every pixel.
 *
 * THE LAWS the schema itself enforces (each has a must-fail test in
 * __tests__/stream-primitives.test.ts):
 *  - ONE frame total        → at most one `asset` item per composition
 *  - one receipt, leading   → at most one `receipt`, and only at index 0
 *  - one control row        → at most one `input-ask` per composition
 *  - accent marks ONE thing → table: at most one `accent` cell; stats: at most one `warn`
 *  - table rows are honest  → every row exactly matches the declared columns
 *
 * THE EXTENSION GUARANTEE: adding primitive #22 = (1) one schema below + its entry in
 * STREAM_ITEM_SCHEMAS, (2) one renderer case in composed-block.tsx (the exhaustiveness
 * `never` breaks the build until it exists), (3) one item in the canonical fixture (the
 * kind-coverage test fails until it exists). Nothing else. Deferred with tripwires:
 * `chart` (first skill needing a trend picture) · `timeline` (first multi-day skill).
 */

import { z } from "zod";
import {
  HookProofSchema,
  HookCardBlockSchema,
  IdeaCardBlockSchema,
  MultiAudienceReadBlockSchema,
  AccountReadBlockSchema,
} from "./blocks";
import { VideoTestCardBlockSchema } from "./profile-blocks";

// ─── Shared sub-shapes ────────────────────────────────────────────────────────

/** Band vocabulary — same words as BandBlock (D-02 honesty spine: never a 0-100 here). */
export const StreamBandSchema = z.enum(["Strong", "Mixed", "Weak"]);

export type StreamBand = z.infer<typeof StreamBandSchema>;

/**
 * Proof line — band dot+word · fraction · optional room door. Flows left with its
 * content. Reused standalone AND inside ranked / compare / revision (fixed embedding,
 * never arbitrary nesting — the stream is flat by construction).
 */
export const StreamProofSchema = z.object({
  band: StreamBandSchema,
  /** e.g. "8/10 stopped" — stated once, neutral cream (never band-tinted). */
  fraction: z.string().min(1).optional(),
  /** Renders "See the room →" when true. */
  door: z.boolean().optional(),
});

export type StreamProof = z.infer<typeof StreamProofSchema>;

/** Measured engagement (scrape data, formatted) — the VideoCard 4-col grid's fields.
 *  Every field optional: we show only what was measured, never a fabricated stat. */
export const StreamEngagementSchema = z.object({
  likes: z.string().optional(),
  comments: z.string().optional(),
  shares: z.string().optional(),
  saves: z.string().optional(),
});

export type StreamEngagement = z.infer<typeof StreamEngagementSchema>;

/** Verbatim — ONE quote, ONE speaker (italic, left-ruled). */
export const StreamVerbatimSchema = z.object({
  quote: z.string().min(1).max(240),
  speaker: z.string().min(1),
});

export type StreamVerbatim = z.infer<typeof StreamVerbatimSchema>;

// ─── The 17 generic primitives ────────────────────────────────────────────────

/** 1 · prose — the default; markdown in voice. Also the ONLY empty state. */
const ProseItemSchema = z.object({
  kind: z.literal("prose"),
  text: z.string().min(1),
  /** Quiet variant — the muted closing/interpretation line. */
  quiet: z.boolean().optional(),
});

/** 2 · receipt line — ✓ skill · what ran · steps · model. The collapsed capsule. */
const ReceiptItemSchema = z.object({
  kind: z.literal("receipt"),
  skill: z.string().min(1),
  /** e.g. "ran your audience · 3 steps" — what actually happened, from the run. */
  summary: z.string().min(1),
  /** Provenance tag (D-10) — demoted into the receipt, never a headline. */
  model: z.enum(["sim1-flash", "sim1-max"]).optional(),
  running: z.boolean().optional(),
});

/** 3 · evidence rows — tool rows ONLY (honesty spine); each opens the real video.
 *  The video reference is THE app's core object — a row carries the full treatment
 *  (cover · title · when/duration · facet · measured numbers), every field tool-fed
 *  and optional: absent data renders as absence, never as a placeholder value. */
const EvidenceItemSchema = z.object({
  kind: z.literal("evidence"),
  /** The card eyebrow — what these rows ARE ("Your last posts, measured"). Absent → "Sources". */
  label: z.string().optional(),
  rows: z
    .array(
      z.object({
        title: z.string().min(1),
        /** Who/when — "@handle" or "May 18". */
        byline: z.string().optional(),
        /** Real cover (ephemeral CDN) — renders as a 9:16 tower via CoverFill. */
        coverUrl: z.string().nullable().optional(),
        /** e.g. "0:34". */
        duration: z.string().optional(),
        /** Formatted views, e.g. "2.1M". */
        views: z.string().optional(),
        /** Posted date, e.g. "May 18". */
        posted: z.string().optional(),
        /** The structural read of the video — "talking-head confession · receipts overlay". */
        facet: z.string().optional(),
        /** Measured multiplier, e.g. "9.2×". Absent = nothing measured (never fake it). */
        multiplier: z.object({ value: z.string().min(1), direction: z.enum(["up", "down"]) }).optional(),
        /** The multiplier's basis — "vs your usual". Renderer shows it with the number. */
        baseline: z.string().optional(),
        /** Measured engagement breakdown (likes/comments/shares/saves). */
        engagement: StreamEngagementSchema.optional(),
        /** Free-text fallback note (legacy rows / anything the fields above don't carry). */
        meta: z.string().optional(),
        url: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(8),
});

/** The structured source receipt a ranked result may carry — THE HookProofSchema
 *  (§11f receipts-on-cards), reused verbatim so the stream renders the SAME shipped
 *  <ProofReceipt> as every make-family card. One schema, one component, zero drift. */
export const StreamSourceProofSchema = HookProofSchema;

export type StreamSourceProof = z.infer<typeof StreamSourceProofSchema>;

/** 4 · media strip — covers + one metric + fit; the basis stated ONCE per strip. */
const MediaStripItemSchema = z.object({
  kind: z.literal("media-strip"),
  /** The card eyebrow — what this strip IS ("Proven in adjacent rooms"). Absent → "Videos". */
  label: z.string().optional(),
  /** The group states the shared fact — e.g. "× = views vs that creator's usual reach". */
  basis: z.string().optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        /** The ONE number on the tile, e.g. "12×". */
        metric: z.string().optional(),
        /** Predicted fit for this audience — dot + word. */
        fit: StreamBandSchema.optional(),
        byline: z.string().optional(),
        duration: z.string().optional(),
        /** Formatted views, e.g. "2.4M" — the tile's second fact line. */
        views: z.string().optional(),
        /** The structural read — "confession · zero-cut". */
        facet: z.string().optional(),
        /** Measured engagement breakdown (likes/comments/shares/saves). */
        engagement: StreamEngagementSchema.optional(),
        coverUrl: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(6),
});

/** 5 · ranked results — n · hero · proof · verbatim · source. */
const RankedItemSchema = z.object({
  kind: z.literal("ranked"),
  items: z
    .array(
      z.object({
        /** Rank marker — "1", "2", or "→" for a single adapted result. */
        marker: z.string().min(1).max(3).optional(),
        /** The quiet eyebrow above the hero — who this is for ("For your Skeptics"). */
        kicker: z.string().optional(),
        hero: z.string().min(1),
        /** The why-it-works / why-it-fits line — the insight under the hero, muted. */
        insight: z.string().optional(),
        /** Labeled insight lines (the old cards' anatomy: Why it works · Format · Seed).
         *  Max 4 — density has a ceiling; the deep dive lives one door away. */
        details: z
          .array(z.object({ label: z.string().min(1), text: z.string().min(1) }))
          .max(4)
          .optional(),
        proof: StreamProofSchema.optional(),
        verbatim: StreamVerbatimSchema.optional(),
        /** The full structured source receipt (cover · [template] · stats · fit). */
        sourceProof: StreamSourceProofSchema.optional(),
        /** Forward-chain label ("Write script →"). Renders the card action bar; the
         *  handler wires at migration — never model-executed (THREAD-04). */
        primaryAction: z.string().optional(),
        /** Plain attribution fallback — "↳ structure from @handle · 90.7× vs followers". */
        source: z.string().optional(),
        sourceUrl: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(8),
});

/** 6 · proof line, standalone (e.g. a concept test's verdict). */
const ProofItemSchema = z.object({ kind: z.literal("proof") }).extend(StreamProofSchema.shape);

/** 7 · verbatim, standalone. */
const VerbatimItemSchema = z.object({ kind: z.literal("verbatim") }).extend(StreamVerbatimSchema.shape);

/** 8 · compare group — per-audience: head + verdict · interpretation · lever ·
 *  who-not-for · verbatim · persona drill (the old Read card's full anatomy). */
const CompareItemSchema = z.object({
  kind: z.literal("compare"),
  /** The card eyebrow — what this compare IS. Absent → "The Read". */
  label: z.string().optional(),
  audiences: z
    .array(
      z.object({
        name: z.string().min(1),
        proof: StreamProofSchema,
        /** The one-line read of WHY the band landed — "{band} Read. {interpretation}". */
        interpretation: z.string().optional(),
        /** The actionable difference — leads the body. */
        lever: z.string().optional(),
        /** Who scrolls past — derived from low-disposition personas, never invented. */
        whoNotFor: z.string().optional(),
        verbatim: StreamVerbatimSchema.optional(),
        /** Per-persona reaction drill (collapsed by default) — context reactions ONLY. */
        personas: z
          .array(
            z.object({
              archetype: z.string().min(1),
              verdict: z.enum(["stop", "scroll"]),
              quote: z.string().min(1),
            }),
          )
          .max(12)
          .optional(),
      }),
    )
    .min(2)
    .max(4),
});

/** 9 · fact rows — mark · claim · basis-count, optionally grouped under quiet labels. */
const FactsItemSchema = z.object({
  kind: z.literal("facts"),
  /** The card eyebrow — what these findings ARE. Absent → "Findings". */
  label: z.string().optional(),
  sections: z
    .array(
      z.object({
        /** Quiet group label, e.g. "Keep doing" / "Costing you". */
        label: z.string().optional(),
        rows: z
          .array(
            z.object({
              mark: z.enum(["good", "fix", "none"]),
              claim: z.string().min(1),
              /** The count that backs the claim — "9 of 12 posts". */
              basis: z.string().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

/** 10 · revision — old → new · re-scored proof with the delta stated. */
const RevisionItemSchema = z.object({
  kind: z.literal("revision"),
  /** The card eyebrow — what changed. Absent → "Revision". */
  label: z.string().optional(),
  before: z.string().min(1),
  after: z.string().min(1),
  proof: StreamProofSchema.optional(),
});

/** 11 · plan slots — when · what · why-for-you. */
const PlanItemSchema = z.object({
  kind: z.literal("plan"),
  slots: z
    .array(
      z.object({
        when: z.string().min(1),
        what: z.string().min(1),
        why: z.string().optional(),
      }),
    )
    .min(1)
    .max(14),
});

/** 12 · input ask — prose asks, ONE control row answers. 1–3 slots (rev 7 multi-slot). */
const InputAskItemSchema = z.object({
  kind: z.literal("input-ask"),
  slots: z
    .array(
      z.object({
        type: z.enum(["text", "link", "select", "confirm"]),
        label: z.string().optional(),
        placeholder: z.string().optional(),
        /** Required when type is "select". */
        options: z.array(z.string().min(1)).min(2).max(6).optional(),
      }),
    )
    .min(1)
    .max(3),
  submitLabel: z.string().min(1),
});

/** 13 · persona turn — the speaker label swaps, the prose stays. No bubbles anywhere. */
const PersonaTurnItemSchema = z.object({
  kind: z.literal("persona-turn"),
  speaker: z.string().min(1),
  text: z.string().min(1),
});

/** 14 · asset block — the take-away deliverable. THE stream's ONLY frame. */
const AssetItemSchema = z.object({
  kind: z.literal("asset"),
  /** Uppercase kicker naming the deliverable type — "Script". */
  label: z.string().min(1),
  title: z.string().min(1),
  /** Right-side meta — "~40s · 5 beats". */
  meta: z.string().optional(),
  rows: z
    .array(
      z.object({
        /** Row label — "Hook". */
        label: z.string().min(1),
        /** Sub-label under it — "0–3s". */
        sub: z.string().optional(),
        text: z.string().min(1),
        /** The why-this-works footnote. */
        note: z.string().optional(),
      }),
    )
    .min(1)
    .max(12),
});

/** 15 · stat line (rev 7) — number · delta · label at fact-row weight. NEVER a KPI tile. */
const StatsItemSchema = z
  .object({
    kind: z.literal("stats"),
    items: z
      .array(
        z.object({
          value: z.string().min(1),
          label: z.string().min(1),
          /** "warn" tints the value — the ONE caution a stat line may carry. */
          tone: z.enum(["plain", "warn"]).optional(),
        }),
      )
      .min(1)
      .max(4),
  })
  .refine((s) => s.items.filter((i) => i.tone === "warn").length <= 1, {
    message: "a stat line marks at most ONE value as warn (accent marks one thing)",
  });

/** 16 · table (rev 7) — comparable rows × named columns; accent marks at most ONE cell. */
const TableItemSchema = z
  .object({
    kind: z.literal("table"),
    columns: z
      .array(
        z.object({
          label: z.string().min(1),
          align: z.enum(["left", "right"]).optional(),
        }),
      )
      .min(2)
      .max(5),
    rows: z
      .array(
        z.array(
          z.object({
            text: z.string().min(1),
            /** dim = secondary · strong = the winner (cream bold) · accent = THE one loss. */
            tone: z.enum(["plain", "dim", "strong", "accent"]).optional(),
          }),
        ),
      )
      .min(1)
      .max(20),
  })
  .refine((t) => t.rows.every((row) => row.length === t.columns.length), {
    message: "every table row must have exactly one cell per declared column",
  })
  .refine((t) => t.rows.flat().filter((c) => c.tone === "accent").length <= 1, {
    message: "a table marks at most ONE cell with accent (accent marks one thing)",
  });

/** 17 · test verdict (rev 8) — THE FLAGSHIP. The /test result card, 1:1 the shipped
 *  video-test-card props (delegated to VideoTestCardRenderer — zero drift): verdict
 *  WORD + band + fraction + the one fix + reactions + the /analyze door. Bands only
 *  in-thread; the 0-100 lives on /analyze (honesty spine). */
const TestVerdictItemSchema = z
  .object({ kind: z.literal("test-verdict") })
  .extend(VideoTestCardBlockSchema.shape.props.shape);

// ─── Delegated skill cards (rev 9 — the hybrid) ───────────────────────────────
// Owner call 2026-07-21: where a skill result already has a SHIPPED card, the stream
// carries that card's props 1:1 and delegates to the REAL component (the test-verdict
// pattern, generalized to the 1:1 make-family cards). Fidelity is guaranteed by
// construction — a schema/renderer change to the old card updates the stream with it,
// zero drift possible, nothing the old card showed can go missing. The GENERIC
// ranked / compare / facts primitives stay as the ad-hoc fallback for a result that has
// NO canonical card (the chat composer, phase 5).

/** 18 · hook-card — THE shipped Hooks card, props 1:1 → HookCardRenderer. */
const HookCardItemSchema = z.object({ kind: z.literal("hook-card") }).extend(HookCardBlockSchema.shape.props.shape);

/** 19 · idea-card — THE shipped Ideas card, props 1:1 → IdeaCardRenderer. */
const IdeaCardItemSchema = z.object({ kind: z.literal("idea-card") }).extend(IdeaCardBlockSchema.shape.props.shape);

/** 20 · multi-audience-read — THE shipped Read card, props 1:1 → MultiAudienceReadBlockRenderer. */
const MultiAudienceReadItemSchema = z
  .object({ kind: z.literal("multi-audience-read") })
  .extend(MultiAudienceReadBlockSchema.shape.props.shape);

/** 21 · account-read — THE shipped Account Read card, props 1:1 → AccountReadBlockRenderer. */
const AccountReadItemSchema = z.object({ kind: z.literal("account-read") }).extend(AccountReadBlockSchema.shape.props.shape);

// ─── The union + the composed block ──────────────────────────────────────────

export const StreamItemSchema = z.discriminatedUnion("kind", [
  ProseItemSchema,
  ReceiptItemSchema,
  EvidenceItemSchema,
  MediaStripItemSchema,
  RankedItemSchema,
  ProofItemSchema,
  VerbatimItemSchema,
  CompareItemSchema,
  FactsItemSchema,
  RevisionItemSchema,
  PlanItemSchema,
  InputAskItemSchema,
  PersonaTurnItemSchema,
  AssetItemSchema,
  StatsItemSchema,
  TableItemSchema,
  TestVerdictItemSchema,
  HookCardItemSchema,
  IdeaCardItemSchema,
  MultiAudienceReadItemSchema,
  AccountReadItemSchema,
]);

export type StreamItem = z.infer<typeof StreamItemSchema>;
export type StreamItemKind = StreamItem["kind"];

/** The closed vocabulary, enumerable — fixtures + coverage tests iterate this. */
export const STREAM_PRIMITIVE_KINDS = [
  "prose",
  "receipt",
  "evidence",
  "media-strip",
  "ranked",
  "proof",
  "verbatim",
  "compare",
  "facts",
  "revision",
  "plan",
  "input-ask",
  "persona-turn",
  "asset",
  "stats",
  "table",
  "test-verdict",
  "hook-card",
  "idea-card",
  "multi-audience-read",
  "account-read",
] as const satisfies readonly StreamItemKind[];

export const ComposedBlockSchema = z.object({
  type: z.literal("composed"),
  props: z
    .object({
      items: z.array(StreamItemSchema).min(1).max(24),
    })
    .refine((p) => p.items.filter((i) => i.kind === "asset").length <= 1, {
      message: "ONE frame total — at most one asset block per composition",
    })
    .refine((p) => p.items.filter((i) => i.kind === "receipt").length <= 1, {
      message: "one receipt line per composition",
    })
    .refine((p) => p.items.findIndex((i) => i.kind === "receipt") <= 0, {
      message: "the receipt leads — a receipt line may only be the first item",
    })
    .refine((p) => p.items.filter((i) => i.kind === "input-ask").length <= 1, {
      message: "one control row per composition — at most one input-ask",
    }),
});

export type ComposedBlock = z.infer<typeof ComposedBlockSchema>;
