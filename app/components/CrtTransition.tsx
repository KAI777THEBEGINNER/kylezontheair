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
