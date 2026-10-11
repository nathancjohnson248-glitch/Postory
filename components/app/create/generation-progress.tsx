"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const GENERATION_STAGES = [
  { id: "understanding", label: "Understanding your story" },
  { id: "writing", label: "Finding angles and writing platform versions" },
  { id: "checking", label: "Checking facts and limits" },
  { id: "saving", label: "Preparing your review" },
] as const;

export type StageId = (typeof GENERATION_STAGES)[number]["id"];

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
