import { cn } from "@/lib/utils";

/** The example founder (Maya, who makes Fernwood) — a generated portrait, only for labelled demos. */
export function FounderAvatar({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static avatar; next/image adds nothing here
    <img src="/demo/founder.webp" alt="" width={128} height={128} className={cn("size-9 shrink-0 rounded-full object-cover ring-2 ring-white", className)} aria-hidden />
  );
}
