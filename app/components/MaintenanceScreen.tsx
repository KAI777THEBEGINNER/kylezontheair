"use client";

import { useEffect, useRef, useState } from "react";

const EN_LINE_1 = "I'm currently";
const EN_LINE_2 = "editing my resume:)";
const EN_LINE = EN_LINE_1 + EN_LINE_2; // timing counts across both segments
const ZH_LINE = "简历正在更新中";
const EN_LINE_3 = "will reopen soon:)";
const ZH_LINE_2 = "欢迎下次再来";
const MAIN_LINES = [EN_LINE, ZH_LINE, EN_LINE_3, ZH_LINE_2]; // EN→ZH→EN→ZH
const BRAND_A = "[KYLE ZHAO]";
const BRAND_B = "ByteDancing";

const TYPE_START_DELAY = 600;
const TYPE_CHAR_MS: [number, number] = [45, 95]; // per-char delay: [EN, ZH]
const DELETE_CHAR_MS = 28;
const HOLD_MS = 2400;
const BRAND_START_DELAY = 3200; // offset from the main line so they never switch in sync
const BRAND_FLIP_MS = 300;      // one letter's flip duration
const BRAND_STAGGER_MS = 70;    // delay between consecutive letters
const BRAND_SWAP_MS = BRAND_A.length * BRAND_STAGGER_MS + BRAND_FLIP_MS;

/** Builds a pure timestamp→state function: for each line — type → hold → delete —
 *  then on to the next, looping. No chained timers, immune to background-tab
 *  throttling, self-corrects after the tab was hidden. */
function makeTypeDeleteTimeline(
  lines: string[],
  typeMs: number[],
  delMs: number,
  holdMs: number,
  startDelay: number
) {
  const typeDur = lines.map((l, i) => l.length * typeMs[i]);
  const delDur = lines.map(l => l.length * delMs);
  const cycle = typeDur.reduce((a, d, i) => a + d + holdMs + delDur[i], 0);

  return (t: number): { lang: number; len: number } => {
    let v = Math.max(0, t - startDelay) % cycle;
    for (let i = 0; i < lines.length; i++) {
      if (v < typeDur[i]) return { lang: i, len: Math.min(lines[i].length, Math.ceil(v / typeMs[i])) };
      v -= typeDur[i];
      if (v < holdMs) return { lang: i, len: lines[i].length };
      v -= holdMs;
      if (v < delDur[i]) return { lang: i, len: lines[i].length - 1 - Math.floor(v / delMs) };
      v -= delDur[i];
    }
    return { lang: 0, len: 0 };
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
  MAIN_LINES,
  [TYPE_CHAR_MS[0], TYPE_CHAR_MS[1], TYPE_CHAR_MS[0], TYPE_CHAR_MS[1]],
  DELETE_CHAR_MS,
  HOLD_MS,
  TYPE_START_DELAY
);

/** Brand timeline: settled A → swap to B → settled B → swap to A → loop.
 *  Swap renders per-letter flip-card animations (CSS-staggered), so the state
 *  only needs to know whether we're mid-swap. */
function brandStateAt(t: number): { show: "A" | "B"; swap: boolean } {
  const period = 2 * (HOLD_MS + BRAND_SWAP_MS);
  const u = Math.max(0, t - BRAND_START_DELAY) % period;
  if (u < HOLD_MS) return { show: "A", swap: false };
  if (u < HOLD_MS + BRAND_SWAP_MS) return { show: "B", swap: true };
  if (u < 2 * HOLD_MS + BRAND_SWAP_MS) return { show: "B", swap: false };
  return { show: "A", swap: true };
}

/** Per-letter flip-card swap: each changed letter flips 3D to reveal the new
 *  character, staggered left → right; identical letters stay put. */
function BrandFlip({ from, to, swap }: { from: string; to: string; swap: boolean }) {
  if (!swap) return <>{to}</>;
  const chars = [];
  for (let i = 0; i < to.length; i++) {
    if (from[i] === to[i]) {
      chars.push(
        <span key={i} className="inline-block whitespace-pre">{to[i]}</span>
      );
    } else {
      chars.push(
        <span key={i} className="relative inline-block whitespace-pre [perspective:300px]">
          <span
            className="inline-block whitespace-pre animate-brand-flip-out"
            style={{ animationDelay: `${i * BRAND_STAGGER_MS}ms` }}
          >
            {from[i]}
          </span>
          <span
            className="absolute inset-0 animate-brand-flip-in"
            style={{ animationDelay: `${i * BRAND_STAGGER_MS}ms` }}
          >
            {to[i]}
          </span>
        </span>
      );
    }
  }
  return <>{chars}</>;
}

export default function MaintenanceScreen() {
  const main = useTimeline(mainStateAt, s => `${s.lang}:${s.len}`);
  const brand = useTimeline(brandStateAt, s => `${s.show}:${s.swap}`);

  const mainText = MAIN_LINES[main.lang];

  return (
    <div className="fixed inset-0 z-[10001] bg-black flex flex-col items-center justify-center px-8 text-center">
      {/* Favicon mark: horizontally centered, pinned to the top */}
      <img
        src="/icon.png"
        alt="KYLE ZHAO"
        className="absolute top-8 left-1/2 -translate-x-1/2 w-12 h-12 rounded-xl"
      />

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
          <span className={`whitespace-pre ${main.lang % 2 === 0 ? "font-serif font-normal" : "font-song font-bold"}`}>
            {mainText.slice(0, main.len)}
          </span>
        )}
      </p>

      {/* Width locked by an invisible sizer of the widest mark; per-letter
          flip-card swap, staggered left → right */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <span className="inline-grid font-mono font-bold text-white/40 text-[13px] tracking-wider whitespace-pre">
          <span className="invisible col-start-1 row-start-1" aria-hidden>
            {BRAND_B}
          </span>
          <span className="col-start-1 row-start-1 text-left">
            <BrandFlip
              from={brand.show === "A" ? BRAND_B : BRAND_A}
              to={brand.show === "A" ? BRAND_A : BRAND_B}
              swap={brand.swap}
            />
          </span>
        </span>
      </div>
    </div>
  );
}
