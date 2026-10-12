"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export const GENERATION_STAGES = [
  { id: "understanding", label: "Understanding your story" },
  { id: "writing", label: "Finding angles and writing platform versions" },
  { id: "checking", label: "Checking facts and limits" },
  { id: "saving", label: "Preparing your review" },
] as const;

export type StageId = (typeof GENERATION_STAGES)[number]["id"];

/** Postory at work: the mark bobs and its eyes glance across the page as it reads. */
export function WritingMark({ title = "Postory is writing", note = "Usually 15–30 seconds." }: { title?: string; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <motion.span
        className="mark-thinking grid size-11 place-items-center rounded-2xl bg-blue-50 ring-1 ring-blue-100"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <LogoMark className="size-8" />
      </motion.span>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-[13px] text-muted">{note}</p>
      </div>
    </div>
  );
}

/** Each step lights up when the server reports it — no simulated progress. */
export function GenerationProgress({ current }: { current: StageId | null }) {
  const index = current ? GENERATION_STAGES.findIndex((s) => s.id === current) : -1;
  return (
    <ol className="flex flex-col gap-3" aria-live="polite">
      {GENERATION_STAGES.map((stage, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={stage.id} className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-300",
                done ? "bg-blue-500 text-white" : active ? "bg-blue-50 ring-1 ring-blue-200" : "bg-wash",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.span key="done" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <Check className="size-3.5" aria-hidden />
                  </motion.span>
                ) : active ? (
                  <motion.span
                    key="active"
                    className="block size-2 rounded-full bg-blue-500"
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                ) : null}
              </AnimatePresence>
            </span>
            <span className={cn("text-[15px] transition-colors", done ? "text-muted" : active ? "font-medium text-ink" : "text-faint")}>
              {stage.label}
              {active ? "…" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
