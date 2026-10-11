import { ViewTransition, type ReactNode } from "react";

/**
 * Page-level view transition: the outgoing page fades, the incoming one rises
 * in. Runs on the browser's View Transitions API during route navigations and
 * is skipped where unsupported or when the user prefers reduced motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
