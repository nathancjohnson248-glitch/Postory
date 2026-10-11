import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-10 font-display text-[56px] leading-none tracking-[-0.02em]">Nothing here.</h1>
      <p className="mt-4 max-w-sm text-[15px] text-muted">That page doesn&apos;t exist, or it moved.</p>
      <Link href="/" className={buttonClasses({ className: "mt-8" })}>
        Back to Postory
      </Link>
    </main>
  );
}
