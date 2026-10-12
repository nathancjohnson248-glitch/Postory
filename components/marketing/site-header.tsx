"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/tools/character-counter", label: "Free tools" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled || open ? "bg-paper/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Postory home" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative rounded-lg px-3 py-2 text-[14px] font-medium text-muted transition-colors after:absolute after:inset-x-3 after:bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-lg px-3 py-2 text-[14px] font-medium text-ink-soft hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className={buttonClasses({ size: "sm", className: "h-9 px-4" })}>
            Start 3-day trial
          </Link>
        </div>
        <div className="flex items-center gap-1.5 md:hidden">
          <AnimatePresence initial={false}>
            {open ? null : (
              <motion.span
                key="trial"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.18 }}
              >
                <Link href="/signup" className={buttonClasses({ size: "sm", variant: "accent", className: "h-9 rounded-full px-3.5 text-[13px]" })}>
                  Start free trial
                </Link>
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            className="-mr-2 grid size-11 place-items-center rounded-xl"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Menu"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={open ? "close" : "open"}
                initial={{ rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 45, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <div className="px-5 pb-6 pt-2">
              <nav aria-label="Mobile" className="flex flex-col">
                {[...LINKS, { href: "/login", label: "Log in" }].map((l, i) => (
                  <motion.div key={l.href} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                    <Link href={l.href} onClick={() => setOpen(false)} className="flex border-b border-line py-3.5 text-[17px] font-medium">
                      {l.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <Link href="/signup" onClick={() => setOpen(false)} className={buttonClasses({ size: "lg", variant: "accent", className: "mt-5 w-full" })}>
                Start 3-day trial
              </Link>
              <p className="mt-3 text-center text-[13px] text-muted">No password needed · Cancel anytime</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
