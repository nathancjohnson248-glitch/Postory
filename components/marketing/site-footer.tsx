import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { site } from "@/lib/site";

const COLUMNS = [
  { title: "Product", links: [{ href: "/features", label: "Features" }, { href: "/pricing", label: "Pricing" }, { href: "/changelog", label: "Changelog" }, { href: "/changelog#roadmap", label: "Roadmap" }] },
  { title: "Free tools", links: [{ href: "/tools/character-counter", label: "Character counter" }, { href: "/features#how-it-works", label: "How it works" }] },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: `mailto:${site.founder.email}?subject=Postory%20help`, label: "Help" }, { href: `mailto:${site.founder.email}`, label: "Contact" }] },
  { title: "Legal", links: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-16 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted">Your business doesn&apos;t stop. Neither should your social.</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[14px] text-ink-soft transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            Built by {site.founder.name} · © {new Date().getFullYear()} {site.name}
          </p>
          <div className="flex gap-5">
            <a href={site.founder.xUrl} target="_blank" rel="noreferrer noopener" className="hover:text-ink">
              X
            </a>
            <a href={`mailto:${site.founder.email}`} className="hover:text-ink">
              Email
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
