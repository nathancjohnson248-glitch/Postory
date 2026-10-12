"use client";

import { motion, useReducedMotion } from "motion/react";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PLATFORMS, PLATFORM_META } from "@/lib/social/platforms";

/** Where each network floats, as % of the stage — a loose ring around the mark. */
const SPOTS = [
  { x: 14, y: 28, r: -8 },
  { x: 31, y: 12, r: 6 },
  { x: 69, y: 12, r: -5 },
  { x: 86, y: 28, r: 8 },
  { x: 86, y: 72, r: -6 },
  { x: 69, y: 88, r: 5 },
  { x: 31, y: 88, r: -7 },
  { x: 14, y: 72, r: 6 },
];

/** "One story out to every network": the Postory mark sending a story to eight floating networks. */
export function NetworkOrbit() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto aspect-[1/1.05] w-full max-w-[520px] sm:aspect-[2.3/1] sm:max-w-5xl">
      {/* Connection lines, flowing outward */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        {SPOTS.map((s, i) => {
          const cx = 50 + (s.x - 50) * 0.45;
          const cy = 50 + (s.y - 50) * 0.1;
          return (
            <path
              key={i}
              d={`M50 50 Q ${cx} ${cy} ${s.x} ${s.y}`}
              fill="none"
              stroke="url(#orbit-line)"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="3 6"
              className={reduce ? undefined : "orbit-flow"}
              style={{ animationDelay: `${i * -0.35}s` }}
            />
          );
        })}
        <defs>
          <linearGradient id="orbit-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1670FF" stopOpacity="0.55" />
            <stop offset="1" stopColor="#1670FF" stopOpacity="0.15" />
          </linearGradient>
        </defs>
      </svg>

      {/* The mark */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-1/2 size-[180%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/20 blur-2xl" aria-hidden />
        {reduce
          ? null
          : [0, 1].map((k) => (
              <motion.span
                key={k}
                className="absolute left-1/2 top-1/2 size-full -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-blue-400/50"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut", delay: k * 1.6 }}
                aria-hidden
              />
            ))}
        <motion.div
          animate={reduce ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative drop-shadow-[0_18px_30px_rgba(22,112,255,0.35)]"
        >
          <LogoMark className="size-20 sm:size-24" title="Postory" />
        </motion.div>
      </div>

      {/* The networks */}
      {PLATFORMS.map((p, i) => {
        const s = SPOTS[i % SPOTS.length];
        return (
          <motion.div
            key={p}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.1 + i * 0.07, type: "spring", stiffness: 220, damping: 18 }}
          >
            <motion.div
              animate={reduce ? undefined : { y: [0, i % 2 ? -7 : 7, 0], rotate: [s.r, s.r * -0.4, s.r] }}
              transition={{ duration: 4.5 + (i % 3) * 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <span className="rounded-[18px] bg-surface p-1.5 shadow-lift ring-1 ring-line sm:rounded-[22px] sm:p-2">
                <PlatformIcon platform={p} tile className="size-10 rounded-[13px] sm:size-14 sm:rounded-[16px]" />
              </span>
              <span className="hidden text-[12.5px] font-medium text-muted sm:block">{PLATFORM_META[p].name}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
