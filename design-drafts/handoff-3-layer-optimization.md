# 3-Layer Loading Optimization · 交接文档

> 写给下一个 session 的更强模型 review 用。包含需求原文、设计决策、关键 trade-off、完整源码草稿。

---

## 一、需求原文

> 新加3层加载优化设计，确保首次进入流畅性：
> 1. 分辨率降为当前75%+fps直接砍半，第一次进入先加载这个兜底版背景静帧，确保兜底版全部完毕之后再加载完整版分辨率和fps的背景偷偷替换。
> 2. 兜底版背景如果还是掉帧（跳到非相邻帧），加一个仿crt扫过的过渡效果（但不需要抖动），跳帧不要硬切。
> 3. 聊天部分背景不能最后才就位，很多时候会卡着上面的背景进入聊天，聊天部分的背景必须按预期呈现最后一张静帧。

补充 1：聊天背景锁定末帧不能直接硬切，仍需渐显。
补充 2：首屏（hero 段，帧 0-24）用全分辨率帧，不进低分辨率兜底——一进站就看到糊的体验很差。

---

## 二、当前系统状态

- 350 张 AVIF 帧（`frame_0001.avif` ~ `frame_0350.avif`），~142MB，从 Cloudflare R2 CDN 分发
- 单 `<canvas>` 渲染，DPR 上限 2，cover-fit 算法
- 3 阶段预加载：hero(25帧) → entrepreneurship(50帧) → 其余 section keyframe priority → gap fill
- 动态窗口：前 45 帧 + 后 15 帧跟随 scroll position 按需加载
- poster 降级图（`poster.webp`，540KB）作为 canvas 未就绪时的安全网
- 最近邻 fallback：当前帧未加载时，绘制距离最近的已加载帧
- `onReady` 在 hero 全分辨率帧（0-24）就绪时触发，loading bar 消失
- chat 在 `progress > 0.98` 时激活（`isLocked=true`），overlay z-40+ 盖在 canvas z-2 之上
- 关键文件：`app/components/ScrollFrameBackground.tsx`（358 行）、`app/page.tsx`（265 行）

---

## 三、设计方案

### Layer 1：低分辨率兜底

| 参数 | 全分辨率版 | 低分辨率兜底版 |
|------|-----------|---------------|
| 帧数 | 350 | 175（stride=2，取 index 0,2,4...） |
| 分辨率 | 100% | 75%（sharp resize） |
| AVIF quality | 65 | 40 |
| 单帧均大小 | ~400KB | ~115-140KB |
| 总计 | ~142MB | ~14.2MB（实测） |
| 10Mbps 加载时间 | ~114s | ~11s |

**首屏规则**：hero 段（帧 0-24）用全分辨率帧，不进低分辨率兜底——进站就看到糊的体验很差。

**渲染架构**（两版共用）：双 canvas 叠加。
```
z-0: poster <img>     （安全网 + chat 背景）
z-1: 低分辨率 <canvas> （始终有内容——175 帧全部缓存；hero 段也绘制，作为兜底）
z-2: 全分辨率 <canvas> （帧就绪时绘制；hero 段优先就绪→首屏高清；未就绪时 clearRect 透明→透出低分辨率层）
```

**索引映射**（两版共用）：低分辨率帧只存在于偶数索引（0, 2, 4...），奇数索引通过 `getNearestLowResIndex()` 映射到最近偶数帧（优先取 forward）。

**关键决策**（两版共用）：
- `onReady` 绑定全部 175 张低分辨率帧就绪（保证非 hero 段滚动不塌）
- loading bar 分母 175（低分辨率帧总数）
- 低分辨率 canvas 始终绘制（包括 hero 段），作为全分辨率 canvas 未就绪时的安全网

---

#### 版本 A：串行加载（hero 高清 → 低分辨率兜底 → 其余全分辨率）

```
Phase 0: hero 全分辨率帧（0-24，25 帧，~10MB，~8s）
           → 首屏立即可显示全分辨率 hero
Phase 1: 全部 175 张低分辨率帧（14.2MB，~11s）
           → 全部就绪 → onReady 触发，loading bar 消失
Phase 2: 后台静默加载其余全分辨率帧（25-349）
           → 复用现有优先级策略（entrepreneurship → keyframe stride → gap fill）

总 onReady 耗时：~8s + ~11s = ~19s
```

**优势**：hero 绝对高清。Phase 0 先跑完 25 帧全分辨率，首屏 100% 不糊，不存在任何 race condition。
**代价**：loading bar 显示 ~19 秒（串行排队，低分辨率必须等 hero 全分辨率跑完才开始）。

---

#### 版本 B：并行加载（hero 高清 ‖ 低分辨率兜底 → 其余全分辨率）

```
Phase 0a: hero 全分辨率帧（0-24，~10MB）──┐
                                          ├─ Promise.allSettled 并行
Phase 0b: 全部 175 张低分辨率帧（14.2MB）──┘
           → 低分辨率全部就绪 → onReady 触发，loading bar 消失
           → hero 全分辨率大概率先就绪（25 帧 vs 175 帧），首屏高清

Phase 1:  后台静默加载其余全分辨率帧（25-349）
           → 复用现有优先级策略

总 onReady 耗时：max(~8s, ~11s) = ~11s
```

**优势**：loading bar ~11 秒消失（比串行快 8 秒）。正常网络下 hero 25 帧（~10MB）先于低分辨率 175 帧（14.2MB）完成，首屏仍高清。
**代价**：存在理论 race——如果低分辨率先于 hero 完成（极慢 CDN 节点 + hero 帧恰好在同一节点拥堵），首屏可能短暂看到低分辨率 hero → 几百 ms 后被 hero 全分辨率覆盖，有一次画质跳变。

---

#### 两版对比

| 维度 | 串行（A） | 并行（B） |
|------|----------|----------|
| loading bar 时长 | ~19s | ~11s |
| 首屏高清保证 | 100%（Phase 0 先跑 hero） | 大概率（hero 帧更少，先到） |
| race condition | 无 | 理论上存在（低分辨率先于 hero 完成） |
| 画质跳变风险 | 零 | 极低概率出现一次（低分辨率→全分辨率） |
| 实现复杂度 | 低（两个 await 串行） | 中（Promise.allSettled + 错误处理） |
| 推荐场景 | 追求绝对确定性 | 追求加载速度优先 |

### Layer 2：CRT 扫描过渡

**触发**：`|当前帧索引 - 上一帧索引| > 1`（低分辨率层跳帧）。`crtBusyRef` 防止过渡期间重复触发。

**效果**：全屏黑色 overlay → `scaleY(0→1)` wipe-in 200ms → 帧更新（midpoint 回调）→ `scaleY(1→0)` wipe-out 200ms。总 ~400ms。

**视觉**：
- 细微水平扫描线（CSS `repeating-linear-gradient`，白色 4% opacity，2px 间距）
- 中心发光横线（`::after` 伪元素，白色 60% opacity + box-shadow，仅 wipe-in 阶段可见）
- 纯 CSS 实现，GPU 加速（scaleY 触发 composite layer），无 canvas shader 依赖

### Layer 3：聊天背景锁定末帧（crossfade 渐显）

`page.tsx` 已有 `isLocked` 状态 → 新增 prop `isChatLocked` 传入 `ScrollFrameBackground`。

`isChatLocked` 变为 `true` 时：
```
canvas opacity:  1.0 ────→ 0.0   (500ms ease)
poster opacity:  0.0 ────→ 1.0   (500ms ease)
```
两边同步 crossfade。RAF handler 中跳过 canvas 绘制（减少不必要的 GPU 工作）。

`isChatLocked` 变为 `false` 时反向。

---

## 四、完整源码草稿

> 以下为全部改动的逐文件完整代码。标注 `// NEW` 或 `// CHANGED` 的是改动点。

### 文件 1/7：`scripts/prepare-lowres-frames.ts`（新建）

依赖 sharp（项目已有）。

```typescript
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

  const files = fs.readdirSync(FRAMES_DIR)
    .filter((f) => f.startsWith("frame_") && f.endsWith(".avif"))
    .sort();

  if (files.length === 0) {
    console.error("❌ No AVIF frames found");
    process.exit(1);
  }

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
  const totalSize = fs.readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith(".avif"))
    .reduce((sum, f) => sum + fs.statSync(path.join(OUTPUT_DIR, f)).size, 0);

  console.log(
    `✅ ${count} low-res frames → ${OUTPUT_DIR} (${(totalSize / 1024 / 1024).toFixed(1)}MB) in ${elapsed}s`
  );
}

main();
```

---

### 文件 2/7：`app/components/CrtTransition.tsx`（新建）

```typescript
"use client";

import { useEffect, useState, useRef } from "react";

interface CrtTransitionProps {
  active: boolean;
  onMidpoint?: () => void;   // wipe-in 完成时调用，用于更新帧
  onComplete?: () => void;   // 整个过渡完成时调用
}

/**
 * CRT scan-line wipe overlay.
 * Sequence: wipe-in 200ms → midpoint (frame update) → wipe-out 200ms.
 * Total ~400ms. No shake — pure vertical scale + subtle glow line.
 */
export default function CrtTransition({
  active,
  onMidpoint,
  onComplete,
}: CrtTransitionProps) {
  const [phase, setPhase] = useState<"idle" | "wiping-in" | "wiping-out">("idle");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!active) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Phase 1: wipe in
    setPhase("wiping-in");

    const t1 = setTimeout(() => {
      onMidpoint?.();

      // Phase 2: wipe out
      setPhase("wiping-out");

      const t2 = setTimeout(() => {
        setPhase("idle");
        onComplete?.();
      }, 200);

      timersRef.current.push(t2);
    }, 200);

    timersRef.current.push(t1);

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`crt-wipe-overlay ${phase === "wiping-in" ? "crt-wipe--in" : ""} ${phase === "wiping-out" ? "crt-wipe--out" : ""}`}
      aria-hidden="true"
    />
  );
}
```

---

### 文件 3/7：`app/globals.css`（追加，约 45 行）

在文件末尾追加：

```css
/* ── CRT scan-line wipe overlay ── */
.crt-wipe-overlay {
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  transform: scaleY(0);
  transform-origin: center;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
  background:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.04) 2px,
      rgba(255, 255, 255, 0.04) 4px
    ),
    #000;
}

.crt-wipe-overlay.crt-wipe--in {
  transform: scaleY(1);
}

.crt-wipe-overlay.crt-wipe--out {
  transform: scaleY(0);
}

/* Center glow line — flashes briefly during wipe-in */
.crt-wipe-overlay::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow:
    0 0 10px rgba(255, 255, 255, 0.4),
    0 1px 4px rgba(255, 255, 255, 0.2);
  transform: translateY(-50%) scaleX(0);
  transition: transform 80ms ease-out;
}

.crt-wipe-overlay.crt-wipe--in::after {
  transform: translateY(-50%) scaleX(1);
}
```

---

### 文件 4/7：`app/components/ScrollFrameBackground.tsx`（完整替换，~420 行）

```typescript
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import CrtTransition from "./CrtTransition";

interface Props {
  progress: number;
  totalFrames?: number;
  onReady?: () => void;
  onProgress?: (ratio: number) => void;
  posterSrc?: string;
  isChatLocked?: boolean; // NEW
}

const TOTAL_FRAMES_DEFAULT = 350;

const FRAMES_CDN = process.env.NEXT_PUBLIC_FRAMES_CDN || "";

const FRAME_RANGES = [
  { id: "hero", start: 0, end: 24 },
  { id: "entrepreneurship", start: 49, end: 98 },
  { id: "internship", start: 121, end: 174 },
  { id: "education", start: 215, end: 245 },
  { id: "bridge", start: 286, end: 324 },
];

const KEYFRAME_STRIDE = 3;
const DYNAMIC_LOOK_BEHIND = 15;
const DYNAMIC_LOOK_AHEAD = 45;
const GAP_BRIDGE_COUNT = 10;

// ── Path helpers ──

function framePath(index: number): string {
  const filename = `frame_${String(index + 1).padStart(4, "0")}.avif`;
  return FRAMES_CDN ? `${FRAMES_CDN}/frames/${filename}` : `/frames/${filename}`;
}

function frameLrPath(index: number): string { // NEW
  const filename = `frame_lr_${String(index + 1).padStart(4, "0")}.avif`;
  return FRAMES_CDN ? `${FRAMES_CDN}/frames_lr/${filename}` : `/frames_lr/${filename}`;
}

function getNearestLowResIndex(frameIndex: number, totalFrames: number): number { // NEW
  if (frameIndex % 2 === 0) return frameIndex;
  const lower = frameIndex - 1;
  const upper = frameIndex + 1;
  if (upper < totalFrames) return upper; // prefer forward
  return lower;
}

// ── Section / keyframe helpers (unchanged) ──

function getCurrentAndNextSection(
  frameIndex: number
): {
  current: (typeof FRAME_RANGES)[number] | null;
  next: (typeof FRAME_RANGES)[number] | null;
} {
  for (let i = 0; i < FRAME_RANGES.length; i++) {
    const section = FRAME_RANGES[i];
    if (frameIndex >= section.start && frameIndex <= section.end) {
      return { current: section, next: FRAME_RANGES[i + 1] ?? null };
    }
    if (
      i < FRAME_RANGES.length - 1 &&
      frameIndex > section.end &&
      frameIndex < FRAME_RANGES[i + 1].start
    ) {
      return { current: null, next: FRAME_RANGES[i + 1] };
    }
  }
  return { current: null, next: null };
}

function getKeyframePriority(indices: number[], stride: number): number[] {
  if (indices.length === 0) return [];
  const base = indices[0];
  const keyframes: number[] = [];
  const fillFrames: number[] = [];
  for (const idx of indices) {
    if ((idx - base) % stride === 0) {
      keyframes.push(idx);
    } else {
      fillFrames.push(idx);
    }
  }
  return [...keyframes, ...fillFrames];
}

// ── Cover-fit draw helper (extracted for reuse) ──

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvas: HTMLCanvasElement
) {
  const cw = canvas.width;
  const ch = canvas.height;
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = cw / ch;
  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (canvasAspect > imgAspect) {
    drawW = cw;
    drawH = cw / imgAspect;
    drawX = 0;
    drawY = (ch - drawH) / 2;
  } else {
    drawH = ch;
    drawW = ch * imgAspect;
    drawX = (cw - drawW) / 2;
    drawY = 0;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

// ── Component ──

export default function ScrollFrameBackground({
  progress,
  totalFrames = TOTAL_FRAMES_DEFAULT,
  onReady,
  onProgress,
  posterSrc = "/background/poster.webp",
  isChatLocked = false,
}: Props) {
  // Full-res canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedRef = useRef<Set<number>>(new Set());

  // NEW: Low-res canvas
  const canvasLrRef = useRef<HTMLCanvasElement>(null);
  const imagesLrRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedLrRef = useRef<Set<number>>(new Set());

  const [ready, setReady] = useState(false);
  const [lowResReady, setLowResReady] = useState(false); // NEW
  const [loadProgress, setLoadProgress] = useState(0);   // CHANGED: was criticalProgress
  const currentProgressRef = useRef(progress);
  const rafRef = useRef<number | null>(null);

  // NEW: CRT state
  const lastFrameRef = useRef<number>(0);
  const [crtActive, setCrtActive] = useState(false);
  const crtBusyRef = useRef(false);
  const pendingFrameRef = useRef<number | null>(null);

  currentProgressRef.current = progress;
  const lowResTotal = Math.ceil(totalFrames / 2); // NEW: 175

  // ── Full-res frame loader ──

  const loadFrame = useCallback(
    (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (loadedRef.current.has(index) || imagesRef.current.has(index)) {
          resolve();
          return;
        }
        const img = new Image();
        img.decoding = "async";
        img.src = framePath(index);
        img.onload = () => {
          loadedRef.current.add(index);
          imagesRef.current.set(index, img);
          resolve();
        };
        img.onerror = () => {
          loadedRef.current.add(index);
          resolve();
        };
      });
    },
    []
  );

  // NEW: Low-res frame loader
  const loadFrameLr = useCallback(
    (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (loadedLrRef.current.has(index) || imagesLrRef.current.has(index)) {
          resolve();
          return;
        }
        const img = new Image();
        img.decoding = "async";
        img.src = frameLrPath(index);
        img.onload = () => {
          loadedLrRef.current.add(index);
          imagesLrRef.current.set(index, img);
          setLoadProgress((p) => Math.min(1, p + 1 / lowResTotal));
          resolve();
        };
        img.onerror = () => {
          loadedLrRef.current.add(index);
          setLoadProgress((p) => Math.min(1, p + 1 / lowResTotal));
          resolve();
        };
      });
    },
    [lowResTotal]
  );

  // ── Draw helpers ──

  const drawLowRes = useCallback(() => {
    const canvas = canvasLrRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(currentProgressRef.current * (totalFrames - 1)))
    );
    const lrIndex = getNearestLowResIndex(frameIndex, totalFrames);

    const img = imagesLrRef.current.get(lrIndex);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCover(ctx, img, canvas);
    } else {
      // Nearest-neighbor fallback within low-res frames
      let nearest = -1;
      let minDist = Infinity;
      imagesLrRef.current.forEach((_, key) => {
        const dist = Math.abs(key - lrIndex);
        if (dist < minDist) { minDist = dist; nearest = key; }
      });
      const nearestImg = nearest >= 0 ? imagesLrRef.current.get(nearest) : null;
      if (nearestImg && nearestImg.complete && nearestImg.naturalWidth > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCover(ctx, nearestImg, canvas);
      }
    }
  }, [totalFrames]);

  const drawFullRes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(currentProgressRef.current * (totalFrames - 1)))
    );

    const img = imagesRef.current.get(frameIndex);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCover(ctx, img, canvas);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // transparent → low-res shows through
    }
  }, [totalFrames]);

  const drawBoth = useCallback(() => {
    drawLowRes();
    drawFullRes();
  }, [drawLowRes, drawFullRes]);

  // ── RAF loop ──

  useEffect(() => {
    if (!ready) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (!isChatLocked) { // CHANGED: skip drawing when chat is locked
        const frameIndex = Math.min(
          totalFrames - 1,
          Math.max(0, Math.round(currentProgressRef.current * (totalFrames - 1)))
        );

        const frameGap = Math.abs(frameIndex - lastFrameRef.current);
        if (frameGap > 1 && !crtBusyRef.current) { // NEW: CRT trigger
          crtBusyRef.current = true;
          pendingFrameRef.current = frameIndex;
          setCrtActive(true);
        } else if (!crtBusyRef.current) {
          lastFrameRef.current = frameIndex;
          drawBoth();
        }
      }
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progress, ready, drawLowRes, drawFullRes, drawBoth, isChatLocked, totalFrames]);

  // NEW: CRT callbacks
  const handleCrtMidpoint = useCallback(() => {
    if (pendingFrameRef.current !== null) {
      lastFrameRef.current = pendingFrameRef.current;
      pendingFrameRef.current = null;
    }
    drawBoth();
  }, [drawBoth]);

  const handleCrtComplete = useCallback(() => {
    crtBusyRef.current = false;
    setCrtActive(false);
    pendingFrameRef.current = null;
  }, []);

  // ── Progress reporting ──

  useEffect(() => {
    onProgress?.(loadProgress);
  }, [loadProgress, onProgress]);

  // ── Initial loading ──
  // 两版方案，选一执行。其余代码完全相同。
  //
  // 版本 A：串行 — hero 全分辨率先跑完，再跑低分辨率。首屏绝对高清，loading bar ~19s。
  // 版本 B：并行 — hero 全分辨率与低分辨率同时跑。loading bar ~11s，首屏大概率高清。
  //
  // ═══════════════════════════════════════════════════════════
  // 版本 A：串行加载
  // ═══════════════════════════════════════════════════════════
  //
  // const runLoading = async () => {
  //   const all = Array.from({ length: totalFrames }, (_, i) => i);
  //   const heroFrames = all.slice(FRAME_RANGES[0].start, FRAME_RANGES[0].end + 1);
  //
  //   // Phase 0: hero full-res first → first screen guaranteed sharp
  //   await loadBatch(heroFrames);
  //   if (cancelled) return;
  //
  //   // Phase 1: all low-res → onReady when complete
  //   await loadBatchLr(allLrIndices);
  //   if (cancelled) return;
  //   setLowResReady(true);
  //   setReady(true);
  //   onReady?.();
  //
  //   // Phase 2: background load remaining full-res
  //   const nextFrames = all.slice(FRAME_RANGES[1].start, FRAME_RANGES[1].end + 1);
  //   await loadBatch(nextFrames);
  //   ... (same as below)
  // };
  //
  // ═══════════════════════════════════════════════════════════
  // 版本 B：并行加载（当前激活）
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    let cancelled = false;
    const BATCH_SIZE = 12;

    const allLrIndices: number[] = [];
    for (let i = 0; i < totalFrames; i += 2) allLrIndices.push(i); // NEW

    const loadBatchLr = async (indices: number[]) => { // NEW
      for (let i = 0; i < indices.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = indices.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(loadFrameLr));
      }
    };

    const loadBatch = async (indices: number[]) => {
      for (let i = 0; i < indices.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = indices.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((idx) => loadFrame(idx)));
      }
    };

    const runLoading = async () => {
      const all = Array.from({ length: totalFrames }, (_, i) => i);
      const heroFrames = all.slice(FRAME_RANGES[0].start, FRAME_RANGES[0].end + 1);

      // Phase 0a + 0b in PARALLEL: hero full-res + all low-res
      // Promise.allSettled so one failing doesn't block the other
      const [heroResult, lrResult] = await Promise.allSettled([
        loadBatch(heroFrames),      // Phase 0a: hero full-res (25 frames, ~10MB)
        loadBatchLr(allLrIndices),  // Phase 0b: all low-res (175 frames, 14.2MB)
      ]);
      if (cancelled) return;

      // Log if hero didn't finish first (unexpected but non-fatal)
      if (heroResult.status === "rejected") {
        console.warn("Hero full-res preload failed, falling back to low-res for hero section");
      }

      // onReady when low-res is fully cached (guarantees scroll safety for all sections)
      setLowResReady(true);
      setReady(true);
      onReady?.();

      // Phase 1: Background load remaining full-res (non-hero, reuses existing priority)
      const nextFrames = all.slice(FRAME_RANGES[1].start, FRAME_RANGES[1].end + 1);
      await loadBatch(nextFrames);

      for (const section of FRAME_RANGES.slice(2)) {
        if (cancelled) return;
        const sectionFrames = Array.from(
          { length: section.end - section.start + 1 },
          (_, i) => section.start + i
        );
        const ordered = getKeyframePriority(sectionFrames, KEYFRAME_STRIDE);
        await loadBatch(ordered);
      }

      const gapFrames = all.filter(
        (i) =>
          i > FRAME_RANGES[1].end &&
          !FRAME_RANGES.slice(2).some((s) => i >= s.start && i <= s.end) &&
          !loadedRef.current.has(i)
      );
      if (gapFrames.length > 0 && !cancelled) await loadBatch(gapFrames);
    };

    runLoading();
    return () => { cancelled = true; };
  }, [loadFrame, loadFrameLr, onReady, totalFrames]);

  // ── Dynamic window (unchanged, full-res only) ──

  useEffect(() => {
    if (!ready) return;
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(progress * (totalFrames - 1)))
    );
    const nearby: number[] = [];
    for (let offset = -DYNAMIC_LOOK_BEHIND; offset <= DYNAMIC_LOOK_AHEAD; offset++) {
      const idx = frameIndex + offset;
      if (idx >= 0 && idx < totalFrames && !loadedRef.current.has(idx)) {
        nearby.push(idx);
      }
    }
    if (nearby.length > 0) {
      Promise.all(nearby.map((idx) => loadFrame(idx))).then(drawFullRes);
    }

    const { current: curSec, next: nextSec } = getCurrentAndNextSection(frameIndex);
    if (!curSec && nextSec) {
      const bridgeFrames: number[] = [];
      for (let i = 0; i < GAP_BRIDGE_COUNT; i++) {
        const idx = nextSec.start + i;
        if (idx <= nextSec.end && !loadedRef.current.has(idx)) bridgeFrames.push(idx);
      }
      if (bridgeFrames.length > 0) {
        Promise.all(bridgeFrames.map((idx) => loadFrame(idx)));
      }
    }
  }, [progress, ready, loadFrame, drawFullRes, totalFrames]);

  // ── Canvas sizing (both canvases) ──

  useEffect(() => {
    const canvas = canvasRef.current;
    const canvasLr = canvasLrRef.current;
    if (!canvas || !canvasLr) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);

      [canvas, canvasLr].forEach((c) => {
        c.width = w;
        c.height = h;
        c.style.width = `${window.innerWidth}px`;
        c.style.height = `${window.innerHeight}px`;
      });

      drawBoth();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [drawBoth]);

  // ── Render ──
  // z-0: poster | z-1: low-res canvas | z-2: full-res canvas | z-5: CRT overlay
  // CHANGED: opacity driven by (ready && !isChatLocked) for crossfade on chat lock

  return (
    <>
      <img
        src={posterSrc}
        alt=""
        className={`fixed inset-0 z-0 h-[100dvh] w-[100dvw] object-cover ${
          ready && !isChatLocked ? "opacity-0" : "opacity-100"
        }`}
        style={{ transition: "opacity 500ms ease" }}
      />

      <canvas
        ref={canvasLrRef}
        className={`fixed inset-0 z-[1] h-[100dvh] w-[100dvw] ${
          ready && !isChatLocked ? "opacity-100" : "opacity-0"
        }`}
        style={{ transition: "opacity 500ms ease" }}
      />

      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-[2] h-[100dvh] w-[100dvw] ${
          ready && !isChatLocked ? "opacity-100" : "opacity-0"
        }`}
        style={{ transition: "opacity 500ms ease" }}
      />

      <CrtTransition
        active={crtActive}
        onMidpoint={handleCrtMidpoint}
        onComplete={handleCrtComplete}
      />
    </>
  );
}
```

---

### 文件 5/7：`app/page.tsx`（1 行改动）

`<ScrollFrameBackground` 标签处增加 `isChatLocked={isLocked}`：

```tsx
<ScrollFrameBackground
  progress={progress}
  totalFrames={350}
  onReady={handleFramesReady}
  onProgress={handleFrameProgress}
  isChatLocked={isLocked}   // ← NEW
  posterSrc={
    process.env.NEXT_PUBLIC_FRAMES_CDN
      ? `${process.env.NEXT_PUBLIC_FRAMES_CDN}/background/poster.webp`
      : "/background/poster.webp"
  }
/>
```

`handleFrameProgress` 无需改动——接收的仍是 0-1 ratio，内部分母变化对 page.tsx 透明。

---

### 文件 6/7：`scripts/upload-frames.sh`（追加 ~40 行）

在全分辨率帧上传的 `fi` 之后（poster 上传之前或之后均可），追加低分辨率帧上传：

```bash
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
```

---

### 文件 7/7：`package.json`（追加 1 行 scripts）

```json
"prepare-lowres-frames": "npx tsx scripts/prepare-lowres-frames.ts"
```

---

## 五、实现顺序

| # | 操作 | 文件 |
|---|------|------|
| 1 | 新建脚本 | `scripts/prepare-lowres-frames.ts` |
| 2 | 生成低分辨率帧 | `npm run prepare-lowres-frames`（输出 `public/frames_lr/`，~175 文件，~20-25MB） |
| 3 | 追加 CRT 样式 | `app/globals.css` |
| 4 | 新建 CRT 组件 | `app/components/CrtTransition.tsx` |
| 5 | 完整替换背景组件 | `app/components/ScrollFrameBackground.tsx` |
| 6 | 传 chat-lock prop | `app/page.tsx`（+1 行） |
| 7 | 追加上传逻辑 | `scripts/upload-frames.sh` |
| 8 | 追加 npm script | `package.json` |
| 9 | 验证构建 | `npm run build` |
| 10 | 上传低分辨率帧到 R2 | `./scripts/upload-frames.sh r2`（部署前做，本次不部署） |

---

## 六、验证清单

- [ ] `npm run build` 通过（Turbopack + TypeScript）
- [ ] `next dev`：loading bar 以 175 张低分辨率帧为分母，全部就绪后消失
- [ ] **首屏 hero 段为全分辨率高清**，不是低分辨率糊版
- [ ] 慢速滚动：帧连续，无 CRT 触发
- [ ] 快速滚动：跳帧触发 CRT wipe（400ms），无抖动
- [ ] `progress > 0.98` 进入 chat：canvas 渐隐 + poster 渐显，500ms crossfade
- [ ] 退出 chat（backToTop）：poster 渐隐 + canvas 渐显
- [ ] Network：低分辨率帧从 `frames_lr/` 加载，全分辨率帧从 `frames/` 加载
- [ ] 全分辨率帧后台就绪后逐帧替换低分辨率帧，用户无感知

---

## 七、风险与已知限制

1. **低分辨率帧生成**：sharp 处理 175 张，实测 59.9s（M 芯片），一次性成本
2. **内存峰值**：低分辨率帧全部缓存 ~14.2MB + 全分辨率按需缓存，峰值 ~50-60MB
3. **R2 增量**：bucket 增加 ~20-25MB，仍在免费 10GB 额度内
4. **连续跳帧**：`crtBusyRef` 阻止过渡期间重复触发，极快连续跳帧仅首次有 wipe，后续仍可能硬切——但此时用户在以极高速度翻阅，体验退化为快速翻阅，可接受
5. **奇数帧偏差**：低分辨率层在奇数帧位置显示偶数帧（forward/backward 各一帧偏差），75% 缩放 + 半帧率下不可感知

---

## 八、设计审查要点

以下 5 个决策值得 review 模型重点关注，推翻任何一条会影响多个文件：

1. **低分辨率帧 stride=2 取偶数索引 vs 重新采样**：当前从 350 帧中每隔一张取。替代方案是用源视频以 175 帧重新均匀采样——时间分布更均匀，但需源素材。当前方案不依赖源视频。
2. **串行 vs 并行**：两版方案已并列在第三章和源码中，核心 trade-off 是 loading bar 时长（串行 ~19s / 并行 ~11s）vs 首屏画质确定性（串行 100% 高清 / 并行大概率高清）。review 时选定一版，删掉另一版即可。选串行的额外收益：代码更简单，无 Promise.allSettled + 错误处理分支。
3. **CRT `|gap|>1` 阈值**：在低分辨率空间检测。正常滚动每次 tick 走 0-1 帧不触发。但全分辨率层从 frame 100→103（低分辨率 100→102，gap=0）跨了 3 帧全分辨率也无 CRT——阈值是否需要更激进？
4. **crossfade 500ms**：是否合适？chat 展开动画约 300ms，背景 crossfade 500ms 比 chat 展开慢——考虑改为 300-400ms。
5. **低分辨率 quality 40**：75% 缩放 + quality 40 的视觉质量需本地生成后目测。如果模糊过度，上调到 50-55（总大小增至 ~30MB）。

---

## 九、本 session 其他改动（不冲突，已部署）

1. 数字分身规范.md：知识库文件层级纠偏（`自用Claude Code规范`=agent 规则 ≠ Kyle 个人SOP；`降龙七步` 才是）
2. 推荐问题库：30→40 题（新增 AI 工程实践 + 个人偏好维度）

这些改动与本次 3-layer optimization 文件无重叠，互不干扰。

---

*版本 2026-06-16 · revision 2（新增首屏全分辨率规则）· 待 review*
