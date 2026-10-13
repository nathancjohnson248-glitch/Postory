"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, HelpCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { generatePlanAction } from "@/app/_actions/plan";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/ai/types";

const BASIS: Record<Plan["ideas"][number]["basedOn"], string> = {
  recent_story: "From a recent story",
  memory: "From business memory",
  network_gap: "A quiet network",
  follow_up: "A follow-up",
};

const STEPS = ["Reading your recent stories", "Checking what's scheduled", "Finding what's worth posting"];

export function Planner({ initial, generatedAt, horizon, enabled }: { initial: Plan | null; generatedAt: string | null; horizon: number; enabled: boolean }) {
  const [plan, setPlan] = useState(initial);
  const [when, setWhen] = useState(generatedAt);
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);

  function run() {
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    start(async () => {
      const result = await generatePlanAction();
      clearInterval(timer);
      if (!result.ok) return void toast.error(result.error.message);
      setPlan(result.data);
      setWhen("just now");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
        <div className="flex items-center gap-3">
          <LogoMark className="size-9" blink={pending} />
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.01em]">{plan ? `Your next ${horizon} days` : `Plan the next ${horizon} days`}</p>
            <p className="text-[13px] text-muted">{pending ? STEPS[step] + "…" : when ? `Planned ${when}. Uses one AI conversation.` : "Uses one AI conversation from your plan."}</p>
          </div>
        </div>
        <Button variant={plan ? "secondary" : "accent"} loading={pending} disabled={!enabled} icon={plan ? <RefreshCw className="size-4" aria-hidden /> : undefined} onClick={run}>
          {plan ? "Plan again" : "Plan my posts"}
        </Button>
      </div>

      {!enabled ? <p className="px-1 text-[13px] text-muted">Planning needs an active plan and Postory&apos;s AI.</p> : null}

      <AnimatePresence mode="wait">
        {plan ? (
          <motion.div key={when ?? "plan"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <p className="max-w-2xl font-display text-[22px] leading-snug tracking-[-0.015em] text-ink">{plan.summary}</p>

            {plan.ideas.length ? (
              <ol className="stagger-in grid grid-cols-1 gap-4 lg:grid-cols-2">
                {plan.ideas.map((idea, i) => (
                  <li key={i} className="flex flex-col rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line">
                    <div className="flex items-center justify-between gap-3 text-[12px] text-muted">
                      <span className="font-mono uppercase tracking-[0.12em]">{idea.day ?? "Any day"}</span>
                      <span>{BASIS[idea.basedOn]}</span>
                    </div>
                    <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.015em]">{idea.title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{idea.why}</p>
                    {idea.question ? (
                      <p className="mt-3 flex gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-[13px] leading-relaxed text-blue-800">
                        <HelpCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {idea.question}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <div className="flex -space-x-1">
                        {idea.networks.map((n) => (
                          <PlatformIcon key={n} platform={n} tile className="size-6 rounded-md ring-2 ring-surface" />
                        ))}
                      </div>
                      <Link
                        href={`/app/create?text=${encodeURIComponent(idea.storyPrompt)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-ink px-3 text-[13px] font-medium text-white transition-colors hover:bg-ink-soft"
                      >
                        Tell this story <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}

            {plan.questions.length ? (
              <section className="rounded-3xl bg-wash p-5">
                <h2 className="text-[14px] font-semibold">Answer these and Postory can plan better</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {plan.questions.map((q) => (
                    <li key={q}>
                      <Link href={`/app/create?text=${encodeURIComponent(`${q}\n\n`)}`} className="text-[14px] text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink">
                        {q}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
            <p className="font-display text-[22px] tracking-[-0.015em]">No plan yet.</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">
              The more stories you&apos;ve told Postory, the better the plan. With none yet, it will mostly ask you questions, and that&apos;s fine too.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
