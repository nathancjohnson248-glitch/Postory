"use client";

import { useFormStatus } from "react-dom";
import { siGoogle } from "simple-icons";
import { Button } from "@/components/ui/button";

function GoogleGlyph() {
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
