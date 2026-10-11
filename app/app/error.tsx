"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <h1 className="font-display text-[40px] leading-tight">This page didn&apos;t load.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Something went wrong on our side while loading it. Your stories and posts are safe. Try again, and if it keeps happening, let us know.
      </p>
      <Button className="mt-8" onClick={reset} icon={<RotateCcw className="size-4" />}>
        Try again
      </Button>
    </div>
  );
}
