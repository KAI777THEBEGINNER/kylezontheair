"use client";

import { useState, useEffect } from "react";
import type { Lang } from "@/app/data/content";
import { content } from "@/app/data/content";

interface NavSection {
  id: string;
  label: string;
  progress: number;
}

const GITHUB_STARS_URL = "https://github.com/KAI777THEBEGINNER?tab=stars";

interface Props {
  sections: NavSection[];
  lang: Lang;
  onToggleLang: () => void;
  onContact?: () => void;
  contactOpen?: boolean;
  onScrollTo?: (progress: number) => void;
}

export default function Navbar({ sections, lang, onToggleLang, onContact, contactOpen, onScrollTo }: Props) {
  const [gitHubToast, setGitHubToast] = useState(false);

  const scrollTo = (targetProgress: number) => {
    if (onScrollTo) {
      onScrollTo(targetProgress);
      return;
    }
    const sh = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: targetProgress * sh, behavior: "smooth" });
  };

  const scrollToTop = () => {
    if (onScrollTo) {
      onScrollTo(0);
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSiteTitleClick = () => {
    scrollToTop();
    // Copy GitHub stars URL to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(GITHUB_STARS_URL).catch(() => {});
    }
    setGitHubToast(true);
  };

  useEffect(() => {
    if (!gitHubToast) return;
    const timer = setTimeout(() => setGitHubToast(false), 2500);
    return () => clearTimeout(timer);
  }, [gitHubToast]);

  const txl = content[lang].ui;
  const isEn = lang === "en";
  const toastText = isEn
    ? "Copied✓ My GitHub stars are all treasure projects:)"
    : "已复制✓ 我的GitHub星标都是宝藏项目:)";

  // Short underline that expands to full width on hover
  const underlineBase =
    "relative after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-[-3px] " +
    "after:h-[1px] after:bg-white after:transition-all after:duration-200 " +
    "after:w-[40%] hover:after:w-full";

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-6 pt-[calc(12px+env(safe-area-inset-top))] pb-3 [transform:translateZ(0)] pointer-events-none">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:gap-6 pointer-events-auto">
          {/* Site name: always JetBrains Mono, bold only in Chinese mode */}
          <button
            onClick={handleSiteTitleClick}
            className={`text-white text-[16px] md:text-[18px] font-mono tracking-wider hover:opacity-70 transition-opacity cursor-pointer ${isEn ? "font-normal" : "font-bold"}`}
          >
            {txl.siteName}
          </button>

          {/* Nav items: default font, bold in Chinese mode only, with animated underline */}
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.progress)}
              className={`text-white text-[13px] md:text-[15px] hover:opacity-70 transition-opacity cursor-pointer leading-tight ${isEn ? "font-normal" : "font-bold"} ${underlineBase}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-4 shrink-0 pointer-events-auto">
          {/* Contact: icon on mobile, text on desktop. Desktop order: first; Mobile order: second */}
          <button
            onClick={onContact}
            className={`text-white cursor-pointer leading-tight ${isEn ? "font-normal" : "font-bold"} ${contactOpen ? "opacity-70" : ""} order-2 md:order-1`}
            aria-label={txl.contactMe}
          >
            <span className={`hidden md:inline text-[14px] md:text-[16px] whitespace-nowrap transition-opacity duration-100 ${underlineBase}`}>
              {txl.contactMe}
            </span>
            <img
              src="/icons/contact.svg"
              alt=""
              className="md:hidden w-[28px] h-[28px] active:opacity-70 active:scale-90 transition-transform duration-75"
            />
          </button>

          {/* Language toggle: Mobile order: first; Desktop order: second */}
          <button
            onClick={onToggleLang}
            className={`text-white text-[13px] md:text-[15px] hover:opacity-70 transition-opacity cursor-pointer ${isEn ? "font-normal" : "font-bold"} order-1 md:order-2`}
          >
            {lang === "zh" ? "EN" : "中"}
          </button>
        </div>
      </nav>

      {/* GitHub stars copied toast */}
      <div
        className={`fixed left-4 md:left-6 top-[calc(env(safe-area-inset-top)+42px)] z-[9999] transition-opacity duration-300 pointer-events-none ${
          gitHubToast ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 text-white font-bold text-[13px] md:text-[14px] py-2 px-3 rounded-md bg-black/70 whitespace-nowrap">
          <img src="/icons/github.svg" alt="" className="w-5 h-5" />
          <span>{toastText}</span>
        </div>
      </div>
    </>
  );
}
