"use client";

import { useEffect, useState } from "react";

function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export default function WeChatRedirect() {
  const [isWeChat, setIsWeChat] = useState(false);

  useEffect(() => {
    setIsWeChat(isWeChatBrowser());
  }, []);

  if (!isWeChat) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center px-8 text-center">
      {/* Arrow positioned at top-right corner, pointing up, bouncing */}
      <div className="absolute top-12 right-6 animate-wechat-arrow-bounce">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </div>

      <p className="text-white text-[20px] font-bold mb-2">
        请点击右上角 ···
      </p>
      <p className="text-white text-[18px] font-bold mb-6">
        选择「在浏览器中打开」
      </p>
      <p className="text-white/60 text-[14px] max-w-[280px]">
        微信内置浏览器不支持本站的最佳体验，请在系统浏览器中访问。
      </p>
      <p className="text-white/60 text-[13px] mt-4">
        Please open in your system browser for the best experience.
      </p>

      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="font-mono font-bold text-white/40 text-[13px] tracking-wider">
          [KYLE ZHAO]
        </span>
      </div>
    </div>
  );
}
