"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const SHOW_AFTER_MS = 120;
const GIVE_UP_MS = 12_000;

function isInternalNavigation(event: MouseEvent): URL | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page (or just a hash jump): nothing to wait for.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url;
}

/**
 * A slim bar across the top while a page is on its way. Server-rendered
 * pages take a moment; this says "got it" the instant you click. Fast
 * navigations finish before it ever appears.
 */
export function NavigationProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const search = useSearchParams();
  const timers = useRef<{ show?: number; giveUp?: number }>({});
  const active = useRef(false);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;

    const show = () => {
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.transform = "scaleX(0)";
      void el.getBoundingClientRect();
      el.style.transition = "transform 9s cubic-bezier(0.08, 0.7, 0.2, 1)";
      el.style.transform = "scaleX(0.92)";
    };

    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigation(event)) return;
      window.clearTimeout(timers.current.show);
      window.clearTimeout(timers.current.giveUp);
      active.current = true;
      timers.current.show = window.setTimeout(show, SHOW_AFTER_MS);
      timers.current.giveUp = window.setTimeout(() => {
        active.current = false;
        el.style.transition = "opacity 0.3s ease";
        el.style.opacity = "0";
      }, GIVE_UP_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The route changed: finish the bar.
  useEffect(() => {
    const el = bar.current;
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.giveUp);
    if (!el || !active.current) return;
    active.current = false;
    if (el.style.opacity !== "1") return;
    el.style.transition = "transform 0.22s ease-out, opacity 0.35s ease 0.18s";
    el.style.transform = "scaleX(1)";
    el.style.opacity = "0";
  }, [pathname, search]);

  return (
    <div
      ref={bar}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] origin-left bg-blue-500 opacity-0 shadow-[0_0_10px_rgb(47_91_255/0.6)]"
      style={{ transform: "scaleX(0)" }}
    />
  );
}
