import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const ONBOARDING_STEPS = [
  { id: "about", label: "You" },
  { id: "business", label: "Business" },
  { id: "voice", label: "Voice" },
  { id: "social", label: "Networks" },
  { id: "story", label: "First story" },
  { id: "plan", label: "Trial" },
] as const;

export function StepRail({ current }: { current: string }) {
  const index = ONBOARDING_STEPS.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Setup progress">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = i < index;
          const active = i === index;
          return (
            <li key={step.id} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-colors",
                  active ? "bg-ink text-white" : done ? "bg-blue-50 text-blue-700" : "text-faint",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : <span className="font-mono">{i + 1}</span>}
                <span className={cn(!active && "hidden sm:inline")}>{step.label}</span>
              </span>
              {i < ONBOARDING_STEPS.length - 1 ? <span className="h-px w-2 bg-line-strong sm:w-6" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
