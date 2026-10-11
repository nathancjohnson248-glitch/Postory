import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p>
      <h1 className="mt-5 max-w-4xl font-display text-[52px] leading-[0.96] tracking-[-0.025em] text-balance sm:text-[84px]">{title}</h1>
      {body ? <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-muted text-pretty">{body}</p> : null}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 sm:px-8 [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_li]:mb-1.5 [&_p]:mb-4 [&_p]:text-[16px] [&_p]:leading-relaxed [&_p]:text-ink-soft [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[16px] [&_ul]:leading-relaxed [&_ul]:text-ink-soft [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2">
      {children}
    </div>
  );
}
