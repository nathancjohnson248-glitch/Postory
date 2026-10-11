"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A soft light that follows the pointer across the surface. */
export function Spotlight({ children, className, color = "rgb(47 91 255 / 0.30)" }: { children: ReactNode; className?: string; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={cn("group/spotlight relative", className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover/spotlight:opacity-100"
        style={{ background: `radial-gradient(560px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${color}, transparent 62%)` }}
      />
      {children}
    </div>
  );
}
