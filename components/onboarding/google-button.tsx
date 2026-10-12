"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { siGoogle } from "simple-icons";
import { Button } from "@/components/ui/button";

export function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path d={siGoogle.path} fill="currentColor" />
    </svg>
  );
}

export function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="lg" className="w-full" loading={pending} icon={<GoogleGlyph />}>
      {label}
    </Button>
  );
}

/** Google through Privy: a page of its own handles the round trip. */
export function GoogleLink({ label, next }: { label: string; next: string }) {
  return (
    <Link
      href={`/auth/google?next=${encodeURIComponent(next)}`}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-surface px-5 text-[15px] font-medium text-ink shadow-[0_1px_2px_rgba(12,12,14,0.05)] ring-1 ring-line transition-[background-color,box-shadow,transform] hover:bg-wash active:scale-[0.99]"
    >
      <GoogleGlyph />
      {label}
    </Link>
  );
}

