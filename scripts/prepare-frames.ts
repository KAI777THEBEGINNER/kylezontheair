import fs from "fs";
import path from "path";
import sharp from "sharp";

const INPUT_DIR = process.env.FRAMES_DIR ?? "./frames-input";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "frames");
const TARGET_FRAMES = 350;
const QUALITY = 65;

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Input directory not found: ${INPUT_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Clean old frames
  const oldFiles = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".avif") || f.endsWith(".webp"));
  for (const f of oldFiles) {
    fs.unlinkSync(path.join(OUTPUT_DIR, f));
  }

  const inputFiles = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  const totalFrames = inputFiles.length;
  console.log(`Found ${totalFrames} input frames`);

  const pickedIndices: number[] = [];
  for (let i = 0; i < TARGET_FRAMES; i++) {
    const srcIdx = Math.min(totalFrames - 1, Math.round((i / (TARGET_FRAMES - 1)) * (totalFrames - 1)));
    pickedIndices.push(srcIdx);
  }

  // Deduplicate in case rounding collapses the last few frames
  const uniqueIndices = Array.from(new Set(pickedIndices));
  console.log(`Selected ${uniqueIndices.length} unique frames`);

  let totalSize = 0;
  const startTime = Date.now();

  for (let i = 0; i < uniqueIndices.length; i++) {
    const srcIdx = uniqueIndices[i];
    const srcFile = inputFiles[srcIdx];
    const srcPath = path.join(INPUT_DIR, srcFile);
    const outName = `frame_${String(i + 1).padStart(4, "0")}.avif`;
    const outPath = path.join(OUTPUT_DIR, outName);

    const buffer = await sharp(srcPath)
      .avif({ quality: QUALITY, effort: 4 })
      .toBuffer();

    fs.writeFileSync(outPath, buffer);
    totalSize += buffer.length;

    if ((i + 1) % 50 === 0 || i === uniqueIndices.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = (((i + 1) / uniqueIndices.length) * 100).toFixed(1);
      console.log(`Progress: ${i + 1}/${uniqueIndices.length} (${pct}%) - ${elapsed}s`);
    }
  }

  const totalMB = (totalSize / 1024 / 1024).toFixed(1);
  console.log(`\nDone! Generated ${uniqueIndices.length} frames, total ${totalMB} MB`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
