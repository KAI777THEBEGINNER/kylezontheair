"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { renderAscii, type AsciiParams } from "../engines/ascii";

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
const FRAME_LOAD_TIMEOUT = 3000;
const MIN_FRAMES_FOR_READY = 24;

// Lower resolution = larger characters in CSS pixels; crisp-edges keeps them sharp
const ASCII_MAX_DIM = 800;

// ── ASCII configuration from nano-design ──
const ASCII_PARAMS: AsciiParams = {
  charSet: "classic",
  customChars: "Ñ@#W$9876543210?!abc;:+=-,._ ",
  fontSize: 7,
  coverage: 100,
  edgeEmphasis: 100,
  bgColor: "#000000",
  bgBlur: 5,
  bgOpacity: 34,
  charOpacity: 76,
  charBrightness: 0,
  charContrast: -11,
  invert: true,
  dotGrid: true,
  animated: false,
  animSpeed: 1.5,
  animIntensity: 60,
  animRandomness: 50,
  colorTint: "#ff6600",
  colorTintOpacity: 0,
  colorTintBlend: "multiply",
};

// ── Path helpers ──

function framePath(index: number): string {
  const filename = `frame_${String(index + 1).padStart(4, "0")}.avif`;
  return FRAMES_CDN
    ? `${FRAMES_CDN}/frames_no_ascii/${filename}`
    : `/frames_no_ascii/${filename}`;
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
  img: HTMLImageElement | HTMLCanvasElement,
  cw: number,
  ch: number
) {
  const imgW = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth;
  const imgH = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight;
  const imgAspect = imgW / imgH;
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
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedRef = useRef<Set<number>>(new Set());

  const [ready, setReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const currentProgressRef = useRef(progress);
  const lastFrameIndexRef = useRef<number>(-1);
  const readyAnnouncedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  // Ref to break circular dep: announceReady needs drawFrame, defined later
  const drawFrameRef = useRef<(idx: number) => void>(() => {});

  currentProgressRef.current = progress;

  const totalLoadItems = totalFrames;

  // Idempotent ready announcer — draws first frame synchronously
  // so the canvas has content BEFORE the opacity transition starts
  const announceReady = useCallback(() => {
    if (readyAnnouncedRef.current) return;
    readyAnnouncedRef.current = true;
    // Synchronously render first frame so canvas isn't blank when it fades in
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(currentProgressRef.current * (totalFrames - 1)))
    );
    drawFrameRef.current(frameIndex);
    setReady(true);
    onReady?.();
  }, [onReady, totalFrames]);

  // ── Frame loader ──

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

  // ── Draw: render ASCII on canvas using frame image as source ──

  const drawFrame = useCallback(
    (frameIndex: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Skip re-rendering if frame hasn't changed AND previous draw succeeded
      if (frameIndex === lastFrameIndexRef.current) return;

      // Find the best available frame image
      const exact = imagesRef.current.get(frameIndex);
      let bestImg: HTMLImageElement | null = null;

      if (exact && exact.complete && exact.naturalWidth > 0) {
        bestImg = exact;
      } else {
        // Fall back to nearest available
        let nearest = -1;
        let minDist = Infinity;
        imagesRef.current.forEach((img, key) => {
          if (img.complete && img.naturalWidth > 0) {
            const dist = Math.abs(key - frameIndex);
            if (dist < minDist) {
              minDist = dist;
              nearest = key;
            }
          }
        });
        bestImg = nearest >= 0 ? imagesRef.current.get(nearest)! : null;
      }

      if (!bestImg) return;

      // Only mark frame as drawn AFTER confirming we have an image to render
      lastFrameIndexRef.current = frameIndex;

      // Ensure offscreen canvas exists and matches current canvas size
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement("canvas");
      }
      const offscreen = offscreenRef.current;
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext("2d")!;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      drawCover(offCtx, bestImg, offscreen.width, offscreen.height);

      // Render real-time ASCII effect on the visible canvas
      renderAscii(ctx, offscreen, ASCII_PARAMS, canvas.width, canvas.height);
    },
    []
  );

  // Keep ref in sync so announceReady can call it
  drawFrameRef.current = drawFrame;

  const draw = useCallback(() => {
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(currentProgressRef.current * (totalFrames - 1)))
    );
    drawFrame(frameIndex);
  }, [totalFrames, drawFrame]);

  // ── RAF loop: redraw on progress change ──

  useEffect(() => {
    if (!ready) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (isChatLocked) {
      lastFrameIndexRef.current = -1; // Force re-render for chat lock frame
      drawFrame(totalFrames - 1);
      return;
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progress, ready, draw, drawFrame, isChatLocked, totalFrames]);

  // ── Chat lock: guarantee last frame ──

  useEffect(() => {
    if (!ready || !isChatLocked) return;
    const lastIndex = totalFrames - 1;

    if (loadedRef.current.has(lastIndex)) {
      lastFrameIndexRef.current = -1;
      drawFrame(lastIndex);
      return;
    }

    loadFrame(lastIndex).then(() => {
      lastFrameIndexRef.current = -1;
      drawFrame(lastIndex);
    });
  }, [isChatLocked, ready, totalFrames, loadFrame, drawFrame]);

  // ── Progress reporting ──

  useEffect(() => {
    onProgress?.(loadProgress);
  }, [loadProgress, onProgress]);

  // ── Loading: hero first → sections → gaps (no low-res tier needed) ──

  useEffect(() => {
    let cancelled = false;
    const BATCH_SIZE = 12;
    const all = Array.from({ length: totalFrames }, (_, i) => i);

    const loadBatch = async (indices: number[]) => {
      for (let i = 0; i < indices.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = indices.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((idx) => loadFrame(idx)));
      }
    };

    const runLoading = async () => {
      // Phase 1: hero + last frame (highest priority for first screen + chat lock)
      const heroFrames = all.slice(FRAME_RANGES[0].start, FRAME_RANGES[0].end + 1);
      const priorityFrames = [...new Set([...heroFrames, totalFrames - 1])];
      await loadBatch(priorityFrames);
      if (cancelled) return;
      announceReady();

      // Phase 2: remaining sections (keyframe-prioritized)
      for (const section of FRAME_RANGES.slice(1)) {
        if (cancelled) return;
        const sectionFrames = Array.from(
          { length: section.end - section.start + 1 },
          (_, i) => section.start + i
        );
        const ordered = getKeyframePriority(sectionFrames, KEYFRAME_STRIDE);
        await loadBatch(ordered);
      }
      if (cancelled) return;

      // Phase 3: gap frames between sections
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
  }, [loadFrame, announceReady, totalFrames]);

  // ── Fallback: force ready if loading stalls ──

  useEffect(() => {
    const timer = setTimeout(announceReady, 12000);
    return () => clearTimeout(timer);
  }, [announceReady]);

  // ── Dynamic window: preload near current scroll position ──

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

  // ── Canvas sizing (capped resolution for ASCII performance) ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const maxDim = Math.max(vw, vh);
      const scale = maxDim > ASCII_MAX_DIM ? ASCII_MAX_DIM / maxDim : 1;
      canvas.width = Math.floor(vw * scale);
      canvas.height = Math.floor(vh * scale);
      // Reset frame index to force re-render at new size
      lastFrameIndexRef.current = -1;
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
        style={{ transition: "opacity 300ms ease", imageRendering: "crisp-edges" }}
      />

    </>
  );
}
