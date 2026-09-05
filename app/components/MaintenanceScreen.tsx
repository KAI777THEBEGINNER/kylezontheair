"use client";

import { useEffect, useState } from "react";
import TypewriterText from "./TypewriterText";

const EN_LINE = "I'm currently editing my resume...";
const ZH_LINE = "简历正在更新中...";
const HOLD_MS = 2400;

/**
 * Single-line maintenance notice: types English, holds, switches to Chinese,
 * holds, loops forever. Fonts follow the site content convention:
 * English → JetBrains Mono (font-serif), Chinese → PingFang SC (font-song, bold).
 */
export default function MaintenanceScreen() {
  const [cycle, setCycle] = useState(0);
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [typing, setTyping] = useState(true);

  // After a line finishes typing: hold, then switch language (EN → ZH → EN ...)
  useEffect(() => {
    if (typing) return;
    const t = setTimeout(() => {
      const next = lang === "en" ? "zh" : "en";
      if (lang === "zh") setCycle(c => c + 1);
      setLang(next);
      setTyping(true);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [typing, lang]);

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex flex-col items-center justify-center px-8 text-center">
      {/* Fixed-height line so EN/ZH swaps don't shift the layout */}
      <p
        className={`h-[1.5em] flex items-center text-white text-[20px] md:text-[26px] tracking-wide ${
          lang === "en" ? "font-serif font-normal" : "font-song font-bold"
        }`}
      >
        {typing && (
          <TypewriterText
            key={`${cycle}-${lang}`}
            text={lang === "en" ? EN_LINE : ZH_LINE}
            startDelay={cycle === 0 && lang === "en" ? 600 : 200}
            charDelay={lang === "en" ? 45 : 110}
            onComplete={() => setTyping(false)}
          />
        )}
      </p>

      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="font-mono font-bold text-white/40 text-[13px] tracking-wider">
          [KYLE ZHAO]
        </span>
      </div>
    </div>
  );
}
