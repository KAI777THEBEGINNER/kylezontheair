"use client";

import { useEffect, useState } from "react";

/**
 * Detect mobile devices and, when possible, lock orientation to portrait.
 * Returns a flag indicating whether the user needs to rotate their device
 * (mobile + landscape + lock unavailable or failed).
 */
export function useOrientationLock(): { needsRotation: boolean } {
  const [needsRotation, setNeedsRotation] = useState(false);

  useEffect(() => {
    // Avoid running on server.
    if (typeof window === "undefined") return;

    const isMobile =
      /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      ("maxTouchPoints" in navigator && navigator.maxTouchPoints > 1);

    if (!isMobile) {
      setNeedsRotation(false);
      return;
    }

    const checkOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setNeedsRotation(isLandscape);
    };

    // Try to lock portrait on supported browsers (Android Chrome, etc.).
    const lockOrientation = async () => {
      try {
        const screenOrientation = (screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
        if (screenOrientation?.lock) {
          await screenOrientation.lock("portrait");
          setNeedsRotation(false);
        } else {
          checkOrientation();
        }
      } catch {
        // Lock failed or unsupported; fall back to prompt.
        checkOrientation();
      }
    };

    lockOrientation();

    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  return { needsRotation };
}
