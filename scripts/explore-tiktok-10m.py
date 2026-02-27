"""
Explore the HuggingFace TikTok-10M dataset for Virtuna prediction engine training.

Dataset: https://huggingface.co/datasets/The-data-company/TikTok-10M
~6.65M rows, parquet format, public access.

Usage:
  source .venv/bin/activate
  python scripts/explore-tiktok-10m.py [--sample N] [--save]

Flags:
  --sample N   Number of rows to load for exploration (default: 50000)
  --save       Save sample to scripts/data/tiktok-10m-sample.parquet
"""

import argparse
import sys
from pathlib import Path

try:
    import polars as pl
    from datasets import load_dataset
except ImportError:
    print("Missing deps. Run: source .venv/bin/activate && pip install datasets huggingface_hub polars")
    sys.exit(1)


# ─── Config ──────────────────────────────────────────────────────────

DATASET_ID = "The-data-company/TikTok-10M"
DATA_DIR = Path(__file__).parent / "data"

# Columns we care about for Virtuna prediction engine
ENGAGEMENT_COLS = ["play_count", "digg_count", "comment_count", "share_count", "collect_count"]
CONTENT_COLS = ["desc", "duration", "challenges", "music_title", "music_author_name"]
META_COLS = ["id", "user_id", "create_time", "url", "is_ad", "user_verified"]
LOCATION_COLS = ["poi_name", "city", "country_code", "poi_category"]


def load_sample(n: int) -> pl.DataFrame:
    """Load N rows from HuggingFace as a Polars DataFrame."""
    print(f"Loading {n:,} rows from {DATASET_ID}...")
    ds = load_dataset(DATASET_ID, split=f"train[:{n}]")
    df = pl.from_arrow(ds.data.table)
    print(f"Loaded {len(df):,} rows, {len(df.columns)} columns")
    return df


def schema_overview(df: pl.DataFrame) -> None:
    """Print column names, types, and null counts."""
    print("\n" + "=" * 70)
    print("SCHEMA OVERVIEW")
    print("=" * 70)
    for col in df.columns:
        null_pct = df[col].null_count() / len(df) * 100
        dtype = df[col].dtype
        print(f"  {col:<35} {str(dtype):<15} nulls: {null_pct:.1f}%")


def engagement_stats(df: pl.DataFrame) -> None:
    """Analyze engagement distributions — the core of what Virtuna predicts."""
    print("\n" + "=" * 70)
    print("ENGAGEMENT DISTRIBUTIONS")
    print("=" * 70)

    for col in ENGAGEMENT_COLS:
        if col not in df.columns:
            continue
        s = df[col].drop_nulls().cast(pl.Float64)
        if len(s) == 0:
            continue
        print(f"\n  {col}:")
        print(f"    count:  {len(s):>12,}")
        print(f"    mean:   {s.mean():>12,.1f}")
        print(f"    median: {s.median():>12,.1f}")
        print(f"    p75:    {s.quantile(0.75):>12,.1f}")
        print(f"    p90:    {s.quantile(0.90):>12,.1f}")
        print(f"    p99:    {s.quantile(0.99):>12,.1f}")
        print(f"    max:    {s.max():>12,.1f}")

    # Derived rates (same as Virtuna's analyze-dataset.ts)
    print("\n  Derived engagement rates (non-zero views only):")
    valid = df.filter(pl.col("play_count") > 0)
    if len(valid) == 0:
        print("    No rows with play_count > 0")
        return

    rates = valid.select(
        like_rate=(pl.col("digg_count").cast(pl.Float64) / pl.col("play_count")),
        comment_rate=(pl.col("comment_count").cast(pl.Float64) / pl.col("play_count")),
        share_rate=(pl.col("share_count").cast(pl.Float64) / pl.col("play_count")),
        save_rate=(pl.col("collect_count").cast(pl.Float64) / pl.col("play_count")),
    )
    for col in rates.columns:
        s = rates[col].drop_nulls()
        print(f"    {col:<20} median: {s.median():.6f}  p90: {s.quantile(0.90):.6f}  p99: {s.quantile(0.99):.6f}")


def content_analysis(df: pl.DataFrame) -> None:
    """Analyze content features — what we'd extract for prediction."""
    print("\n" + "=" * 70)
    print("CONTENT FEATURES")
    print("=" * 70)

    # Description length
    descs = df["desc"].drop_nulls()
    desc_lens = descs.str.len_chars()
    print(f"\n  Description length (chars):")
    print(f"    empty:  {(desc_lens == 0).sum():,} ({(desc_lens == 0).sum() / len(df) * 100:.1f}%)")
    print(f"    median: {desc_lens.median()}")
    print(f"    p90:    {desc_lens.quantile(0.90)}")

    # Hashtag count from desc
    hashtag_counts = descs.str.count_matches(r"#\w+")
    print(f"\n  Hashtags per post:")
    print(f"    median: {hashtag_counts.median()}")
    print(f"    p90:    {hashtag_counts.quantile(0.90)}")

    # Duration
    dur = df["duration"].drop_nulls()
    print(f"\n  Duration (seconds):")
    print(f"    median: {dur.median()}")
    print(f"    p75:    {dur.quantile(0.75)}")
    print(f"    p90:    {dur.quantile(0.90)}")
    print(f"    max:    {dur.max()}")

    # Challenges field
    challenges = df["challenges"].drop_nulls()
    print(f"\n  Challenges field:")
    print(f"    non-null: {len(challenges):,} ({len(challenges) / len(df) * 100:.1f}%)")
    if len(challenges) > 0:
        print(f"    sample:   {challenges.head(3).to_list()}")

    # Music
    music = df["music_title"].drop_nulls()
    print(f"\n  Music:")
    print(f"    has_music: {len(music):,} ({len(music) / len(df) * 100:.1f}%)")
    if len(music) > 0:
        top_music = df.group_by("music_title").len().sort("len", descending=True).head(10)
        print(f"    top tracks:")
        for row in top_music.iter_rows(named=True):
            print(f"      {row['len']:>6,}x  {row['music_title'][:60]}")

    # Ads
    if "is_ad" in df.columns:
        ads = df["is_ad"].drop_nulls()
        ad_count = (ads == "True").sum() + (ads == "true").sum() + (ads == "1").sum()
        print(f"\n  Ads: {ad_count:,} / {len(df):,} ({ad_count / len(df) * 100:.2f}%)")

    # Verified users
    if "user_verified" in df.columns:
        verified = df["user_verified"].drop_nulls()
        v_count = (verified == "True").sum() + (verified == "true").sum() + (verified == "1").sum()
        print(f"  Verified users: {v_count:,} / {len(df):,} ({v_count / len(df) * 100:.2f}%)")


def location_analysis(df: pl.DataFrame) -> None:
    """Check location/POI data quality."""
    print("\n" + "=" * 70)
    print("LOCATION / POI DATA")
    print("=" * 70)

    for col in LOCATION_COLS:
        if col not in df.columns:
            continue
        non_null = df[col].drop_nulls()
        # Filter out empty strings and zero values
        if non_null.dtype in (pl.Int64, pl.Float64):
            meaningful = non_null.filter(non_null != 0)
        else:
            meaningful = non_null.filter((non_null != "") & (non_null != "0"))
        print(f"  {col:<20} filled: {len(meaningful):>8,} ({len(meaningful) / len(df) * 100:.1f}%)")

    # Top POI categories
    if "poi_category" in df.columns:
        cats = df.filter(pl.col("poi_category").is_not_null() & (pl.col("poi_category") != ""))
        if len(cats) > 0:
            top_cats = cats.group_by("poi_category").len().sort("len", descending=True).head(10)
            print(f"\n  Top POI categories:")
            for row in top_cats.iter_rows(named=True):
                print(f"    {row['len']:>6,}x  {row['poi_category']}")


def virtuna_compatibility(df: pl.DataFrame) -> None:
    """Check how this dataset maps to Virtuna's existing feature set."""
    print("\n" + "=" * 70)
    print("VIRTUNA COMPATIBILITY CHECK")
    print("=" * 70)

    # Features Virtuna currently uses (from analyze-dataset.ts)
    virtuna_features = {
        "views": "play_count",
        "likes": "digg_count",
        "comments": "comment_count",
        "shares": "share_count",
        "bookmarks/saves": "collect_count",
        "description": "desc",
        "duration": "duration",
        "hashtags/challenges": "challenges",
        "music": "music_title",
        "creator_id": "user_id",
        "video_url": "url",
        "timestamp": "create_time",
    }

    print("\n  Feature mapping (Virtuna -> TikTok-10M):")
    for feature, col in virtuna_features.items():
        exists = col in df.columns
        if exists:
            non_null = df[col].drop_nulls()
            coverage = len(non_null) / len(df) * 100
            status = f"coverage: {coverage:.1f}%"
        else:
            status = "MISSING"
        print(f"    {feature:<25} -> {col:<25} {status}")

    # New features available in TikTok-10M but not in current Virtuna
    new_features = {
        "collect_count": "Save/bookmark count (high-intent signal)",
        "poi_name": "Location name",
        "poi_category": "Location category",
        "city": "City",
        "duet_enabled": "Duet collaboration flag",
        "stitch_enabled": "Stitch collaboration flag",
        "music_original": "Original sound vs licensed music",
        "vq_score": "Video quality score",
        "user_verified": "Creator verification status",
        "is_ad": "Promoted/ad content flag",
    }
    print("\n  NEW features (not in current Virtuna):")
    for col, desc in new_features.items():
        if col in df.columns:
            non_null = df[col].drop_nulls()
            coverage = len(non_null) / len(df) * 100
            print(f"    {col:<25} {coverage:>5.1f}%  {desc}")


def sample_rows(df: pl.DataFrame, n: int = 5) -> None:
    """Show a few sample rows for visual inspection."""
    print("\n" + "=" * 70)
    print(f"SAMPLE ROWS (first {n})")
    print("=" * 70)

    cols = ["id", "desc", "play_count", "digg_count", "comment_count", "share_count",
            "collect_count", "duration", "music_title", "challenges"]
    available = [c for c in cols if c in df.columns]
    sample = df.select(available).head(n)

    for i, row in enumerate(sample.iter_rows(named=True)):
        print(f"\n  --- Row {i + 1} ---")
        for k, v in row.items():
            val = str(v)[:80] if v is not None else "null"
            print(f"    {k:<20} {val}")


def save_sample(df: pl.DataFrame) -> None:
    """Save sample as parquet for offline analysis."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "tiktok-10m-sample.parquet"
    df.write_parquet(path)
    print(f"\nSaved {len(df):,} rows to {path}")
    print(f"File size: {path.stat().st_size / 1024 / 1024:.1f} MB")


def main():
    parser = argparse.ArgumentParser(description="Explore TikTok-10M dataset for Virtuna")
    parser.add_argument("--sample", type=int, default=50_000, help="Rows to load (default: 50000)")
    parser.add_argument("--save", action="store_true", help="Save sample to parquet")
    args = parser.parse_args()

    df = load_sample(args.sample)

    schema_overview(df)
    engagement_stats(df)
    content_analysis(df)
    location_analysis(df)
    virtuna_compatibility(df)
    sample_rows(df)

    if args.save:
        save_sample(df)

    print("\n" + "=" * 70)
    print("NEXT STEPS")
    print("=" * 70)
    print("""
  1. Load full dataset:  python scripts/explore-tiktok-10m.py --sample 1000000 --save
  2. Compare distributions with Virtuna's Apify-scraped data
  3. Test Gemini Vision on video URLs for multimodal feature extraction
  4. Build training pipeline: TikTok-10M -> feature extraction -> XGBoost baseline
    """)


if __name__ == "__main__":
    main()
