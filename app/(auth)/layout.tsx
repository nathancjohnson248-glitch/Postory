import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { StoryFanout } from "@/components/product/story-fanout";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="w-fit rounded-lg" aria-label="Postory home">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</main>
        <p className="text-xs text-faint">
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-wash lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div className="hairline-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto w-full max-w-xl">
          <p className="mb-8 max-w-md font-display text-[40px] leading-[1.05] tracking-[-0.015em] text-ink">
            Tell Postory what happened. <span className="italic text-blue-600">It handles the rest.</span>
          </p>
          <StoryFanout compact />
        </div>
      </aside>
    </div>
  );
}
