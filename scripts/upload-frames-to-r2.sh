#!/bin/bash
# 一键上传 frames_no_ascii/ 到 Cloudflare R2
# 用法: cd /Users/zhaoziqi/workspace/kais_digital_chatbot_website && bash scripts/upload-frames-to-r2.sh

set -uo pipefail

BUCKET="kyle-frames"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMES_DIR="$SCRIPT_DIR/../public/frames_no_ascii"
CONCURRENCY=10
R2_PUBLIC_URL="https://pub-5b262f84698749bd9d521f37d11ab232.r2.dev"
LOG_DIR="/tmp/r2-upload-logs"

rm -rf "$LOG_DIR"
mkdir -p "$LOG_DIR"

TOTAL=$(ls "$FRAMES_DIR"/*.avif | wc -l | tr -d ' ')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  R2 帧上传脚本"
echo "  Bucket:   $BUCKET"
echo "  文件数:   $TOTAL"
echo "  并发数:   $CONCURRENCY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: 登录
echo ""
echo "▶ Step 1: 登录 Cloudflare（浏览器弹出授权页面，点击 Allow）"
npx wrangler login

echo ""
echo "▶ 验证登录..."
if ! npx wrangler r2 bucket list 2>&1 | grep -q "$BUCKET"; then
  echo "✘ 登录失败或找不到 bucket: $BUCKET"
  exit 1
fi
echo "✔ 登录成功"

# Step 2: 批量上传
echo ""
echo "▶ Step 2: 上传帧文件（$CONCURRENCY 并发）..."

ACTIVE=0
I=0
for file in "$FRAMES_DIR"/*.avif; do
  I=$((I + 1))
  filename=$(basename "$file")
  key="frames_no_ascii/$filename"

  npx wrangler r2 object put "$BUCKET/$key" --file "$file" --content-type "image/avif" --remote > "$LOG_DIR/$filename.log" 2>&1 &
  ACTIVE=$((ACTIVE + 1))

  # 每凑满 CONCURRENCY 个，等一批完成
  if [ "$ACTIVE" -ge "$CONCURRENCY" ]; then
    wait
    ACTIVE=0
    printf "\r  已提交: %d/%d" "$I" "$TOTAL"
  fi
done

# 等待剩余任务
wait
printf "\r  已提交: %d/%d ✔" "$I" "$TOTAL"
echo ""

# 统计结果
DONE=$(grep -l "Upload complete" "$LOG_DIR"/*.log 2>/dev/null | wc -l | tr -d ' ')
FAIL_FILES=$(grep -L "Upload complete" "$LOG_DIR"/*.log 2>/dev/null)

echo ""
echo "▶ 上传结果: 成功 $DONE / 总计 $TOTAL"

if [ -n "$FAIL_FILES" ]; then
  FAIL_COUNT=$(echo "$FAIL_FILES" | wc -l | tr -d ' ')
  echo "  失败 $FAIL_COUNT 个:"
  echo "$FAIL_FILES" | while read -r f; do
    echo "    ✘ $(basename "$f" .log)"
  done
fi

# Step 3: 验证
echo ""
echo "▶ Step 3: 验证 R2 可访问性..."
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$R2_PUBLIC_URL/frames_no_ascii/frame_0001.avif")
if [ "$HTTP_CODE" = "200" ]; then
  echo "✔ R2 验证通过！刷新网站背景应该回来了"
else
  echo "⚠ R2 返回 HTTP $HTTP_CODE，可能需要等几秒缓存生效"
  echo "  手动确认: $R2_PUBLIC_URL/frames_no_ascii/frame_0001.avif"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
