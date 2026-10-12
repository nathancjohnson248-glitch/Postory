"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
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

/** A floating pill that tightens as you scroll; on phones the menu opens as a card beneath it. */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
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
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          "pointer-events-auto mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full pl-4 pr-2 transition-[background-color,box-shadow,max-width] duration-500 ease-[var(--ease-out-soft)] sm:h-[60px] sm:pl-5",
          scrolled || open
            ? "max-w-5xl bg-surface/80 shadow-[0_8px_30px_-12px_rgba(12,12,14,0.18)] ring-1 ring-line backdrop-blur-xl"
            : "bg-surface/50 ring-1 ring-line/60 backdrop-blur-md",
        )}
      >
        <Link href="/" aria-label="Postory home" className="shrink-0 rounded-full">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
          {LINKS.map((l) => {
            const active = l.href === pathname;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors",
                  active ? "bg-wash text-ink" : "text-muted hover:bg-wash/70 hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link href="/login" className="hidden rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink md:inline-flex">
            Log in
          </Link>
          <AnimatePresence initial={false}>
            {open ? null : (
              <motion.span key="trial" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.18 }}>
                <Link href="/signup" className={buttonClasses({ size: "sm", variant: "accent", className: "group h-10 rounded-full px-4 text-[13.5px] sm:h-11 sm:px-5 sm:text-[14px]" })}>
                  Start free trial
                  <ArrowRight className="hidden size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 sm:block" aria-hidden />
                </Link>
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full ring-1 ring-line transition-colors hover:bg-wash md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span key={open ? "close" : "open"} initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.18 }}>
                {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto mx-auto mt-2 max-w-6xl origin-top overflow-hidden rounded-3xl bg-surface shadow-float ring-1 ring-line md:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col p-2">
              {LINKS.map((l, i) => (
                <motion.div key={l.href} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 + i * 0.035 }}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="flex rounded-2xl px-4 py-3 text-[17px] font-medium transition-colors hover:bg-wash">
                    {l.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="flex flex-col gap-2 border-t border-line p-4">
              <Link href="/signup" onClick={() => setOpen(false)} className={buttonClasses({ size: "lg", variant: "accent", className: "w-full rounded-full" })}>
                Start 3-day trial <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/login" onClick={() => setOpen(false)} className={buttonClasses({ size: "lg", variant: "ghost", className: "w-full rounded-full" })}>
                Log in
              </Link>
              <p className="pt-1 text-center text-[12.5px] text-muted">No password needed · Cancel anytime</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
