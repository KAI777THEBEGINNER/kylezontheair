"use client";

import { useState } from "react";
import TypewriterText from "./TypewriterText";

const EN_LINE = "I'm currently editing my resume...";
const ZH_LINE = "简历正在更新中...";

export default function MaintenanceScreen() {
  const [showZh, setShowZh] = useState(false);

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex flex-col items-center justify-center px-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-white text-[18px] md:text-[22px] font-bold tracking-wide">
          <TypewriterText
            text={EN_LINE}
            startDelay={600}
            charDelay={45}
            onComplete={() => setShowZh(true)}
          />
        </p>
        {showZh && (
          <p className="text-white/60 text-[16px] md:text-[19px] tracking-wide">
            <TypewriterText text={ZH_LINE} charDelay={90} />
          </p>
        )}
      </div>

      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="font-mono font-bold text-white/40 text-[13px] tracking-wider">
          [KYLE ZHAO]
        </span>
      </div>
    </div>
  );
}
