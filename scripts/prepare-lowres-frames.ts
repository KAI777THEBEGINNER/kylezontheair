/**
 * Generate low-resolution AVIF frames from full-res frames.
 *
 * Strategy: every other frame (stride=2), 75% resolution, quality 40.
 * Output: ~175 frames, ~20-25MB total at public/frames_lr/.
 *
 * Usage: npx tsx scripts/prepare-lowres-frames.ts
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const FRAMES_DIR = path.join(__dirname, "..", "public", "frames");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "frames_lr");
const SCALE = 0.75;
const QUALITY = 40;
const EFFORT = 3;

async function main() {
  if (!fs.existsSync(FRAMES_DIR)) {
    console.error(`❌ Frames directory not found: ${FRAMES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(FRAMES_DIR)
    .filter((f) => f.startsWith("frame_") && f.endsWith(".avif"))
    .sort();

  if (files.length === 0) {
    console.error("❌ No AVIF frames found");
    process.exit(1);
  }

  // Clean and recreate output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    for (const f of fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".avif"))) {
      fs.unlinkSync(path.join(OUTPUT_DIR, f));
    }
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let count = 0;
  const start = performance.now();

  // Every other frame: index 0, 2, 4, ... → frame_0001.avif, frame_0003.avif, ...
  for (let i = 0; i < files.length; i += 2) {
    const srcFile = files[i];
    const inputPath = path.join(FRAMES_DIR, srcFile);
    const match = srcFile.match(/frame_(\d+)\.avif/);
    const frameNum = match ? match[1] : String(i + 1).padStart(4, "0");
    const outName = `frame_lr_${frameNum}.avif`;
    const outPath = path.join(OUTPUT_DIR, outName);

    try {
      const metadata = await sharp(inputPath).metadata();
      const newWidth = Math.round((metadata.width || 1920) * SCALE);
      const newHeight = Math.round((metadata.height || 1080) * SCALE);

      await sharp(inputPath)
        .resize(newWidth, newHeight)
        .avif({ quality: QUALITY, effort: EFFORT })
        .toFile(outPath);

      count++;
      if (count % 50 === 0) {
        console.log(`  🎞️  ${count} low-res frames generated...`);
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${srcFile} — ${err}`);
    }
  }

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  const totalSize = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith(".avif"))
    .reduce((sum, f) => sum + fs.statSync(path.join(OUTPUT_DIR, f)).size, 0);

  console.log(
    `✅ ${count} low-res frames → ${OUTPUT_DIR} (${(totalSize / 1024 / 1024).toFixed(1)}MB) in ${elapsed}s`
  );
}

main();
