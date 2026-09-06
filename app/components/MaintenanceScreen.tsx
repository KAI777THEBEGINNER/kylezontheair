"use client";

import { useEffect, useRef, useState } from "react";

const EN_LINE_1 = "I'm currently";
const EN_LINE_2 = "editing my resume:)";
const EN_LINE = EN_LINE_1 + EN_LINE_2; // timing counts across both segments
const ZH_LINE = "简历正在更新中";
const BRAND_A = "[KYLE ZHAO]";
const BRAND_B = "ByteDancing";

const TYPE_START_DELAY = 600;
const TYPE_CHAR_MS: [number, number] = [45, 95]; // per-char delay: [EN, ZH]
const DELETE_CHAR_MS = 28;
const HOLD_MS = 2400;
const BRAND_START_DELAY = 3200; // offset from the main line so they never switch in sync
const BRAND_TYPE_CHAR_MS = 40;

/** Builds a pure timestamp→state function: type line 0 → hold → delete →
 *  type line 1 → hold → delete → loop. No chained timers, immune to
 *  background-tab throttling, self-corrects after the tab was hidden. */
function makeTypeDeleteTimeline(
  lines: [string, string],
  typeMs: [number, number],
  delMs: number,
  holdMs: number,
  startDelay: number
) {
  const typeDur = [lines[0].length * typeMs[0], lines[1].length * typeMs[1]];
  const delDur = [lines[0].length * delMs, lines[1].length * delMs];
  const cycle = typeDur[0] + holdMs + delDur[0] + typeDur[1] + holdMs + delDur[1];

  return (t: number): { lang: 0 | 1; len: number } => {
    const u = Math.max(0, t - startDelay) % cycle;
    if (u < typeDur[0]) return { lang: 0, len: Math.min(lines[0].length, Math.ceil(u / typeMs[0])) };
    let v = u - typeDur[0];
    if (v < holdMs) return { lang: 0, len: lines[0].length };
    v -= holdMs;
    if (v < delDur[0]) return { lang: 0, len: lines[0].length - 1 - Math.floor(v / delMs) };
    v -= delDur[0];
    if (v < typeDur[1]) return { lang: 1, len: Math.min(lines[1].length, Math.ceil(v / typeMs[1])) };
    v -= typeDur[1];
    if (v < holdMs) return { lang: 1, len: lines[1].length };
    v -= holdMs;
    return { lang: 1, len: lines[1].length - 1 - Math.floor(v / delMs) };
  };
}

/** Runs `compute(performance.now())` on every frame, re-rendering only on change. */
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

const mainStateAt = makeTypeDeleteTimeline(
  [EN_LINE, ZH_LINE],
  TYPE_CHAR_MS,
  DELETE_CHAR_MS,
  HOLD_MS,
  TYPE_START_DELAY
);

const brandStateAt = makeTypeDeleteTimeline(
  [BRAND_A, BRAND_B],
  [BRAND_TYPE_CHAR_MS, BRAND_TYPE_CHAR_MS],
  DELETE_CHAR_MS,
  HOLD_MS,
  BRAND_START_DELAY
);

export default function MaintenanceScreen() {
  const main = useTimeline(mainStateAt, s => `${s.lang}:${s.len}`);
  const brand = useTimeline(brandStateAt, s => `${s.lang}:${s.len}`);

  const mainText = main.lang === 0 ? EN_LINE : ZH_LINE;
  const brandText = brand.lang === 0 ? BRAND_A : BRAND_B;

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex flex-col items-center justify-center px-8 text-center">
      {/* Fixed-height block so EN/ZH swaps don't shift the layout; on mobile the
          EN line breaks between "currently" and "editing" */}
      <p className="min-h-[1.5em] flex items-center text-white text-[20px] md:text-[26px] tracking-wide text-center">
        {main.lang === 0 ? (
          <span className="whitespace-pre font-serif font-normal">
            {mainText.slice(0, Math.min(main.len, EN_LINE_1.length))}
            <br className="md:hidden" />
            <span className="hidden md:inline">{main.len > EN_LINE_1.length ? " " : ""}</span>
            {mainText.slice(EN_LINE_1.length, main.len)}
          </span>
        ) : (
          <span className="whitespace-pre font-song font-bold">{mainText.slice(0, main.len)}</span>
        )}
      </p>

      {/* Width locked by an invisible sizer of the widest mark; left-aligned typing
          means typed chars never move — no breathing, no subpixel jitter */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="inline-grid font-mono font-bold text-white/40 text-[13px] tracking-wider whitespace-pre">
          <span className="invisible col-start-1 row-start-1" aria-hidden>
            {BRAND_B}
          </span>
          <span className="col-start-1 row-start-1 text-left">
            {brandText.slice(0, brand.len)}
          </span>
        </span>
      </div>
    </div>
  );
}
