import { PageTransition } from "@/components/motion/page-transition";

export default function StartTemplate({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <div>{children}</div>
    </PageTransition>
  );
}
