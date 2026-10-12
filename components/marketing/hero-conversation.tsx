"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { DemoAvatar } from "@/components/product/demo-avatar";
import { FounderAvatar } from "@/components/marketing/founder-avatar";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The whole idea in one glance: a founder says what happened, Postory drafts
 * it for every network, and the post waits on the calendar. Plays once when
 * it scrolls into view (instantly for reduced motion). An example, labelled.
 */
export function HeroConversation({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const timers = [setTimeout(() => setStep(1), 150), setTimeout(() => setStep(2), 900), setTimeout(() => setStep(3), 2100), setTimeout(() => setStep(4), 2900)];
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);
  // Reduced motion: show the finished state straight away.
  const shown = reduce ? 4 : step;

  return (
    <div ref={ref} className={cn("relative mx-auto grid max-w-4xl grid-cols-1 gap-4 text-left sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] sm:items-start sm:gap-5", className)}>
      {/* The conversation */}
      <div className="relative rounded-[28px] bg-surface p-4 shadow-lift ring-1 ring-line sm:-rotate-[1.2deg] sm:p-5">
        <AnimatePresence>
          {shown >= 1 ? (
            <motion.div key="founder" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: EASE }} className="flex items-end gap-2.5">
              <FounderAvatar className="size-8" />
              <p className="max-w-[88%] rounded-[22px] rounded-bl-md bg-ink px-4 py-3 text-[15px] leading-snug text-white shadow-[0_8px_20px_-12px_rgba(12,12,14,0.6)] sm:text-[15.5px]">
                finally shipped dark mode. 212 people asked for it on the feedback board
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-4 min-h-[76px] pl-1">
          <AnimatePresence mode="wait">
            {shown === 2 ? (
              <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2.5">
                <LogoMark className="size-7" />
                <span className="flex gap-1 rounded-full bg-wash px-3 py-2.5" aria-label="Postory is writing">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-1.5 rounded-full bg-muted"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </span>
              </motion.div>
            ) : shown >= 3 ? (
              <motion.div key="reply" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className="flex items-start gap-2.5">
                <LogoMark className="size-7" />
                <div>
                  <p className="text-[15px] leading-snug text-ink-soft">
                    Drafted it for <strong className="font-semibold text-ink">X, LinkedIn and Instagram</strong>. Approve it when it reads right.
                  </p>
                  <div className="mt-2.5 flex gap-1.5">
                    {(["x", "linkedin", "instagram"] as const).map((p, i) => (
                      <motion.span key={p} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 300, damping: 20 }}>
                        <PlatformIcon platform={p} tile className="size-6 rounded-lg" />
                      </motion.span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* The scheduled post */}
      <motion.div
        initial={false}
        animate={shown >= 4 ? { opacity: 1, y: 0, rotate: reduce ? 0 : 1.4 } : { opacity: 0, y: 18, rotate: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="overflow-hidden rounded-[28px] bg-surface shadow-lift ring-1 ring-line sm:mt-10"
      >
        <div className="flex items-center justify-between gap-3 bg-blue-50/70 px-4 py-2.5">
          <div className="flex -space-x-1.5">
            {(["x", "linkedin", "instagram"] as const).map((p) => (
              <span key={p} className="rounded-full ring-2 ring-[#f1f6ff]">
                <PlatformIcon platform={p} tile className="size-6 rounded-full" />
              </span>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-700">
            <span className="grid size-4 place-items-center rounded-full bg-blue-600 text-white">
              <Check className="size-2.5" strokeWidth={3} aria-hidden />
            </span>
            Scheduled · Tue 9:30 AM
          </span>
        </div>
        <div className="flex gap-3.5 p-4">
          <PhoneShot />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <DemoAvatar className="size-6" />
              <p className="truncate text-[13px] font-semibold">Fernwood</p>
              <span className="rounded-full bg-wash px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wider text-muted ring-1 ring-line">Example</span>
            </div>
            <p className="mt-2 text-[14px] leading-snug text-ink">Dark mode is here. 212 of you asked for it — now your streaks are easy on the eyes at 11pm.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** A tiny dark-mode screen of the example app, drawn rather than photographed. */
function PhoneShot() {
  return (
    <div className="relative h-[92px] w-[60px] shrink-0 rounded-[14px] bg-[#0f1115] p-[5px] shadow-[0_8px_18px_-10px_rgba(12,12,14,0.7)] ring-1 ring-black/40" aria-hidden>
      <div className="flex h-full flex-col items-center justify-center gap-1.5 rounded-[10px] bg-[#171a21]">
        <div className="relative size-8">
          <svg viewBox="0 0 36 36" className="size-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#22303a" strokeWidth="4" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#5FD39A" strokeWidth="4" strokeLinecap="round" strokeDasharray="88" strokeDashoffset="22" />
          </svg>
        </div>
        <div className="h-1 w-7 rounded-full bg-white/25" />
        <div className="flex gap-0.5">
          {[1, 1, 1, 0.4, 1, 1, 0.4].map((o, i) => (
            <span key={i} className="size-1 rounded-full bg-[#5FD39A]" style={{ opacity: o }} />
          ))}
        </div>
      </div>
    </div>
  );
}
