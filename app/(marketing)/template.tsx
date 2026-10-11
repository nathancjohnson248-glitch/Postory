import { PageTransition } from "@/components/motion/page-transition";

export default function MarketingTemplate({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <div>{children}</div>
    </PageTransition>
  );
}
