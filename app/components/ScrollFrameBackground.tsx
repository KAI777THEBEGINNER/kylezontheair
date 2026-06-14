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

function framePath(index: number): string {
  return `/frames/frame_${String(index + 1).padStart(4, "0")}.avif`;
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

      // 3. Background load remaining frames.
      await loadBatch(restFrames);
    };

    runLoading();

    return () => {
      cancelled = true;
    };
  }, [loadFrame, onReady, totalFrames, heroRange, nextRange]);

  // Dynamic loading: ensure frames around current progress are loaded
  useEffect(() => {
    if (!ready) return;
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(progress * (totalFrames - 1)))
    );
    const nearby: number[] = [];
    for (let offset = -8; offset <= 12; offset++) {
      const idx = frameIndex + offset;
      if (idx >= 0 && idx < totalFrames && !loadedRef.current.has(idx)) {
        nearby.push(idx);
      }
    }
    if (nearby.length > 0) {
      Promise.all(nearby.map(loadFrame)).then(draw);
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
