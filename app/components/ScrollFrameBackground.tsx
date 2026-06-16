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
const FRAME_LOAD_TIMEOUT = 3000; // ms — per-frame timeout to prevent stuck batches

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
  const [lrDone, setLrDone] = useState(false); // all low-res loaded
  const [loadProgress, setLoadProgress] = useState(0);
  const currentProgressRef = useRef(progress);
  const rafRef = useRef<number | null>(null);
  const readyAnnouncedRef = useRef(false);

  currentProgressRef.current = progress;

  // Total items for progress tracking: low-res + full-res
  const totalLoadItems = Math.ceil(totalFrames / 2) + totalFrames; // 175 + 350 = 525

  // Idempotent ready announcer
  const announceReady = useCallback(() => {
    if (readyAnnouncedRef.current) return;
    readyAnnouncedRef.current = true;
    setReady(true);
    onReady?.();
  }, [onReady]);

  // ── Frame loaders (with per-frame timeout + double-load protection) ──

  const loadFrameLr = useCallback(
    (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (loadedLrRef.current.has(index)) { resolve(); return; }

        let settled = false;
        const settle = (ok: boolean) => {
          if (settled) return;
          settled = true;
          if (loadedLrRef.current.has(index)) { resolve(); return; }
          loadedLrRef.current.add(index);
          if (ok) imagesLrRef.current.set(index, img);
          setLoadProgress((p) => Math.min(1, p + 1 / totalLoadItems));
          resolve();
        };

        const img = new Image();
        img.decoding = "async";
        img.src = frameLrPath(index);
        img.onload = () => settle(true);
        img.onerror = () => settle(false);
        setTimeout(() => settle(false), FRAME_LOAD_TIMEOUT);
      });
    },
    [totalLoadItems]
  );

  const loadFrame = useCallback(
    (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (loadedRef.current.has(index)) { resolve(); return; }

        let settled = false;
        const settle = (ok: boolean) => {
          if (settled) return;
          settled = true;
          if (loadedRef.current.has(index)) { resolve(); return; }
          loadedRef.current.add(index);
          if (ok) imagesRef.current.set(index, img);
          setLoadProgress((p) => Math.min(1, p + 1 / totalLoadItems));
          resolve();
        };

        const img = new Image();
        img.decoding = "async";
        img.src = framePath(index);
        img.onload = () => settle(true);
        img.onerror = () => settle(false);
        setTimeout(() => settle(false), FRAME_LOAD_TIMEOUT);
      });
    },
    [totalLoadItems]
  );

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

    // Try full-res first
    if (loadedRef.current.has(lastIndex)) {
      drawFrame(lastIndex);
      return;
    }

    // Ensure low-res last frame is available
    const lrIndex = getNearestLowResIndex(lastIndex, totalFrames);
    const hasLr =
      imagesLrRef.current.has(lrIndex) &&
      imagesLrRef.current.get(lrIndex)!.complete &&
      imagesLrRef.current.get(lrIndex)!.naturalWidth > 0;

    if (hasLr) {
      drawFrame(lastIndex);
      // Load full-res in background for upgrade
      loadFrame(lastIndex).then(() => drawFrame(lastIndex));
    } else {
      // Load low-res last frame first, then try full-res
      loadFrameLr(lrIndex).then(() => {
        drawFrame(lastIndex);
        loadFrame(lastIndex).then(() => drawFrame(lastIndex));
      });
    }
  }, [isChatLocked, ready, totalFrames, loadFrame, loadFrameLr, drawFrame]);

  // ── Progress reporting ──

  useEffect(() => {
    onProgress?.(loadProgress);
  }, [loadProgress, onProgress]);

  // ── Loading: low-res first → hero+last full-res → remaining full-res ──

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

      // Phase 1: ALL low-res FIRST — no full-res competition for bandwidth
      await loadBatchLr(allLrIndices);
      if (cancelled) return;

      // All low-res loaded → canvas can draw every frame smoothly
      setLrDone(true);
      announceReady();

      // Phase 2: hero + last frame full-res (high priority for first screen + chat lock)
      const heroFrames = all.slice(FRAME_RANGES[0].start, FRAME_RANGES[0].end + 1);
      const priorityFullRes = [...new Set([...heroFrames, totalFrames - 1])];
      await loadBatch(priorityFullRes);
      if (cancelled) return;

      // Phase 3: remaining full-res (section-prioritized)
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
  }, [loadFrame, loadFrameLr, announceReady, totalFrames]);

  // ── Fallback: force ready if loading stalls ──

  useEffect(() => {
    const timer = setTimeout(announceReady, 12000);
    return () => clearTimeout(timer);
  }, [announceReady]);

  // ── Dynamic window: full-res preload near current scroll position ──
  // Only active after all low-res frames are loaded (no bandwidth competition)

  useEffect(() => {
    if (!ready || !lrDone) return;
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
  }, [progress, ready, lrDone, loadFrame, draw, totalFrames]);

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
