#!/usr/bin/env bash
# Upload AVIF frame files to Cloudflare R2 for CDN delivery.
#
# Usage:
#   ./scripts/upload-frames.sh r2 [bucket-name]
#
# Prerequisites:
#   - npx wrangler (auto-detected) or global wrangler
#   - wrangler login (authenticated)
#
# After upload:
#   1. Enable public access on the R2 bucket (Settings > Public access)
#   2. Copy the public URL (e.g. https://pub-xxxx.r2.dev)
#   3. Set NEXT_PUBLIC_FRAMES_CDN=<public-url> in Vercel environment variables
#   4. Redeploy via CLI: vercel --prod

FRAMES_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/frames"
FRAME_COUNT=$(ls "$FRAMES_DIR"/frame_*.avif 2>/dev/null | wc -l | tr -d ' ')

if [ "$FRAME_COUNT" -eq 0 ]; then
  echo "❌ No AVIF frames found in $FRAMES_DIR"
  exit 1
fi

echo "Found $FRAME_COUNT AVIF frames in $FRAMES_DIR"
echo "Total size: $(du -sh "$FRAMES_DIR" | cut -f1)"

TARGET="${1:-}"
case "$TARGET" in
  r2)
    # Support both global wrangler and npx wrangler
    if command -v wrangler &>/dev/null; then
      WRANGLER="wrangler"
    elif command -v npx &>/dev/null; then
      WRANGLER="npx wrangler"
    else
      echo "❌ wrangler CLI not found. Install with: npm i -g wrangler"
      exit 1
    fi

    BUCKET_NAME="${2:-kyle-frames}"
    MAX_RETRIES=3

    echo ""
    echo "📤 Uploading frames to Cloudflare R2 bucket: $BUCKET_NAME"
    echo "   This may take a while (~142MB)..."
    echo ""

    SUCCESS=0
    FAIL=0
    SKIP=0

    for f in "$FRAMES_DIR"/frame_*.avif; do
      filename=$(basename "$f")
      uploaded=false

      for attempt in $(seq 1 $MAX_RETRIES); do
        if $WRANGLER r2 object put "$BUCKET_NAME/frames/$filename" --file "$f" --content-type "image/avif" --remote 2>&1 | grep -q "Upload complete"; then
          SUCCESS=$((SUCCESS + 1))
          uploaded=true
          # Progress indicator
          echo "  ✅ [$SUCCESS/$FRAME_COUNT] $filename"
          break
        else
          if [ "$attempt" -lt "$MAX_RETRIES" ]; then
            echo "  ⚠️  Retry $attempt/$MAX_RETRIES for $filename..."
            sleep 2
          fi
        fi
      done

      if [ "$uploaded" = false ]; then
        FAIL=$((FAIL + 1))
        echo "  ❌ Failed after $MAX_RETRIES retries: $filename"
      fi
    done

    # Upload poster
    POSTER="$(cd "$(dirname "$0")/.." && pwd)/public/background/poster.webp"
    if [ -f "$POSTER" ]; then
      echo ""
      echo "📤 Uploading poster..."
      $WRANGLER r2 object put "$BUCKET_NAME/background/poster.webp" --file "$POSTER" --content-type "image/webp" --remote
    fi

    # ── Upload low-res frames ──
    LOWRES_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/frames_lr"
    LOWRES_COUNT=$(ls "$LOWRES_DIR"/frame_lr_*.avif 2>/dev/null | wc -l | tr -d ' ')

    if [ "$LOWRES_COUNT" -gt 0 ]; then
      echo ""
      echo "📤 Uploading low-res frames to Cloudflare R2 bucket: $BUCKET_NAME"
      echo "   Found $LOWRES_COUNT low-res frames"
      echo ""

      LR_SUCCESS=0
      LR_FAIL=0

      for f in "$LOWRES_DIR"/frame_lr_*.avif; do
        filename=$(basename "$f")
        uploaded=false

        for attempt in $(seq 1 $MAX_RETRIES); do
          if $WRANGLER r2 object put "$BUCKET_NAME/frames_lr/$filename" --file "$f" --content-type "image/avif" --remote 2>&1 | grep -q "Upload complete"; then
            LR_SUCCESS=$((LR_SUCCESS + 1))
            uploaded=true
            echo "  ✅ [$LR_SUCCESS/$LOWRES_COUNT] $filename"
            break
          else
            if [ "$attempt" -lt "$MAX_RETRIES" ]; then
              echo "  ⚠️  Retry $attempt/$MAX_RETRIES for $filename..."
              sleep 2
            fi
          fi
        done

        if [ "$uploaded" = false ]; then
          LR_FAIL=$((LR_FAIL + 1))
          echo "  ❌ Failed after $MAX_RETRIES retries: $filename"
        fi
      done

      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "Low-res upload: ✅ $LR_SUCCESS  ❌ $LR_FAIL"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Uploaded: $SUCCESS"
    if [ "$FAIL" -gt 0 ]; then
      echo "❌ Failed:   $FAIL"
      echo ""
      echo "Re-run the script to retry failed uploads."
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Next steps:"
    echo "  1. Enable public access on the R2 bucket (Settings > Public access)"
    echo "  2. Copy the public URL (e.g. https://pub-xxxx.r2.dev)"
    echo "  3. Set NEXT_PUBLIC_FRAMES_CDN=<public-url> in Vercel environment variables"
    echo "  4. Redeploy: vercel --prod"
    ;;
  *)
    echo "Usage: $0 {r2} [bucket-name]"
    echo ""
    echo "Targets:"
    echo "  r2    Upload to Cloudflare R2 (recommended)"
    echo ""
    echo "Example:"
    echo "  $0 r2 my-bucket-name"
    exit 1
    ;;
esac
