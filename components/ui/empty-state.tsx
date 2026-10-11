import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-wash text-ink-soft">{icon}</div> : null}
      <h3 className="font-display text-[28px] leading-tight tracking-[-0.01em] text-ink">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted text-pretty">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
