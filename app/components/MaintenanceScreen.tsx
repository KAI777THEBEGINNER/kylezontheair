"use client";

import { useEffect, useRef, useState } from "react";
import TypewriterText from "./TypewriterText";

const EN_LINE = "I'm currently editing my resume...";
const ZH_LINE = "简历正在更新中...";
const BRAND_A = "[KYLE ZHAO]";
const BRAND_B = "[ByteDancing]";

const TYPE_START_DELAY = 600;
const TYPE_CHAR_MS = 45;
const REPLACE_CHAR_MS = 55;
const HOLD_MS = 2400;
const BRAND_LEAD_MS = 3200;

type Step = "typeA" | "holdA" | "toB" | "holdB" | "toA";

const replaceDuration = (a: string, b: string) =>
  Math.max(a.length, b.length) * REPLACE_CHAR_MS;

/**
 * One line's life cycle: type A → hold → replace to B → hold → replace to A → loop.
 * firstHoldMs != null skips the initial typing (line starts settled on A) and
 * offsets the first switch, so two lines can run out of phase.
 */
function useLineCycle(a: string, b: string, firstHoldMs: number | null) {
  const [step, setStep] = useState<Step>(firstHoldMs != null ? "holdA" : "typeA");
  const firstHold = useRef(firstHoldMs != null);

  useEffect(() => {
    if (step === "typeA") return; // advanced by TypewriterText onComplete
    let delay: number;
    if (step === "holdA") {
      delay = firstHold.current ? (firstHoldMs as number) : HOLD_MS;
      firstHold.current = false;
    } else if (step === "holdB") {
      delay = HOLD_MS;
    } else {
      delay = replaceDuration(a, b);
    }
    const t = setTimeout(() => {
      setStep(
        step === "holdA" ? "toB" : step === "toB" ? "holdB" : step === "holdB" ? "toA" : "holdA"
      );
    }, delay);
    return () => clearTimeout(t);
  }, [step, a, b, firstHoldMs]);

  return [step, setStep] as const;
}

/** char-by-char replacement cursor (0 → maxLen) while a replace phase is active */
function useReplaceProgress(active: boolean, maxLen: number) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!active) return;
    setK(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setK(i);
      if (i >= maxLen) clearInterval(t);
    }, REPLACE_CHAR_MS);
    return () => clearInterval(t);
  }, [active, maxLen]);
  return k;
}

/** Mid-transition render: first k chars already switched to `to`, the rest still `from` */
function ReplacingLine({
  from,
  to,
  k,
  fromClass,
  toClass,
}: {
  from: string;
  to: string;
  k: number;
  fromClass: string;
  toClass: string;
}) {
  const maxLen = Math.max(from.length, to.length);
  const chars = [];
  for (let i = 0; i < maxLen; i++) {
    if (i < k && i < to.length) {
      chars.push(
        <span key={`to-${i}`} className={`inline-block whitespace-pre animate-typewriter-char ${toClass}`}>
          {to[i] === " " ? " " : to[i]}
        </span>
      );
    } else if (i < from.length) {
      chars.push(
        <span key={`from-${i}`} className={`inline-block whitespace-pre ${fromClass}`}>
          {from[i] === " " ? " " : from[i]}
        </span>
      );
    }
    // else: beyond both texts (new text longer) — nothing yet, appears when k reaches it
  }
  return <span>{chars}</span>;
}

export default function MaintenanceScreen() {
  const [step, setStep] = useLineCycle(EN_LINE, ZH_LINE, null);
  const [brandStep] = useLineCycle(BRAND_A, BRAND_B, BRAND_LEAD_MS);

  const mainReplaceK = useReplaceProgress(
    step === "toB" || step === "toA",
    Math.max(EN_LINE.length, ZH_LINE.length)
  );
  const brandReplaceK = useReplaceProgress(
    brandStep === "toB" || brandStep === "toA",
    Math.max(BRAND_A.length, BRAND_B.length)
  );

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex flex-col items-center justify-center px-8 text-center">
      {/* Fixed-height line so EN/ZH swaps don't shift the layout */}
      <p className="h-[1.5em] flex items-center text-white text-[20px] md:text-[26px] tracking-wide">
        {step === "typeA" && (
          <TypewriterText
            text={EN_LINE}
            startDelay={TYPE_START_DELAY}
            charDelay={TYPE_CHAR_MS}
            onComplete={() => setStep("holdA")}
            className="font-serif font-normal"
          />
        )}
        {step === "holdA" && (
          <span className="font-serif font-normal whitespace-pre">{EN_LINE}</span>
        )}
        {step === "holdB" && (
          <span className="font-song font-bold whitespace-pre">{ZH_LINE}</span>
        )}
        {step === "toB" && (
          <ReplacingLine
            from={EN_LINE}
            to={ZH_LINE}
            k={mainReplaceK}
            fromClass="font-serif font-normal"
            toClass="font-song font-bold"
          />
        )}
        {step === "toA" && (
          <ReplacingLine
            from={ZH_LINE}
            to={EN_LINE}
            k={mainReplaceK}
            fromClass="font-song font-bold"
            toClass="font-serif font-normal"
          />
        )}
      </p>

      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="font-mono font-bold text-white/40 text-[13px] tracking-wider">
          {brandStep === "holdA" && BRAND_A}
          {brandStep === "holdB" && BRAND_B}
          {brandStep === "toB" && (
            <ReplacingLine
              from={BRAND_A}
              to={BRAND_B}
              k={brandReplaceK}
              fromClass=""
              toClass=""
            />
          )}
          {brandStep === "toA" && (
            <ReplacingLine
              from={BRAND_B}
              to={BRAND_A}
              k={brandReplaceK}
              fromClass=""
              toClass=""
            />
          )}
        </span>
      </div>
    </div>
  );
}
