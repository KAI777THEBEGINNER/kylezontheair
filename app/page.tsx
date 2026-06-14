"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import TextContainers from "./components/TextContainers";
import ChatbotOverlay from "./components/ChatbotOverlay";
import Navbar from "./components/Navbar";
import ContactCard from "./components/ContactCard";
import WeChatRedirect from "./components/WeChatRedirect";
import ScrollFrameBackground from "./components/ScrollFrameBackground";
import { useScrollProgress } from "./hooks/useScrollProgress";
import { useOrientationLock } from "./hooks/useOrientationLock";
import { useLang } from "./context/LangContext";
import { NAV_SECTIONS } from "./data/content";

export default function Home() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(scrollContainerRef);
  const { lang, toggleLang } = useLang();
  const { needsRotation } = useOrientationLock();
  const [isLocked, setIsLocked] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [introPhase, setIntroPhase] = useState<"active" | "done">("active");
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingDone, setLoadingDone] = useState(false);

  const completedRef = useRef(false);
  const targetProgressRef = useRef(0);
  const loadStartRef = useRef(0);

  // ── Loading bar: time-driven uniform progress with actual frame load as floor.
  // A steady baseline fills the bar over ~2.8s so motion always looks uniform,
  // while real critical-frame progress ensures it never race ahead of reality.
  // The final 10% is reserved for actual completion. 12s hard ceiling as fallback.
  useEffect(() => {
    loadStartRef.current = performance.now();
    let raf: number;
    const animate = () => {
      const elapsed = performance.now() - loadStartRef.current;
      // Uniform baseline: reach 0.9 in 2.8s regardless of network bursts.
      const timeTarget = Math.min(0.9, elapsed / 2800);
      const actualTarget = targetProgressRef.current;
      const target = completedRef.current
        ? 1
        : Math.min(0.9, Math.max(timeTarget, actualTarget));
      setLoadProgress((prev) => prev + (target - prev) * 0.12);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const forceTimer = setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      targetProgressRef.current = 1;
      setLoadProgress(1);
      setTimeout(() => setLoadingDone(true), 400);
    }, 12000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(forceTimer);
    };
  }, []);

  const handleFrameProgress = useCallback((ratio: number) => {
    if (completedRef.current) return;
    if (ratio >= 1) {
      // All critical frames confirmed: fill the final 10% and finish.
      completedRef.current = true;
      targetProgressRef.current = 1;
      setLoadProgress(1);
      setTimeout(() => setLoadingDone(true), 400);
    } else {
      // Cap visible target at 90% so users know loading is still ongoing.
      targetProgressRef.current = Math.min(0.9, ratio * 0.9);
    }
  }, []);

  const handleFramesReady = useCallback(() => {
    // No-op: loading completion is now driven by handleFrameProgress.
    // This callback is kept so ScrollFrameBackground can signal first-paint readiness.
  }, []);

  // Entrance animation starts after loading is done
  useEffect(() => {
    if (!loadingDone) return;
    const doneTimer = setTimeout(() => setIntroPhase("done"), 700);
    return () => clearTimeout(doneTimer);
  }, [loadingDone]);

  // Lock scroll container during intro, chat-at-bottom, or contact card open
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const locked = !loadingDone || introPhase !== "done" || isLocked || contactOpen;
    el.style.overflow = locked ? "hidden" : "";
    return () => {
      if (el) el.style.overflow = "";
    };
  }, [introPhase, isLocked, contactOpen]);

  // Track whether we've scrolled to the very bottom (chat mode)
  useEffect(() => {
    if (introPhase !== "done") return;
    if (progress > 0.98) {
      if (!isLocked) setIsLocked(true);
    } else {
      if (isLocked) setIsLocked(false);
    }
  }, [progress > 0.98, isLocked, introPhase]); // eslint-disable-line

  // Preload embedding model during scroll so it's ready when user starts chatting
  const warmupFired = useRef(false);
  useEffect(() => {
    if (warmupFired.current || progress < 0.5) return;
    warmupFired.current = true;
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warmup: true }),
    }).catch(() => {
      // Warmup is best-effort; failures are silent
    });
  }, [progress]);

  const backToTop = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
    setIsLocked(false);
  }, []);

  const scrollToProgress = useCallback((targetProgress: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const sh = el.scrollHeight - el.clientHeight;
    el.scrollTo({ top: targetProgress * sh, behavior: "smooth" });
  }, []);

  return (
    <main className="relative h-[100dvh] overflow-hidden">
      {/* ── WeChat in-app browser redirect ── */}
      <WeChatRedirect />

      {/* ── Layer 1: Scroll-driven frame background ── */}
      <ScrollFrameBackground
        progress={progress}
        totalFrames={350}
        onReady={handleFramesReady}
        onProgress={handleFrameProgress}
        posterSrc="/background/poster.webp"
      />

      {/* ── Layer 1.5: Loading bar (black screen + thin white line) ── */}
      <div
        className={`fixed inset-0 z-[200] bg-black flex items-center justify-center transition-opacity duration-500 ${
          loadingDone ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
        }`}
      >
        <div className="relative w-[160px] md:w-[200px] h-[2px] rounded-full bg-[#444] overflow-hidden">
          <div
            className="animate-loading-fill"
            style={{ width: `${loadProgress * 100}%`, transition: "width 150ms ease-out" }}
          />
        </div>
      </div>

      {/* ── Mobile landscape rotate prompt ── */}
      {needsRotation && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center px-8 text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-4 animate-pulse"
          >
            <rect x="6" y="2" width="12" height="20" rx="4" />
            <path d="M12 18h.01" />
          </svg>
          <p className="text-white text-[18px] font-bold">
            {lang === "zh" ? "请竖屏浏览" : "Please rotate your device"}
          </p>
          <p className="text-white/60 text-[14px] mt-2">
            {lang === "zh" ? "将手机转回竖屏以获得最佳体验" : "Rotate back to portrait for the best experience"}
          </p>
        </div>
      )}

      {/* ── Layer 2a: Black intro overlay (fades out over 0.7s) ── */}
      <div
        className={`
          fixed inset-0 z-[5] pointer-events-none
          bg-black transition-opacity duration-[700ms]
          ${introPhase === "done" ? "opacity-0" : "opacity-100"}
        `}
        style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      />

      {/* ── Layer 2b: Gaussian blur overlay (fades out over 1.2s, outlasts black) ── */}
      <div
        className={`
          fixed inset-0 z-[6] pointer-events-none
          transition-opacity duration-[1200ms]
          ${introPhase === "done" ? "opacity-0" : "opacity-100"}
        `}
        style={{
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      />

      {/* ── Layer 3: Content sections (progress-driven, bilingual) ── */}
      <TextContainers progress={progress} lang={lang} introActive={introPhase === "active"} />

      {/* ── Layer 4: Navbar ── */}
      <Navbar
        sections={NAV_SECTIONS(lang)}
        lang={lang}
        onToggleLang={toggleLang}
        onContact={() => setContactOpen(prev => !prev)}
        contactOpen={contactOpen}
        onScrollTo={scrollToProgress}
      />

      {/* Contact card overlay */}
      <ContactCard open={contactOpen} onClose={() => setContactOpen(false)} lang={lang} />

      {/* ── Layer 5: Chatbot — fades in at 28s ── */}
      <div
        className="fixed top-0 left-0 z-[999] opacity-0 pointer-events-none"
        data-scroll-progress={progress.toFixed(4)}
        style={{ fontSize: "11px", fontFamily: "monospace", padding: "2px 4px" }}
      >
        {(progress * 100).toFixed(1)}%
      </div>

      <ChatbotOverlay
        progress={progress}
        lang={lang}
        onBackToTop={backToTop}
        isLocked={isLocked}
      />

      {/* ── Layer 6: Scroll container drives progress ── */}
      <div
        ref={scrollContainerRef}
        className="fixed inset-0 z-10 overflow-y-auto no-scrollbar"
      >
        {/* Scroll spacer: 400vh of scrollable distance */}
        <div className="h-[400vh] w-full" />
      </div>
    </main>
  );
}
