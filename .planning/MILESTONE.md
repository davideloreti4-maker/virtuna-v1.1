# Milestone: Prediction Engine Integration

**Branch:** milestone/prediction-engine-integration
**Worktree:** /Users/davideloreti/virtuna-prediction-engine-integration
**Created:** 2026-02-20

## Objective

Wire the hardened prediction engine into the frontend end-to-end: connect history view, implement video upload and TikTok URL extraction, feed real data to hive visualization, expose DeepSeek reasoning, build outcomes feedback loop with auto-scraping, add analytics dashboard, and re-launch trending page with real backend data.

## Tiers

1. **Frontend wiring** — Connect existing engine outputs to UI (history, hive viz, reasoning display, niche fields)
2. **Input expansion** — Video upload pipeline (Supabase Storage + Gemini), TikTok URL extraction (Apify)
3. **Data integrity** — is_calibrated migration, reasoning field storage, proper data flow
4. **Outcomes loop** — Auto-scrape posted content after 48h, feed results back into calibration
5. **Analytics** — Confidence distributions, cost trends, model drift dashboard
6. **Trending re-launch** — Replace mock data with real backend-sourced trending feed
