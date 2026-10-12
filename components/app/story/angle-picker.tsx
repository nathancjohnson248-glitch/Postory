"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { rewriteStoryAroundAngle } from "@/app/_actions/posts";
import { Spinner } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The story's angles. With AI on, tapping one rewrites the open drafts around it. */
export function AnglePicker({ storyId, angles, current, aiEnabled }: { storyId: string; angles: string[]; current: string | null; aiEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function pick(angle: string) {
    setBusy(angle);
    const result = await rewriteStoryAroundAngle({ storyId, angle });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Rewrote ${result.data.rewritten} ${result.data.rewritten === 1 ? "draft" : "drafts"} around “${angle}”.`);
    result.data.warnings.forEach((w) => toast.warning(w));
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {angles.map((a) =>
        aiEnabled ? (
          <button
            key={a}
            type="button"
            onClick={() => pick(a)}
            disabled={busy !== null}
            title="Rewrite the drafts around this angle"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium ring-1 ring-inset transition-all hover:-translate-y-px disabled:opacity-50",
              current === a ? "bg-blue-600 text-white ring-blue-600" : "bg-blue-50 text-blue-700 ring-blue-100 hover:ring-blue-300",
            )}
          >
            {busy === a ? <Spinner className="size-3" /> : <Sparkles className="size-3" aria-hidden />}
            {a}
          </button>
        ) : (
          <span key={a} className="rounded-full bg-blue-50 px-2.5 py-1 text-[12.5px] font-medium text-blue-700">
            {a}
          </span>
        ),
      )}
    </div>
  );
}
