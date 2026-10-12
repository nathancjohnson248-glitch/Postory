import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DeleteAccount } from "@/components/app/settings/forms";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" aria-label="Postory home" className="rounded-lg">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <DeleteAccount trigger="link" />
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-24">{children}</main>
    </div>
  );
}
