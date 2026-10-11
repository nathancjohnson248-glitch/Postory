"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

function format(value: number, kind: "usd" | "number") {
  if (kind === "usd") {
    const dollars = value / 100;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(dollars) ? 0 : 2 }).format(dollars);
  }
  return Math.round(value).toLocaleString("en-US");
}

/** A headline number that counts up the first time it scrolls into view. */
export function Stat({ label, value, kind = "number", hint, tone = "default" }: { label: string; value: number; kind?: "usd" | "number"; hint?: string; tone?: "default" | "accent" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce || value === 0) {
      el.textContent = format(value, kind);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = format(kind === "usd" ? Math.round(v) : v, kind);
      },
    });
    return () => controls.stop();
  }, [inView, value, kind, reduce]);

  return (
    <div className={cn("rounded-2xl p-4 ring-1", tone === "accent" ? "bg-blue-500 text-white ring-blue-500" : "bg-paper/60 ring-line")}>
      <p className={cn("font-mono text-[10.5px] uppercase tracking-[0.12em]", tone === "accent" ? "text-white/70" : "text-faint")}>{label}</p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
        <span ref={ref}>{format(0, kind)}</span>
      </p>
      {hint ? <p className={cn("mt-2 text-[12px]", tone === "accent" ? "text-white/75" : "text-muted")}>{hint}</p> : null}
    </div>
  );
}
