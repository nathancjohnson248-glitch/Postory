"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Home,
  Inbox,
  Library,
  LogOut,
  Menu,
  PenLine,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Dialog } from "@/components/ui/dialog";
import type { Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export type ShellAccount = { id: string; platform: Platform; name: string; status: string };

type NavItem = { href: string; label: string; icon: typeof Home; badge?: number };

export function AppShell({
  children,
  user,
  accounts,
  planLabel,
  planTone,
  reviewCount,
  isAdmin = false,
}: {
  children: ReactNode;
  user: { name: string; email: string | null };
  accounts: ShellAccount[];
  planLabel: string;
  planTone: "ok" | "warn";
  reviewCount: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const primary: NavItem[] = [
    { href: "/app", label: "Home", icon: Home },
    { href: "/app/create", label: "Create", icon: PenLine },
    { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/app/inbox", label: "Inbox", icon: Inbox },
    { href: "/app/library", label: "Library", icon: Library, badge: reviewCount || undefined },
    { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  ];
  const secondary: NavItem[] = [
    ...(isAdmin ? [{ href: "/app/admin", label: "Admin", icon: ShieldCheck }] : []),
    { href: "/app/settings", label: "Settings", icon: Settings },
    { href: "/app/billing", label: "Billing", icon: CreditCard },
  ];

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`));
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navLink = (item: NavItem, onClick?: () => void) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-9 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-all duration-200",
          active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(12_12_14/0.06),0_0_0_1px_rgb(12_12_14/0.06)]" : "text-muted hover:bg-wash hover:text-ink",
        )}
      >
        <Icon className={cn("size-[17px] transition-colors", active ? "text-blue-600" : "text-faint group-hover:text-ink-soft")} aria-hidden />
        <span className="flex-1">{item.label}</span>
        {item.badge ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold leading-5 text-white" aria-label={`${item.badge} need review`}>
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Link href="/app" className="mb-6 w-fit rounded-lg px-2" aria-label="Postory home">
          <Logo />
        </Link>
        <Link
          href="/app/create"
          className="mb-6 flex h-11 items-center justify-center gap-2 rounded-[14px] bg-ink text-[14px] font-medium text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_6px_16px_-8px_rgb(12_12_14/0.5)] transition-all duration-200 hover:bg-ink-soft active:scale-[0.985]"
        >
          <Plus className="size-4" aria-hidden />
          Create story
        </Link>

        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {primary.map((item) => navLink(item))}
        </nav>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between px-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Connected accounts</p>
            <Link href="/app/settings#accounts" className="rounded text-faint transition-colors hover:text-ink" aria-label="Manage connected accounts">
              <Plus className="size-3.5" />
            </Link>
          </div>
          {accounts.length ? (
            <ul className="flex flex-col gap-0.5">
              {accounts.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <Link href="/app/settings#accounts" className="flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] text-ink-soft transition-colors hover:bg-wash">
                    <PlatformIcon platform={a.platform} tile className="size-5 rounded-md" />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span
                      className={cn("size-1.5 rounded-full", a.status === "connected" ? "bg-success" : "bg-warning")}
                      aria-label={a.status === "connected" ? "Connected" : "Needs attention"}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link href="/app/settings#accounts" className="mx-1 block rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-muted transition-colors hover:border-ink-soft hover:text-ink">
              Connect your first network
            </Link>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-4">
          {secondary.map((item) => navLink(item))}
          <div className="mt-3 flex items-center gap-3 rounded-2xl px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-[13px] font-semibold text-blue-700">{initials || "P"}</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">{user.name}</p>
              <Link href="/app/billing" className={cn("truncate text-xs hover:underline", planTone === "warn" ? "text-warning" : "text-muted")}>
                {planLabel}
              </Link>
            </div>
            <form action="/auth/signout" method="post">
              <button className="grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-wash hover:text-ink" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/85 px-4 backdrop-blur-md lg:hidden">
        <Link href="/app" aria-label="Postory home" className="rounded-lg">
          <Logo markClassName="h-[22px]" className="[&>span:nth-child(2)]:text-[18px]" />
        </Link>
        <Link href="/app/billing" className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-line", planTone === "warn" ? "text-warning" : "text-muted")}>
          {planLabel}
        </Link>
      </header>

      <main id="main" className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
          {[primary[0], primary[2]].map((item) => (
            <MobileTab key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <div className="flex justify-center">
            <Link href="/app/create" className="-mt-5 grid size-14 place-items-center rounded-2xl bg-blue-500 text-white shadow-[0_10px_24px_-8px_rgb(47_91_255/0.7)] transition-transform active:scale-95" aria-label="Create story">
              <Plus className="size-6" />
            </Link>
          </div>
          <MobileTab item={primary[4]} active={isActive(primary[4].href)} />
          <button type="button" onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted" aria-haspopup="dialog">
            <Menu className="size-5" aria-hidden />
            More
          </button>
        </div>
      </nav>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" className="lg:hidden">
        <div className="flex flex-col gap-1">
          {[primary[1], primary[3], primary[5], ...secondary].map((item) => navLink(item, () => setMenuOpen(false)))}
          <form action="/auth/signout" method="post" className="mt-2 border-t border-line pt-2">
            <button className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-muted hover:bg-wash hover:text-ink">
              <LogOut className="size-[17px]" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </Dialog>
    </div>
  );
}

function MobileTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-ink" : "text-muted")}>
      <Icon className={cn("size-5", active && "text-blue-600")} aria-hidden />
      {item.label}
      {item.badge ? <span className="absolute right-[22%] top-1.5 size-2 rounded-full bg-blue-500" aria-label={`${item.badge} need review`} /> : null}
    </Link>
  );
}
