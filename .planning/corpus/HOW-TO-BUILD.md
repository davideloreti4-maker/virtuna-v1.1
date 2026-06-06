# Apollo Knowledge Core — How to Build It

The corpus track. Runs in parallel with Phase 1 (it's content, not code — zero file overlap with `src/`). Output = `KNOWLEDGE-CORE.md`, which Phase 3 loads into Apollo's **cached system prompt**.

## The workflow

1. **Dump raw sources** into `.planning/corpus/raw/` (gitignore'd if large) — Chase Hughes + the other relevant material (behavioral, persuasion, content intelligence). Books, transcripts, notes.
2. **Distill, don't dump.** Turn raw → the load-bearing *principles + frameworks + worked examples*, in your own synthesis. This is the work and where the value is.
3. **Structure it** into `KNOWLEDGE-CORE.md` (template provided) — the sections match exactly what Phase 3 wires in.
4. **Land v1** even if thin. P3 builds against it; it matures over time.

## Distill, don't dump — the discipline

If you can't get it under ~5–8k tokens, you're dumping, not distilling. Encode the *frameworks* (why a hook works), not the raw book text. A tight expert brief produces sharper, more consistent reasoning than a sprawling knowledge dump — the model attends worse over huge prompts ("lost in the middle"). Distillation quality > corpus volume.

## How big? (cached-prompt sizing)

**Target ~3k–8k tokens (~2,000–5,000 words) for v1. Soft ceiling ~10–15k.**

Why bounded, even though Qwen's context is huge:
- **Cost** — this is the *stable system prefix* sent on every Apollo call (score-mode + decode + adapt all reuse it). Smaller = cheaper cache-miss, and it's the thing prompt-caching discounts ~90% on hits.
- **Quality** — a focused 5k-token expert brief reasons sharper + more consistently than a 100k dump.
- **Cache eviction** — a giant prefix in sparse traffic risks evicting between calls → repeated full-price misses.

Rule of thumb: persona + core behavioral frameworks + scoring rubric + decode lens + a handful of worked examples should fit in that budget. The books don't go in; their *distilled principles* do.

## Cached prompt vs real retrieval (RAG) — the difference

| | **Cached system prompt** (do this for v1) | **Real retrieval / RAG** (later, if needed) |
|---|---|---|
| Where knowledge lives | inside the prompt, **every call** | external store (pgvector), **fetched per request** |
| What the model sees | the **whole** core, always | only the **top-K relevant** chunks for *this* video |
| Corpus size limit | bounded (~what fits + attention) | effectively unlimited |
| Infra | none | embeddings + vector store + a retrieval step (latency) |
| Caching | **cache-friendly** (stable prefix → 90% discount) | NOT cacheable (chunks vary per request) |
| Best when | distilled principles/frameworks | huge library of situational/niche-specific exemplars |

**Analogy:** the cached core = the expert's *internalized training* (always in their head). Retrieval = the expert pulling a *specific case file* from the cabinet when a situation calls for it.

**Decision rule:** start with the cached core — behavioral *principles* distill small and you want them present on every call. Add retrieval **only** when you want hundreds of niche/creator-specific exemplars that can't all fit. Then go **hybrid**: principles in the cached prompt + examples retrieved per video. The repo already has dormant retrieval plumbing (`src/lib/engine/retrieval/` — embedder, pgvector-client, re-ranker) to revive if/when that day comes.

For Apollo v1: **cached core, no retrieval.** Don't add the infra until the corpus proves it can't be distilled small.

## IP hygiene

Ground-to-inform, don't regurgitate. The core encodes *your synthesis of principles* applied to short-form content — not copied passages. The moat is the distillation + application, not the source text.
