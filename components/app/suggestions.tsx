"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Lightbulb, X } from "lucide-react";
import { toast } from "sonner";
import { acceptLearning, dismissSuggestion } from "@/app/_actions/suggestions";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { showError } from "@/lib/client/show-error";
import type { Suggestion } from "@/lib/data/suggestions";
import { cn } from "@/lib/utils";

const TONE = {
  urgent: { icon: AlertTriangle, ring: "ring-warning/30", chip: "bg-warning-wash text-warning", label: "Needs you" },
  opportunity: { icon: ArrowRight, ring: "ring-line", chip: "bg-blue-50 text-blue-700", label: "Opportunity" },
  learning: { icon: Lightbulb, ring: "ring-line", chip: "bg-wash text-ink-soft", label: "Postory noticed" },
} as const;

export function PostorySuggests({ suggestions }: { suggestions: Suggestion[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const visible = suggestions.filter((s) => !hidden.has(s.id));
  if (!visible.length) return null;

  const hide = (id: string) => setHidden((h) => new Set(h).add(id));

  return (
    <section aria-labelledby="suggests" className="mb-8">
      <h2 id="suggests" className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
        <LogoMark className="size-5" blink={false} /> Postory suggests
      </h2>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {visible.map((s) => {
          const tone = TONE[s.tone];
          return (
            <li key={s.id} className={cn("flex flex-col rounded-3xl bg-surface p-5 shadow-soft ring-1", tone.ring)}>
              <div className="flex items-start justify-between gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium", tone.chip)}>
                  <tone.icon className="size-3" aria-hidden /> {tone.label}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="grid size-6 place-items-center rounded-full text-faint transition-colors hover:bg-wash hover:text-ink"
                  onClick={() => {
                    hide(s.id);
                    void dismissSuggestion(s.id);
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{s.title}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
              <div className="mt-auto pt-4">
                {s.action.kind === "link" ? (
                  <Link href={s.action.href} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-ink px-3 text-[13px] font-medium text-white transition-colors hover:bg-ink-soft">
                    {s.action.label} <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="accent"
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await acceptLearning(s.id);
                        if (!result.ok) return showError(result.error);
                        hide(s.id);
                        toast.success("Saved. Postory will write that way from now on.");
                      })
                    }
                  >
                    {s.action.label}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
