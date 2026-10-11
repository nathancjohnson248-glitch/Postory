import { PageTransition } from "@/components/motion/page-transition";

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <div>{children}</div>
    </PageTransition>
  );
}
