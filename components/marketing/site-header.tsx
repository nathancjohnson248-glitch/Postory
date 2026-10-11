"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 transition-all duration-300", scrolled ? "bg-paper/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md" : "bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Postory home" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[14px] font-medium text-muted transition-colors hover:text-ink">
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
        <button type="button" className="grid size-10 place-items-center rounded-xl md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line bg-paper px-5 pb-6 pt-2 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {[...LINKS, { href: "/login", label: "Log in" }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-line py-3.5 text-[16px] font-medium">
                {l.label}
              </Link>
            ))}
          </nav>
          <Link href="/signup" className={buttonClasses({ size: "lg", className: "mt-5 w-full" })}>
            Start 3-day trial
          </Link>
        </div>
      ) : null}
    </header>
  );
}
