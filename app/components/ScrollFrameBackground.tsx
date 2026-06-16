"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface Props {
  progress: number;
  totalFrames?: number;
  onReady?: () => void;
  onProgress?: (ratio: number) => void;
  posterSrc?: string;
  isChatLocked?: boolean;
}

const TOTAL_FRAMES_DEFAULT = 350;

const FRAMES_CDN = process.env.NEXT_PUBLIC_FRAMES_CDN || "";

// Frame ranges aligned with section progress ranges in content.ts
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

function frameLrPath(index: number): string {
  const filename = `frame_lr_${String(index + 1).padStart(4, "0")}.avif`;
  return FRAMES_CDN ? `${FRAMES_CDN}/frames_lr/${filename}` : `/frames_lr/${filename}`;
}

function getNearestLowResIndex(frameIndex: number, totalFrames: number): number {
  if (frameIndex % 2 === 0) return frameIndex;
  const lower = frameIndex - 1;
  const upper = frameIndex + 1;
  if (upper < totalFrames) return upper; // prefer forward
  return lower;
}

// ── Section / keyframe helpers ──

function getCurrentAndNextSection(frameIndex: number) {
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
    if ((idx - base) % stride === 0) keyframes.push(idx);
    else fillFrames.push(idx);
  }
  return [...keyframes, ...fillFrames];
}

// ── Cover-fit draw helper ──

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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Low-res images
  const imagesLrRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedLrRef = useRef<Set<number>>(new Set());

  // Full-res images
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedRef = useRef<Set<number>>(new Set());

  const [ready, setReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const currentProgressRef = useRef(progress);
  const rafRef = useRef<number | null>(null);

  currentProgressRef.current = progress;
  const lowResTotal = Math.ceil(totalFrames / 2); // 175

  // ── Frame loaders ──

  const loadFrameLr = useCallback(
    (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (loadedLrRef.current.has(index)) {
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

  const loadFrame = useCallback((index: number): Promise<void> => {
    return new Promise((resolve) => {
      if (loadedRef.current.has(index)) {
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
  }, []);

  // ── Draw: prefer full-res, fall back to nearest low-res ──

  const drawFrame = useCallback(
    (frameIndex: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Full-res available → draw it
      const fullImg = imagesRef.current.get(frameIndex);
      if (fullImg && fullImg.complete && fullImg.naturalWidth > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCover(ctx, fullImg, canvas);
        return;
      }

      // Fall back to low-res (nearest even index)
      const lrIndex = getNearestLowResIndex(frameIndex, totalFrames);
      let bestImg: HTMLImageElement | null =
        imagesLrRef.current.get(lrIndex) ?? null;

      // If exact low-res not loaded, find nearest available
      if (!bestImg || !bestImg.complete || bestImg.naturalWidth === 0) {
        let nearest = -1;
        let minDist = Infinity;
        imagesLrRef.current.forEach((img, key) => {
          if (img.complete && img.naturalWidth > 0) {
            const dist = Math.abs(key - lrIndex);
            if (dist < minDist) {
              minDist = dist;
              nearest = key;
            }
          }
        });
        bestImg = nearest >= 0 ? imagesLrRef.current.get(nearest)! : null;
      }

      if (bestImg) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCover(ctx, bestImg, canvas);
      }
    },
    [totalFrames]
  );

  const draw = useCallback(() => {
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(currentProgressRef.current * (totalFrames - 1)))
    );
    drawFrame(frameIndex);
  }, [totalFrames, drawFrame]);

  // ── RAF loop: redraw on every progress change ──

  useEffect(() => {
    if (!ready) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (isChatLocked) {
      // Freeze at last frame (full-res guaranteed by dedicated preload)
      drawFrame(totalFrames - 1);
      return;
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progress, ready, draw, drawFrame, isChatLocked, totalFrames]);

  // ── Chat lock: guarantee full-res last frame ──

  useEffect(() => {
    if (!ready || !isChatLocked) return;
    const lastIndex = totalFrames - 1;
    if (loadedRef.current.has(lastIndex)) {
      drawFrame(lastIndex);
    } else {
      loadFrame(lastIndex).then(() => drawFrame(lastIndex));
    }
  }, [isChatLocked, ready, totalFrames, loadFrame, drawFrame]);

  // ── Progress reporting ──

  useEffect(() => {
    onProgress?.(loadProgress);
  }, [loadProgress, onProgress]);

  // ── Loading: low-res + hero/last full-res in parallel → ready → remaining full-res ──

  useEffect(() => {
    let cancelled = false;
    const BATCH_SIZE = 12;

    const allLrIndices: number[] = [];
    for (let i = 0; i < totalFrames; i += 2) allLrIndices.push(i);

    const loadBatchLr = async (indices: number[]) => {
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

      // Phase 0: kick off hero + last frame full-res in background (don't block)
      const heroFrames = all.slice(FRAME_RANGES[0].start, FRAME_RANGES[0].end + 1);
      const heroLoad = loadBatch(heroFrames);
      const lastFrameLoad = loadBatch([totalFrames - 1]);

      // Phase 1: all low-res → ready (critical path, ~8MB, fast)
      await loadBatchLr(allLrIndices);
      if (cancelled) return;
      setReady(true);
      onReady?.();

      // Wait for hero + last frame full-res (likely already done by now)
      await Promise.all([heroLoad, lastFrameLoad]);
      if (cancelled) return;

      // Phase 2: background load remaining full-res (section-prioritized)
      for (const section of FRAME_RANGES.slice(1)) {
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
          !FRAME_RANGES.some((s) => i >= s.start && i <= s.end) &&
          !loadedRef.current.has(i)
      );
      if (gapFrames.length > 0 && !cancelled) await loadBatch(gapFrames);
    };

    runLoading();
    return () => {
      cancelled = true;
    };
  }, [loadFrame, loadFrameLr, onReady, totalFrames]);

  // ── Dynamic window (full-res preload near current scroll position) ──

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
      Promise.all(nearby.map((idx) => loadFrame(idx))).then(draw);
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
  }, [progress, ready, loadFrame, draw, totalFrames]);

  // ── Canvas sizing ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  // ── Render ──
  // Poster shows until ready, then single canvas takes over.
  // Chat lock: canvas freezes at last frame (not poster).

  return (
    <>
      <img
        src={posterSrc}
        alt=""
        className={`fixed inset-0 z-0 h-[100dvh] w-[100dvw] object-cover ${
          ready ? "opacity-0" : "opacity-100"
        }`}
        style={{ transition: "opacity 300ms ease" }}
      />

      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-[1] h-[100dvh] w-[100dvw] ${
          ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ transition: "opacity 300ms ease" }}
      />
    </>
  );
}
