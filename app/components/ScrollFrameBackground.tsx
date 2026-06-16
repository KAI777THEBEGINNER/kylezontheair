"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import CrtTransition from "./CrtTransition";

interface Props {
  progress: number;
  totalFrames?: number;
  onReady?: () => void;
  onProgress?: (ratio: number) => void;
  posterSrc?: string;
  isChatLocked?: boolean;
}

const TOTAL_FRAMES_DEFAULT = 350;

// CDN base URL for frame files — set NEXT_PUBLIC_FRAMES_CDN in Vercel env.
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
  // Full-res canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedRef = useRef<Set<number>>(new Set());

  // Low-res canvas
  const canvasLrRef = useRef<HTMLCanvasElement>(null);
  const imagesLrRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedLrRef = useRef<Set<number>>(new Set());

  const [ready, setReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const currentProgressRef = useRef(progress);
  const rafRef = useRef<number | null>(null);

  // CRT state
  const lastFrameRef = useRef<number>(0);
  const [crtActive, setCrtActive] = useState(false);
  const crtBusyRef = useRef(false);
  const pendingFrameRef = useRef<number | null>(null);

  currentProgressRef.current = progress;
  const lowResTotal = Math.ceil(totalFrames / 2); // 175

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

  // ── Low-res frame loader ──

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
        if (dist < minDist) {
          minDist = dist;
          nearest = key;
        }
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
      if (!isChatLocked) {
        const frameIndex = Math.min(
          totalFrames - 1,
          Math.max(0, Math.round(currentProgressRef.current * (totalFrames - 1)))
        );

        const frameGap = Math.abs(frameIndex - lastFrameRef.current);
        if (frameGap > 1 && !crtBusyRef.current) {
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
  }, [progress, ready, drawBoth, isChatLocked, totalFrames]);

  // ── CRT callbacks ──

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

  // ── Initial loading (SERIAL: hero full-res → low-res → remaining full-res) ──

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
      const heroFrames = all.slice(FRAME_RANGES[0].start, FRAME_RANGES[0].end + 1);

      // Phase 0: hero full-res first → first screen guaranteed sharp
      await loadBatch(heroFrames);
      if (cancelled) return;

      // Phase 1: all low-res → onReady when complete
      await loadBatchLr(allLrIndices);
      if (cancelled) return;
      setReady(true);
      onReady?.();

      // Phase 2: background load remaining full-res (entrepreneurship → other sections → gap fill)
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
    return () => {
      cancelled = true;
    };
  }, [loadFrame, loadFrameLr, onReady, totalFrames]);

  // ── Dynamic window (full-res only) ──

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
  // Chat lock: canvas crossfade out, poster crossfade in (350ms)

  return (
    <>
      <img
        src={posterSrc}
        alt=""
        className={`fixed inset-0 z-0 h-[100dvh] w-[100dvw] object-cover ${
          ready && !isChatLocked ? "opacity-0" : "opacity-100"
        }`}
        style={{ transition: "opacity 350ms ease" }}
      />

      <canvas
        ref={canvasLrRef}
        className={`fixed inset-0 z-[1] h-[100dvh] w-[100dvw] ${
          ready && !isChatLocked ? "opacity-100" : "opacity-0"
        }`}
        style={{ transition: "opacity 350ms ease" }}
      />

      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-[2] h-[100dvh] w-[100dvw] ${
          ready && !isChatLocked ? "opacity-100" : "opacity-0"
        }`}
        style={{ transition: "opacity 350ms ease" }}
      />

      <CrtTransition
        active={crtActive}
        onMidpoint={handleCrtMidpoint}
        onComplete={handleCrtComplete}
      />
    </>
  );
}
