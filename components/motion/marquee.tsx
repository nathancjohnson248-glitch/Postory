import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** An endless, edge-faded strip. Pauses on hover; still under reduced motion. */
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        className,
      )}
    >
      <div className="marquee-track flex w-max group-hover:[animation-play-state:paused]">
        <div className="flex shrink-0 items-center gap-x-10 pr-10">{children}</div>
        <div className="flex shrink-0 items-center gap-x-10 pr-10" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
