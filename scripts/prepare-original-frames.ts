/**
 * 从原始视频 main.mp4 直接抽帧，生成"无 ASCII 处理"的原始静帧序列。
 *
 * 流程：
 *   1. ffmpeg 导出视频全部帧为 PNG 到临时目录
 *   2. 均匀采样 350 帧（与 prepare-frames.ts 相同算法）
 *   3. sharp 转码为 AVIF（quality=65, effort=4）
 *   4. 输出到 public/frames_original/
 *   5. 清理临时 PNG
 *
 * 用法: npx tsx scripts/prepare-original-frames.ts
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";

const VIDEO_PATH = "/Users/zhaoziqi/Desktop/kaisitebackground/main.mp4";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "frames_original");
const TARGET_FRAMES = 350;
const QUALITY = 65;
const EFFORT = 4;

async function main() {
  // --- 0. 检查视频文件 ---
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`❌ 视频文件不存在: ${VIDEO_PATH}`);
    process.exit(1);
  }

  // --- 1. 准备临时目录 ---
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "frames-original-"));
  console.log(`📁 临时目录: ${tmpDir}`);

  // --- 2. ffmpeg 导出全部帧为 PNG ---
  console.log("🎬 正在用 ffmpeg 导出全部帧...");
  try {
    execSync(
      `ffmpeg -y -i "${VIDEO_PATH}" -v quiet -stats "${tmpDir}/frame_%04d.png"`,
      { stdio: "inherit" }
    );
  } catch (err) {
    console.error("❌ ffmpeg 导出失败:", err);
    fs.rmSync(tmpDir, { recursive: true });
    process.exit(1);
  }

  const pngFiles = fs
    .readdirSync(tmpDir)
    .filter((f) => f.endsWith(".png"))
    .sort();

  const totalFrames = pngFiles.length;
  console.log(`   导出完成，共 ${totalFrames} 帧 PNG`);

  // --- 3. 均匀采样（与 prepare-frames.ts 完全一致） ---
  const pickedIndices: number[] = [];
  for (let i = 0; i < TARGET_FRAMES; i++) {
    const srcIdx = Math.min(
      totalFrames - 1,
      Math.round((i / (TARGET_FRAMES - 1)) * (totalFrames - 1))
    );
    pickedIndices.push(srcIdx);
  }

  const uniqueIndices = Array.from(new Set(pickedIndices));
  console.log(`   采样 ${uniqueIndices.length} 个唯一帧索引`);

  // --- 4. 准备输出目录 ---
  if (fs.existsSync(OUTPUT_DIR)) {
    const oldFiles = fs
      .readdirSync(OUTPUT_DIR)
      .filter((f) => f.endsWith(".avif") || f.endsWith(".webp") || f.endsWith(".png"));
    for (const f of oldFiles) {
      fs.unlinkSync(path.join(OUTPUT_DIR, f));
    }
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // --- 5. 转码为 AVIF ---
  console.log("🖼️  正在转码为 AVIF...");
  let totalSize = 0;
  const startTime = Date.now();

  for (let i = 0; i < uniqueIndices.length; i++) {
    const srcIdx = uniqueIndices[i];
    const srcFile = pngFiles[srcIdx];
    const srcPath = path.join(tmpDir, srcFile);
    const outName = `frame_${String(i + 1).padStart(4, "0")}.avif`;
    const outPath = path.join(OUTPUT_DIR, outName);

    const buffer = await sharp(srcPath)
      .avif({ quality: QUALITY, effort: EFFORT })
      .toBuffer();

    fs.writeFileSync(outPath, buffer);
    totalSize += buffer.length;

    if ((i + 1) % 50 === 0 || i === uniqueIndices.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = (((i + 1) / uniqueIndices.length) * 100).toFixed(1);
      console.log(`  进度: ${i + 1}/${uniqueIndices.length} (${pct}%) - ${elapsed}s`);
    }
  }

  // --- 6. 清理临时目录 ---
  fs.rmSync(tmpDir, { recursive: true });
  console.log("🧹 临时文件已清理");

  const totalMB = (totalSize / 1024 / 1024).toFixed(1);
  console.log(`\n✅ 完成！生成 ${uniqueIndices.length} 帧，共 ${totalMB} MB`);
  console.log(`   输出目录: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("💥 致命错误:", err);
  process.exit(1);
});
