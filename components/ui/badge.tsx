import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "blue" | "success" | "warning" | "danger" | "ink";

const tones: Record<Tone, string> = {
  neutral: "bg-wash text-ink-soft ring-line",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  success: "bg-success-wash text-success ring-[#cfeadf]",
  warning: "bg-warning-wash text-warning ring-[#f6e1bb]",
  danger: "bg-danger-wash text-danger ring-[#f6cfcd]",
  ink: "bg-ink text-white ring-ink",
};

export function Badge({ tone = "neutral", dot, className, children, ...props }: ComponentProps<"span"> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
