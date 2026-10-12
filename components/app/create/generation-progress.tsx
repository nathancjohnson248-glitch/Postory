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

/**
 * When a story is too thin to write without guessing, Postory asks instead.
 * Shown where the posts would have appeared; nothing was charged.
 */
export function NeedsDetail({ questions }: { questions: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-4 rounded-3xl bg-blue-50/60 p-5 ring-1 ring-blue-100 sm:p-6"
      role="status"
    >
      <LogoMark className="mt-0.5 size-9 shrink-0" />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">Tell Postory a little more first</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
          There isn&apos;t enough here to write without guessing, and Postory doesn&apos;t make things up. Add the answers to your story, then generate again. This didn&apos;t use a generation.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {questions.map((q) => (
            <li key={q} className="flex gap-2 text-[14px] text-ink">
              <span className="mt-[9px] size-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
              {q}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
