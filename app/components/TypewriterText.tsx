"use client";

import { useEffect, useMemo } from "react";

interface TypewriterTextProps {
  text: string;
  /** delay before the first character appears, in ms */
  startDelay?: number;
  /** delay between characters, in ms */
  charDelay?: number;
  className?: string;
  /** if false, text is hidden (used before hydration-ready animation starts) */
  ready?: boolean;
  /** called once when the full text has been revealed */
  onComplete?: () => void;
}

export default function TypewriterText({
  text,
  startDelay = 0,
  charDelay = 35,
  className = "",
  ready = true,
  onComplete,
}: TypewriterTextProps) {
  const segments = useMemo(() => {
    const chars = text.split("");
    const result: { type: "word" | "space" | "newline"; chars: string[] }[] = [];
    let currentWord: string[] = [];
    chars.forEach((char) => {
      if (char === "\n") {
        if (currentWord.length) {
          result.push({ type: "word", chars: currentWord });
          currentWord = [];
        }
        result.push({ type: "newline", chars: [char] });
      } else if (char === " ") {
        if (currentWord.length) {
          result.push({ type: "word", chars: currentWord });
          currentWord = [];
        }
        result.push({ type: "space", chars: [char] });
      } else {
        currentWord.push(char);
      }
    });
    if (currentWord.length) {
      result.push({ type: "word", chars: currentWord });
    }
    return result;
  }, [text]);

  const totalChars = segments.reduce((acc, s) => acc + s.chars.length, 0);
  const completeAt = startDelay + totalChars * charDelay;

  useEffect(() => {
    if (!ready || !onComplete) return;
    const timer = setTimeout(() => onComplete(), completeAt);
    return () => clearTimeout(timer);
  }, [ready, onComplete, completeAt]);

  if (!ready) {
    return (
      <span className={`inline-block opacity-0 ${className}`} aria-hidden="true">
        {text}
      </span>
    );
  }

  let charIndex = 0;

  return (
    <span className={`inline-block ${className}`} aria-label={text}>
      {segments.map((segment, segIdx) => {
        if (segment.type === "newline") {
          const delay = startDelay + charIndex * charDelay;
          charIndex += segment.chars.length;
          return (
            <br
              key={segIdx}
              className="opacity-0 animate-typewriter-char"
              style={{ animationDelay: `${delay}ms` }}
            />
          );
        }

        const chars = segment.chars.map((char, i) => {
          const delay = startDelay + (charIndex + i) * charDelay;
          return (
            <span
              key={i}
              className="inline-block opacity-0 animate-typewriter-char"
              style={{ animationDelay: `${delay}ms` }}
            >
              {char === " " ? " " : char}
            </span>
          );
        });
        charIndex += segment.chars.length;

        if (segment.type === "word") {
          return (
            <span key={segIdx} className="inline-block whitespace-nowrap">
              {chars}
            </span>
          );
        }

        return <span key={segIdx}>{chars}</span>;
      })}
    </span>
  );
}
