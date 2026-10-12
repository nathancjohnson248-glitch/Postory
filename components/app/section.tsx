import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  href,
  hrefLabel = "View all",
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  href?: string;
  hrefLabel?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl bg-surface p-2 shadow-soft ring-1 ring-line", className)}>
      <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
        {action ??
          (href ? (
            <Link href={href} className="flex shrink-0 items-center gap-1 rounded-lg text-[13px] font-medium text-muted transition-colors hover:text-ink">
              {hrefLabel}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          ) : null)}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between lg:mb-10">
      <div className="min-w-0">
        {eyebrow ? <p className="fade-rise mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{eyebrow}</p> : null}
        <h1 className="fade-rise font-display text-[44px] leading-[0.98] tracking-[-0.02em] text-ink text-balance sm:text-[56px]" style={{ animationDelay: "0.04s" }}>
          {title}
        </h1>
        {description ? (
          <p className="fade-rise mt-3 max-w-xl text-[15px] leading-relaxed text-muted text-pretty" style={{ animationDelay: "0.1s" }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="fade-rise flex shrink-0 flex-wrap items-center gap-2" style={{ animationDelay: "0.14s" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
