"use client";

import { useEffect, useRef, useState } from "react";

const EN_LINE = "I'm currently editing my resume...";
const ZH_LINE = "简历正在更新中...";
const BRAND_A = "[KYLE ZHAO]";
const BRAND_B = "[ByteDancing]";
/** [ByteDancing] is the longer mark — monospace makes 13ch its exact width */
const BRAND_WIDTH_CH = BRAND_B.length;

const TYPE_START_DELAY = 600;
const TYPE_CHAR_MS = [45, 95]; // per-char delay: [EN, ZH]
const DELETE_CHAR_MS = 28;
const HOLD_MS = 2400;
const REPLACE_CHAR_MS = 55;
const BRAND_LEAD_MS = 3200;

/** Runs `compute(performance.now())` on every frame, re-rendering only on change.
 *  Timestamp-driven: no chained timers, immune to background-tab throttling,
 *  self-corrects after the tab was hidden. */
function useTimeline<T>(compute: (t: number) => T, key: (s: T) => string): T {
  const [state, setState] = useState<T>(() => compute(0));
  const keyRef = useRef(key(state));
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = computeRef.current(performance.now());
      const k = key(next);
      if (k !== keyRef.current) {
        keyRef.current = k;
        setState(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

// ── Main line timeline: type EN → hold → delete → type ZH → hold → delete → loop ──

const TYPE_EN_MS = EN_LINE.length * TYPE_CHAR_MS[0];
const TYPE_ZH_MS = ZH_LINE.length * TYPE_CHAR_MS[1];
const DEL_EN_MS = EN_LINE.length * DELETE_CHAR_MS;
const DEL_ZH_MS = ZH_LINE.length * DELETE_CHAR_MS;
const MAIN_CYCLE =
  TYPE_EN_MS + HOLD_MS + DEL_EN_MS + TYPE_ZH_MS + HOLD_MS + DEL_ZH_MS;

function mainStateAt(t: number): { lang: 0 | 1; len: number } {
  const u = Math.max(0, t - TYPE_START_DELAY) % MAIN_CYCLE;
  if (u < TYPE_EN_MS) return { lang: 0, len: Math.min(EN_LINE.length, Math.ceil(u / TYPE_CHAR_MS[0])) };
  let v = u - TYPE_EN_MS;
  if (v < HOLD_MS) return { lang: 0, len: EN_LINE.length };
  v -= HOLD_MS;
  if (v < DEL_EN_MS) return { lang: 0, len: EN_LINE.length - 1 - Math.floor(v / DELETE_CHAR_MS) };
  v -= DEL_EN_MS;
  if (v < TYPE_ZH_MS) return { lang: 1, len: Math.min(ZH_LINE.length, Math.ceil(v / TYPE_CHAR_MS[1])) };
  v -= TYPE_ZH_MS;
  if (v < HOLD_MS) return { lang: 1, len: ZH_LINE.length };
  v -= HOLD_MS;
  return { lang: 1, len: ZH_LINE.length - 1 - Math.floor(v / DELETE_CHAR_MS) };
}

// ── Brand timeline: [KYLE ZHAO] ⇄ [ByteDancing] via char-by-char replace, offset from main text ──

const BRAND_REPLACE_MS = BRAND_WIDTH_CH * REPLACE_CHAR_MS;
const BRAND_PERIOD = 2 * (BRAND_REPLACE_MS + HOLD_MS);

function brandStateAt(t: number): { show: "A" | "B"; k: number } {
  if (t < BRAND_LEAD_MS) return { show: "A", k: 0 };
  const u = (t - BRAND_LEAD_MS) % BRAND_PERIOD;
  if (u < BRAND_REPLACE_MS) return { show: "B", k: Math.ceil(u / REPLACE_CHAR_MS) };
  if (u < BRAND_REPLACE_MS + HOLD_MS) return { show: "B", k: 0 };
  const v = u - BRAND_REPLACE_MS - HOLD_MS;
  if (v < BRAND_REPLACE_MS) return { show: "A", k: Math.ceil(v / REPLACE_CHAR_MS) };
  return { show: "A", k: 0 };
}

/** Mid-transition render: first k chars switched to `to`, the rest still `from` */
function ReplacingLine({ from, to, k }: { from: string; to: string; k: number }) {
  const chars = [];
  for (let i = 0; i < BRAND_WIDTH_CH; i++) {
    if (i < k && i < to.length) {
      chars.push(
        <span key={`to-${i}`} className="inline-block whitespace-pre animate-typewriter-char">
          {to[i] === " " ? " " : to[i]}
        </span>
      );
    } else if (i < from.length) {
      chars.push(
        <span key={`from-${i}`} className="inline-block whitespace-pre">
          {from[i] === " " ? " " : from[i]}
        </span>
      );
    }
  }
  return <span>{chars}</span>;
}

export default function MaintenanceScreen() {
  const main = useTimeline(mainStateAt, s => `${s.lang}:${s.len}`);
  const brand = useTimeline(brandStateAt, s => `${s.show}:${s.k}`);

  const mainText = main.lang === 0 ? EN_LINE : ZH_LINE;

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex flex-col items-center justify-center px-8 text-center">
      {/* Fixed-height line so EN/ZH swaps don't shift the layout */}
      <p className="h-[1.5em] flex items-center text-white text-[20px] md:text-[26px] tracking-wide">
        <span className={`whitespace-pre ${main.lang === 0 ? "font-serif font-normal" : "font-song font-bold"}`}>
          {mainText.slice(0, main.len)}
        </span>
      </p>

      {/* Fixed ch-width box: both brand marks occupy exactly the same width */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="inline-block w-[13ch] text-center font-mono font-bold text-white/40 text-[13px] tracking-wider whitespace-pre">
          {brand.k === 0 && (brand.show === "A" ? BRAND_A : BRAND_B)}
          {brand.k > 0 && (
            <ReplacingLine
              from={brand.show === "A" ? BRAND_B : BRAND_A}
              to={brand.show === "A" ? BRAND_A : BRAND_B}
              k={brand.k}
            />
          )}
        </span>
      </div>
    </div>
  );
}
