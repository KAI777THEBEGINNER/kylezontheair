"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/app/data/content";
import { content, SECTIONS } from "@/app/data/content";
import type { ReactNode } from "react";
import TypewriterText from "./TypewriterText";

interface Props {
  progress: number;
  lang: Lang;
  introActive?: boolean;
}

function sectionOpacity(progress: number, [start, end]: [number, number]): number {
  const fade = 0.02;
  if (progress < start - fade || progress > end + fade) return 0;
  if (progress < start) return (progress - (start - fade)) / fade;
  if (progress <= end) return 1;
  return ((end + fade) - progress) / fade;
}

function range(id: string): [number, number] {
  const s = SECTIONS.find(s => s.id === id);
  if (!s) throw new Error(`Section "${id}" not found`);
  return s.range;
}

/** Chinese: keep 「」; English: replace 「...」with <em>...</em> */
function renderBody(text: string, lang: Lang): ReactNode {
  if (lang === "en") {
    const parts: ReactNode[] = [];
    const regex = /「([^」]*)」/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(<em key={key++}>{match[1]}</em>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  }
  return text;
}

/** Parse body into first-line (inside 「」) and rest */
function splitBody(text: string): [string, string] {
  const match = text.match(/^「([^」]*)」\n\n([\s\S]*)$/);
  if (match) return [match[1], match[2]];
  return ["", text];
}

function renderFirstLine(text: string, lang: Lang): ReactNode {
  if (lang === "en") return <em>{text}</em>;
  return `「${text}」`;
}

// Hero section fade-out: sectionOpacity adds 0.02 past the end before fully transparent.
// Only restore the title once the hero has completely faded out of view.
const HERO_END = range("hero")[1] + 0.04;

/** Hard black shadow + white glow for max perceived whiteness on dark bg */
const textShadow = {
  textShadow: "0 0 0.5px #fff, 2px 2px 0 #000, 1px 1px 0 #000",
};

/** Section body: first line and rest separated by gap */
function SectionBody({ text, lang }: { text: string; lang: Lang }) {
  const [firstLine, rest] = splitBody(text);
  // Section body: font-normal as requested
  const weight = "font-normal";
  // English body runs long on mobile; shrink one notch
  const sizeClass = lang === "en"
    ? "text-[15px] md:text-[22px] lg:text-[26px]"
    : "text-[17px] md:text-[22px] lg:text-[26px]";
  if (!firstLine) {
    return (
      <p className={`${sizeClass} leading-relaxed text-white whitespace-pre-wrap ${weight}`} style={textShadow}>
        {renderBody(text, lang)}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className={`${sizeClass} leading-relaxed text-white whitespace-pre-wrap ${weight}`} style={textShadow}>
        {renderFirstLine(firstLine, lang)}
      </p>
      <p className={`${sizeClass} leading-relaxed text-white whitespace-pre-wrap ${weight}`} style={textShadow}>
        {renderBody(rest, lang)}
      </p>
    </div>
  );
}

/** Animated bounce-down arrow */
function BounceArrow() {
  return (
    <div className="absolute bottom-[6vh] supports-[height:100svh]:bottom-[6svh] left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce-up">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
        <path d="M12 19V5M12 5l-6 6M12 5l6 6" />
      </svg>
    </div>
  );
}

/** Repeatedly rolls the hint text up from the bottom, looping every 2.5s. */
function RollingHintText({ text }: { text: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      key={tick}
      className="inline-flex items-center"
      style={{ perspective: "600px" }}
    >
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="inline-block animate-hero-hint-roll"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}

/** Hero title rewrite: deletes the original title char-by-char, then shows the
 *  rolling hint text. The scroll hint only appears after deletion finishes.
 */
function HeroHintTypewriter({
  originalText,
  hintText,
}: {
  originalText: string;
  hintText: string;
}) {
  const [phase, setPhase] = useState<"deleting" | "rolling">("deleting");
  const [displayText, setDisplayText] = useState(originalText);

  useEffect(() => {
    if (phase !== "deleting") return;
    let current = originalText;
    const timer = setInterval(() => {
      current = current.slice(0, -1);
      setDisplayText(current);
      if (current.length === 0) {
        clearInterval(timer);
        setPhase("rolling");
      }
    }, 20);
    return () => clearInterval(timer);
  }, [phase, originalText]);

  return (
    <span className="inline-flex items-center" style={{ perspective: "600px" }}>
      {phase === "deleting" ? (
        <span className="inline-block whitespace-pre-wrap">{displayText}</span>
      ) : (
        <RollingHintText text={hintText} />
      )}
    </span>
  );
}

export default function TextContainers({ progress, lang, introActive = false }: Props) {
  const txl = content[lang];
  const isEn = lang === "en";
  // Container font: English → JetBrains Mono, Chinese → PingFang SC
  const fontClass = isEn ? " font-serif" : " font-song";

  // Hero title/subtitle typewriter starts once and stays started
  const [typewriterStarted, setTypewriterStarted] = useState(false);
  useEffect(() => {
    if (introActive) setTypewriterStarted(true);
  }, [introActive]);

  // Track when the hero title has finished typing
  const [titleTyped, setTitleTyped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Reset title/hint state when language changes so the new title can re-type
  useEffect(() => {
    setTitleTyped(false);
    setShowHint(false);
  }, [lang]);

  // After title finishes typing and the page is fully visible, wait 5 seconds of
  // idle time on hero before replacing it with the scroll hint. The hint only
  // cancels once the user has left the hero section; small scrolls inside hero
  // keep the hint visible.
  useEffect(() => {
    if (!titleTyped || introActive || progress > HERO_END || showHint) return;
    const timer = setTimeout(() => {
      setShowHint(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [titleTyped, introActive, progress, showHint]);

  // Cancel the hint and restore the title only after the hero section is fully passed.
  useEffect(() => {
    if (showHint && progress > HERO_END) {
      setShowHint(false);
    }
  }, [showHint, progress]);

  // Detect mobile viewport for choosing 滚动 vs 划动 / "scroll down" vs "scroll"
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Slash-tag entrance timing: 4 tags staggered within the 0.7s intro window
  const tagStagger = 90;
  // Typewriter timing
  const charDelay = 26;
  const titleStartDelay = 150;
  const subtitleStartDelay = 420;

  const hintText = txl.ui.scrollHintDown[isMobile ? "mobile" : "desktop"];

  return (
    <>
      {/* ── Hero ── */}
      <div
        className={`fixed inset-0 z-10 pointer-events-none${fontClass} [transform:translateZ(0)]`}
        style={{ opacity: sectionOpacity(progress, range("hero")) }}
      >
        <div className="absolute top-[12vh] supports-[height:100svh]:top-[12svh] supports-[height:100svh]:top-[12svh] left-6 md:left-20 flex flex-col gap-2">
          {txl.hero.tags.map((tag, idx) => (
            <span
              key={tag}
              className={`text-[16px] md:text-[24px] lg:text-[28px] text-white whitespace-nowrap ${isEn ? "font-normal" : "font-bold"}`}
              style={textShadow}
            >
              <span
                className={`inline-block ${introActive ? "opacity-0 animate-tag-reveal" : ""}`}
                style={{
                  animationDelay: introActive ? `${idx * tagStagger}ms` : undefined,
                }}
              >
                /{tag}
              </span>
            </span>
          ))}
        </div>

        <div className="absolute bottom-[10vh] supports-[height:100svh]:bottom-[10svh] left-6 md:left-20 right-6 md:right-20">
          {/* Hero title: bold only in Chinese mode */}
          <h1
            className={`text-[48px] md:text-[100px] lg:text-[140px] leading-[0.9] text-white whitespace-pre-wrap tracking-tight ${isEn ? "font-normal" : "font-bold"}`}
            style={textShadow}
          >
            {showHint ? (
              <HeroHintTypewriter originalText={txl.hero.title} hintText={hintText} />
            ) : titleTyped ? (
              <span className="inline-block whitespace-pre-wrap">{txl.hero.title}</span>
            ) : (
              <TypewriterText
                text={txl.hero.title}
                startDelay={titleStartDelay}
                charDelay={charDelay}
                ready={typewriterStarted}
                onComplete={() => setTitleTyped(true)}
              />
            )}
          </h1>
          {/* Hero subtitle: bold only in Chinese mode */}
          <p
            className={`text-[18px] md:text-[32px] lg:text-[40px] text-white mt-4 md:mt-6 whitespace-pre-wrap ${isEn ? "font-normal" : "font-bold"}`}
            style={textShadow}
          >
            <TypewriterText text={txl.hero.subtitle} startDelay={subtitleStartDelay} charDelay={charDelay} ready={typewriterStarted} />
          </p>
        </div>
      </div>

      {/* ── 创业经历 ── */}
      <div
        className={`fixed inset-0 z-10 pointer-events-none${fontClass} [transform:translateZ(0)]`}
        style={{ opacity: sectionOpacity(progress, range("entrepreneurship")) }}
      >
        <div className="absolute top-[12vh] supports-[height:100svh]:top-[12svh] left-0 right-0 px-6 md:px-20">
          <h2
            className={`text-[36px] md:text-[60px] lg:text-[80px] leading-[1.1] text-white whitespace-pre-wrap tracking-tight ${isEn ? "font-normal" : "font-bold"}`}
            style={textShadow}
          >
            {txl.entrepreneurship.title}
          </h2>
          <p
            className={`text-[14px] md:text-[18px] lg:text-[20px] text-white mt-2 md:mt-3 tracking-wider ${isEn ? "font-normal lowercase" : "font-bold"}`}
            style={{ ...textShadow, ...(isEn ? { fontVariant: "normal" } : {}) }}
          >
            {isEn ? `[${txl.entrepreneurship.label.toLowerCase()}]` : txl.entrepreneurship.label}
          </p>
        </div>

        <div className="absolute bottom-[10vh] supports-[height:100svh]:bottom-[10svh] left-0 right-0 px-6 md:px-20">
          <SectionBody text={txl.entrepreneurship.body} lang={lang} />
        </div>
      </div>

      {/* ── 实习经历 ── */}
      <div
        className={`fixed inset-0 z-10 pointer-events-none${fontClass} [transform:translateZ(0)]`}
        style={{ opacity: sectionOpacity(progress, range("internship")) }}
      >
        <div className="absolute top-[12vh] supports-[height:100svh]:top-[12svh] left-0 right-0 px-6 md:px-20">
          <h2
            className={`${isEn ? "text-[24px]" : "text-[32px]"} md:text-[50px] lg:text-[65px] leading-[1.1] text-white tracking-tight whitespace-pre-wrap ${isEn ? "font-normal" : "font-bold"}`}
            style={textShadow}
          >
            {isEn ? (
              txl.internship.title
            ) : (
              txl.internship.title.split("\n").map((line, i) => (
                <span key={i} className="block whitespace-nowrap">
                  {line}
                </span>
              ))
            )}
          </h2>
          <p
            className={`text-[14px] md:text-[18px] lg:text-[20px] text-white mt-2 md:mt-3 tracking-wider ${isEn ? "font-normal" : "font-bold"}`}
            style={textShadow}
          >
            {isEn ? `[${txl.internship.label.toLowerCase()}]` : txl.internship.label}
          </p>
        </div>

        <div className="absolute bottom-[10vh] supports-[height:100svh]:bottom-[10svh] left-0 right-0 px-6 md:px-20">
          <SectionBody text={txl.internship.body} lang={lang} />
        </div>
      </div>

      {/* ── 教育经历 ── */}
      <div
        className={`fixed inset-0 z-10 pointer-events-none${fontClass} [transform:translateZ(0)]`}
        style={{ opacity: sectionOpacity(progress, range("education")) }}
      >
        <div className="absolute top-[12vh] supports-[height:100svh]:top-[12svh] left-0 right-0 px-6 md:px-20">
          <h2
            className={`${isEn ? "text-[24px]" : "text-[32px]"} md:text-[50px] lg:text-[65px] leading-[1.1] text-white tracking-tight whitespace-pre-wrap ${isEn ? "font-normal" : "font-bold"}`}
            style={textShadow}
          >
            {isEn ? (
              txl.education.title
            ) : (
              txl.education.title.split("\n").map((line, i) => (
                <span key={i} className="block whitespace-nowrap">
                  {line}
                </span>
              ))
            )}
          </h2>
          <p
            className={`text-[14px] md:text-[18px] lg:text-[20px] text-white mt-2 md:mt-3 tracking-wider ${isEn ? "font-normal" : "font-bold"}`}
            style={textShadow}
          >
            {isEn ? `[${txl.education.label.toLowerCase()}]` : txl.education.label}
          </p>
        </div>

        <div className="absolute bottom-[10vh] supports-[height:100svh]:bottom-[10svh] left-0 right-0 px-6 md:px-20">
          <SectionBody text={txl.education.body} lang={lang} />
        </div>
      </div>

      {/* ── 衔接区域 ── */}
      <div
        className={`fixed inset-0 z-10 flex flex-col items-start justify-center pointer-events-none${fontClass} [transform:translateZ(0)]`}
        style={{ opacity: sectionOpacity(progress, range("bridge")) }}
      >
        <div
          className={`w-full text-[18px] md:text-[28px] lg:text-[36px] leading-relaxed text-white text-left whitespace-pre-wrap px-10 md:px-28 ${isEn ? "font-normal" : "font-bold"}`}
          style={textShadow}
        >
          {renderBody(txl.bridge.body, lang)}
          {"\n\n"}
          {txl.bridge.cta}
        </div>
        <BounceArrow />
      </div>

      {/* Scroll spacer */}
      <div style={{ height: "400vh" }} />
    </>
  );
}
