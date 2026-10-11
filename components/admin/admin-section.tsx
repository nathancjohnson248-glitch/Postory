"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT = "postory-admin-sections";
const key = (id: string) => `postory-admin:${id}`;

function readOpen(id: string, fallback: boolean) {
  try {
    const value = window.localStorage.getItem(key(id));
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * A collapsible admin panel. Whether it's open is remembered per browser,
 * so the page opens the way it was left.
 */
export function AdminSection({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const open = useSyncExternalStore(subscribe, () => readOpen(id, defaultOpen), () => defaultOpen);

  const toggle = () => {
    try {
      window.localStorage.setItem(key(id), open ? "0" : "1");
    } catch {
      // Storage can be blocked; the panel just won't be remembered.
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <section className="overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-line">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`admin-${id}`}
        className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-wash/60 sm:px-6"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold tracking-[-0.01em]">{title}</span>
          {summary ? <span className="mt-0.5 block truncate text-[13px] text-muted">{summary}</span> : null}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className={cn("grid size-8 shrink-0 place-items-center rounded-full text-muted ring-1 ring-line transition-colors group-hover:text-ink")}
          aria-hidden
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`admin-${id}`}
            key="content"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ height: { type: "spring", stiffness: 260, damping: 32 }, opacity: { duration: 0.2 } }}
          >
            <div className="border-t border-line px-5 pb-6 pt-5 sm:px-6">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
