#!/usr/bin/env bash
#
# Apollo corpus pipeline — Steps 1+2: download → transcribe.
#
# Reads URLs (YouTube / TikTok / IG), pulls audio via yt-dlp, transcribes via
# whisper.cpp (Metal-accelerated on Apple Silicon), writes plain-text transcripts
# into .planning/corpus/raw/ ready for Step 3 (distill via Claude → KNOWLEDGE-CORE.md).
#
# Usage:
#   ./transcribe.sh urls.txt              # batch: one URL per line (# comments ok)
#   ./transcribe.sh https://youtu.be/...  # single URL
#
# Idempotent: skips any URL whose transcript already exists in raw/.
# Operator-local: audio-cache/ and raw/ are gitignored. Only the distilled
# KNOWLEDGE-CORE.md gets committed.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAW="$DIR/raw"
AUDIO="$DIR/audio-cache"
MODEL="$DIR/models/ggml-large-v3-turbo-q5_0.bin"

mkdir -p "$RAW" "$AUDIO"

if [[ ! -f "$MODEL" ]]; then
  echo "ERROR: model not found at $MODEL" >&2
  echo "Download: curl -L -o '$MODEL' https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin" >&2
  exit 1
fi

# ── Collect URLs ──────────────────────────────────────────────────────────────
URLS=()
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <urls.txt | single-url>" >&2
  exit 1
fi
if [[ -f "$1" ]]; then
  while IFS= read -r line; do
    line="${line%%#*}"                       # strip inline comments
    line="$(echo "$line" | xargs)"           # trim whitespace
    [[ -n "$line" ]] && URLS+=("$line")
  done < "$1"
else
  URLS+=("$1")
fi

echo "[corpus] ${#URLS[@]} URL(s) to process"
ok=0; skip=0; fail=0

for url in "${URLS[@]}"; do
  # Stable slug from the source's own video id (idempotency key)
  id="$(yt-dlp --get-id --no-warnings "$url" 2>/dev/null | head -1 || true)"
  [[ -z "$id" ]] && id="$(echo -n "$url" | shasum | cut -c1-11)"
  title="$(yt-dlp --get-title --no-warnings "$url" 2>/dev/null | head -1 || echo "$id")"
  safe="$(echo "$title" | tr -cs '[:alnum:]' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-60 | sed 's/-$//')"
  slug="${safe}-${id}"
  txt="$RAW/${slug}.txt"

  if [[ -f "$txt" ]]; then
    echo "[corpus] SKIP (exists): $slug"
    ((skip++)); continue
  fi

  echo "[corpus] ── $title"
  wav="$AUDIO/${slug}.wav"

  # 1. Download → 16kHz mono wav (whisper.cpp's native input; no re-encode step)
  if [[ ! -f "$wav" ]]; then
    if ! yt-dlp -x --audio-format wav \
         --postprocessor-args "-ar 16000 -ac 1" \
         --no-warnings -o "$AUDIO/${slug}.%(ext)s" "$url" 2>&1 | tail -1; then
      echo "[corpus] FAIL download: $url" >&2; ((fail++)); continue
    fi
  fi

  # 2. Transcribe → plain text. -np = no progress spam, -nt = no timestamps.
  if whisper-cli -m "$MODEL" -f "$wav" -otxt -np -nt -of "$RAW/${slug}" 2>/dev/null; then
    # Prepend a provenance header for Step 3 / IP hygiene
    { echo "# source: $url"; echo "# title: $title"; echo; cat "$txt"; } > "$txt.tmp" && mv "$txt.tmp" "$txt"
    echo "[corpus] OK → raw/${slug}.txt"
    rm -f "$wav"                              # reclaim space; wav is regeneratable
    ((ok++))
  else
    echo "[corpus] FAIL transcribe: $slug" >&2; ((fail++))
  fi
done

echo "[corpus] done — $ok transcribed, $skip skipped, $fail failed"
echo "[corpus] transcripts in: $RAW"
