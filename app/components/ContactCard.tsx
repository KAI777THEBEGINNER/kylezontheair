"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/app/data/content";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}

const CONTACT_INFO_ZH = `邮箱：kylez777@icloud.com\n电话：+86 18812220501（微信同号）`;
const CONTACT_INFO_EN = `Email: kylez777@icloud.com\nPhone: +86 18812220501 (also WeChat ID)`;

export default function ContactCard({ open, onClose, lang }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Random rotation & offset on each open — "tossed on desk" feel
  const [transform, setTransform] = useState({ rotate: 0, x: 0, y: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Random subtle rotation [-9, 9]deg and small offset
    const rotate = (Math.random() - 0.5) * 18;
    const x = (Math.random() - 0.5) * 16;
    const y = (Math.random() - 0.5) * 8;
    setTransform({ rotate, x, y });
    setCopied(false);

    const handleClick = (e: MouseEvent) => {
      // Ignore clicks inside the card
      if (cardRef.current && cardRef.current.contains(e.target as Node)) return;
      // Ignore clicks on the navbar — the Contact button handles its own toggle
      const nav = document.querySelector("nav");
      if (nav && nav.contains(e.target as Node)) return;
      onClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleCopy = async () => {
    const text = lang === "zh" ? CONTACT_INFO_ZH : CONTACT_INFO_EN;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`
        fixed inset-0 z-[110] pointer-events-none
        transition-opacity duration-300
        ${open ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Card — slides in from top-right with random tilt */}
      <div
        ref={cardRef}
        onClick={handleCopy}
        className={`
          absolute top-16 right-4 md:right-6
          w-[340px] md:w-[400px]
          transition-all duration-400 ease-out
          cursor-pointer
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none translate-x-8"}
        `}
        style={{
          transform: open
            ? `translateX(${transform.x}px) translateY(${transform.y}px) rotate(${transform.rotate}deg)`
            : undefined,
        }}
      >
        {/* Business card image */}
        <img
          src="/business_card.png"
          alt="Business Card"
          className="w-full shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          draggable={false}
        />
        {/* Copied toast */}
        <div
          className={`
            absolute bottom-3 left-1/2 -translate-x-1/2
            px-3 py-1 rounded-full bg-white/90 text-black text-[13px] font-bold
            transition-opacity duration-200
            ${copied ? "opacity-100" : "opacity-0 pointer-events-none"}
          `}
        >
          {lang === "zh" ? "已复制✓" : "Copied✓"}
        </div>
      </div>
    </div>
  );
}
