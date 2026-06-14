"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export function useScrollProgress(containerRef?: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef?.current;
    const target = el || window;

    const handleScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = el
          ? el.scrollTop
          : window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = el
          ? el.scrollHeight - el.clientHeight
          : document.documentElement.scrollHeight - window.innerHeight;
        const p = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
        setProgress(Math.min(1, Math.max(0, p)));
        rafRef.current = 0;
      });
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      target.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  return progress;
}
