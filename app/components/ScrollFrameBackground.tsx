"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface Props {
  progress: number;
  totalFrames?: number;
  onReady?: () => void;
  onProgress?: (ratio: number) => void;
  posterSrc?: string;
}

const TOTAL_FRAMES_DEFAULT = 350;

// Frame ranges aligned with section progress ranges in content.ts
const FRAME_RANGES = [
  { id: "hero", start: 0, end: 24 },
  { id: "entrepreneurship", start: 49, end: 98 },
  { id: "internship", start: 121, end: 174 },
  { id: "education", start: 215, end: 245 },
  { id: "bridge", start: 286, end: 324 },
];

const KEYFRAME_STRIDE = 3; // Load every Nth frame first, then backfill
const DYNAMIC_LOOK_BEHIND = 15; // Frames behind current position to keep loaded
const DYNAMIC_LOOK_AHEAD = 45; // Frames ahead to preload proactively
const GAP_BRIDGE_COUNT = 10; // Frames to preload at start of next section when in a gap

function framePath(index: number): string {
  return `/frames/frame_${String(index + 1).padStart(4, "0")}.avif`;
}

/** Find which section (if any) the frame index falls in, plus the next section */
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
    // In a gap before the next section
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

/** Reorder frame indices so keyframes (every Nth) come first, then fill frames */
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

export default function ScrollFrameBackground({
  progress,
  totalFrames = TOTAL_FRAMES_DEFAULT,
  onReady,
  onProgress,
  posterSrc = "/background/poster.webp",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const loadedRef = useRef<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [criticalProgress, setCriticalProgress] = useState(0);
  const currentProgressRef = useRef(progress);
  const rafRef = useRef<number | null>(null);

  currentProgressRef.current = progress;

  const heroRange = FRAME_RANGES[0];
  const nextRange = FRAME_RANGES[1];
  const criticalTotal =
    heroRange.end - heroRange.start + 1 + (nextRange.end - nextRange.start + 1);

  const isCritical = useCallback(
    (index: number) =>
      (index >= heroRange.start && index <= heroRange.end) ||
      (index >= nextRange.start && index <= nextRange.end),
    [heroRange, nextRange]
  );

  // Load a single frame image
  const loadFrame = useCallback((index: number): Promise<void> => {
    return new Promise((resolve) => {
      if (loadedRef.current.has(index) || imagesRef.current.has(index)) {
        if (isCritical(index)) {
          setCriticalProgress((p) => Math.min(1, p + 1 / criticalTotal));
        }
        resolve();
        return;
      }
      const img = new Image();
      img.decoding = "async";
      img.src = framePath(index);
      img.onload = () => {
        loadedRef.current.add(index);
        imagesRef.current.set(index, img);
        if (isCritical(index)) {
          setCriticalProgress((p) => Math.min(1, p + 1 / criticalTotal));
        }
        resolve();
      };
      img.onerror = () => {
        // Mark as attempted so we don't retry immediately
        loadedRef.current.add(index);
        if (isCritical(index)) {
          setCriticalProgress((p) => Math.min(1, p + 1 / criticalTotal));
        }
        resolve();
      };
    });
  }, [criticalTotal, isCritical]);

  // Draw current frame to canvas with cover behavior
  const draw = useCallback(() => {
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
    } else {
      // Try nearest loaded frame for smoother fallback
      let nearest = -1;
      let minDist = Infinity;
      imagesRef.current.forEach((_, key) => {
        const dist = Math.abs(key - frameIndex);
        if (dist < minDist) {
          minDist = dist;
          nearest = key;
        }
      });
      const nearestImg = nearest >= 0 ? imagesRef.current.get(nearest) : null;
      if (nearestImg && nearestImg.complete && nearestImg.naturalWidth > 0) {
        const cw = canvas.width;
        const ch = canvas.height;
        const imgAspect = nearestImg.naturalWidth / nearestImg.naturalHeight;
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
        ctx.drawImage(nearestImg, drawX, drawY, drawW, drawH);
      }
    }
  }, [totalFrames]);

  // Sync scroll progress to frame draw
  useEffect(() => {
    if (!ready) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      draw();
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progress, ready, draw]);

  // Report critical-frame loading progress to parent
  useEffect(() => {
    onProgress?.(criticalProgress);
  }, [criticalProgress, onProgress]);

  // Initial prioritized loading: hero section first, then entrepreneurship, then rest.
  // Hero frames unlock first paint; entrepreneurship frames must be ready before
  // the user can scroll smoothly into the second section.
  useEffect(() => {
    let cancelled = false;
    const BATCH_SIZE = 12;

    const all = Array.from({ length: totalFrames }, (_, i) => i);
    const heroFrames = all.slice(heroRange.start, heroRange.end + 1);
    const nextFrames = all.slice(nextRange.start, nextRange.end + 1);
    const restFrames = all.filter((i) => !heroFrames.includes(i) && !nextFrames.includes(i));

    const loadBatch = async (indices: number[]) => {
      for (let i = 0; i < indices.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = indices.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(loadFrame));
      }
    };

    const runLoading = async () => {
      // 1. Hero frames: get the first paint correct as fast as possible.
      await loadBatch(heroFrames);
      if (!cancelled) {
        setReady(true);
        onReady?.();
      }

      // 2. Entrepreneurship section: must be ready before first scroll.
      await loadBatch(nextFrames);

      // 3. Background load by section priority with keyframe-first ordering.
      //    Sections beyond hero/entrepreneurship load every Nth frame first
      //    so the background animates immediately, then backfills detail frames.
      const remainingSections = FRAME_RANGES.slice(2); // internship, education, bridge
      for (const section of remainingSections) {
        if (cancelled) return;
        const sectionFrames = Array.from(
          { length: section.end - section.start + 1 },
          (_, i) => section.start + i
        );
        const ordered = getKeyframePriority(sectionFrames, KEYFRAME_STRIDE);
        await loadBatch(ordered);
      }
      // Then backfill any gap frames between sections that aren't loaded yet
      const gapFrames = all.filter(
        (i) =>
          i > nextRange.end &&
          !FRAME_RANGES.slice(2).some((s) => i >= s.start && i <= s.end) &&
          !loadedRef.current.has(i)
      );
      if (gapFrames.length > 0 && !cancelled) {
        await loadBatch(gapFrames);
      }
    };

    runLoading();

    return () => {
      cancelled = true;
    };
  }, [loadFrame, onReady, totalFrames, heroRange, nextRange]);

  // Dynamic loading: ensure frames around current progress are loaded.
  // Uses a wide forward-biased window so the background never catches up to
  // a user scrolling at normal speed, even on slow connections.
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
      Promise.all(nearby.map(loadFrame)).then(draw);
    }

    // Gap bridging: when scrolling through a gap between sections,
    // immediately preload the first N frames of the next section so the
    // user never arrives at a section with zero frames loaded.
    const { current: curSec, next: nextSec } = getCurrentAndNextSection(frameIndex);
    if (!curSec && nextSec) {
      const bridgeFrames: number[] = [];
      for (let i = 0; i < GAP_BRIDGE_COUNT; i++) {
        const idx = nextSec.start + i;
        if (idx <= nextSec.end && !loadedRef.current.has(idx)) {
          bridgeFrames.push(idx);
        }
      }
      if (bridgeFrames.length > 0) {
        Promise.all(bridgeFrames.map(loadFrame));
      }
    }
  }, [progress, ready, loadFrame, draw, totalFrames]);

  // Canvas sizing with DPR
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  return (
    <>
      {/* Poster image shown while canvas not ready */}
      {!ready && (
        <img
          src={posterSrc}
          alt=""
          className="fixed inset-0 z-0 h-[100dvh] w-[100dvw] object-cover"
        />
      )}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-0 h-[100dvh] w-[100dvw] object-cover ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ transition: "opacity 300ms ease" }}
      />
    </>
  );
}
