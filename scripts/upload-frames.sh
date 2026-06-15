#!/usr/bin/env bash
# Upload AVIF frame files to CDN for Vercel deployment.
#
# Vercel's 50MB output limit silently drops the 142MB of frames from public/.
# This script uploads them to a CDN so the site can load them at runtime.
#
# Supported targets:
#   r2    — Cloudflare R2 (recommended, free 10GB + no egress fees)
#
# Prerequisites:
#   - For R2: install wrangler CLI (`npm i -g wrangler`) and login (`wrangler login`)
#
# After upload, set NEXT_PUBLIC_FRAMES_CDN in Vercel environment variables:
#   - R2: https://pub-<hash>.r2.dev  (or your custom domain)
#
# Usage:
#   ./scripts/upload-frames.sh r2

set -euo pipefail

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
    if ! command -v wrangler &>/dev/null; then
      echo "❌ wrangler CLI not found. Install with: npm i -g wrangler"
      exit 1
    fi

    BUCKET_NAME="${2:-kyle-frames}"

    echo ""
    echo "📤 Uploading frames to Cloudflare R2 bucket: $BUCKET_NAME"
    echo "   This may take a while (~142MB)..."
    echo ""

    # Create bucket if it doesn't exist
    wrangler r2 bucket create "$BUCKET_NAME" 2>/dev/null || true

    # Upload all frames (preserving directory structure)
    wrangler r2 object put "$BUCKET_NAME/frames/" --file "$FRAMES_DIR" --recursive 2>/dev/null || {
      # Fallback: upload one by one if recursive fails
      echo "Recursive upload failed, uploading files individually..."
      for f in "$FRAMES_DIR"/frame_*.avif; do
        filename=$(basename "$f")
        wrangler r2 object put "$BUCKET_NAME/frames/$filename" --file "$f" --content-type "image/avif"
      done
    }

    # Also upload poster
    POSTER="$(cd "$(dirname "$0")/.." && pwd)/public/background/poster.webp"
    if [ -f "$POSTER" ]; then
      wrangler r2 object put "$BUCKET_NAME/background/poster.webp" --file "$POSTER" --content-type "image/webp"
    fi

    echo ""
    echo "✅ Upload complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Enable public access on the R2 bucket (Settings > Public access)"
    echo "  2. Copy the public URL (e.g. https://pub-xxxx.r2.dev)"
    echo "  3. Set NEXT_PUBLIC_FRAMES_CDN=<public-url> in Vercel environment variables"
    echo "  4. Redeploy on Vercel"
    ;;
  *)
    echo "Usage: $0 {r2}"
    echo ""
    echo "Targets:"
    echo "  r2    Upload to Cloudflare R2 (recommended)"
    echo ""
    echo "Example:"
    echo "  $0 r2 my-bucket-name"
    exit 1
    ;;
esac
