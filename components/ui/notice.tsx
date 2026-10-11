import type { ReactNode } from "react";
import { AlertTriangle, Info, CircleCheck, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger" | "success";

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-blue-50/70 ring-blue-100 text-ink", Icon: Info },
  warning: { box: "bg-warning-wash ring-[#f6e1bb] text-ink", Icon: AlertTriangle },
  danger: { box: "bg-danger-wash ring-[#f6cfcd] text-ink", Icon: OctagonAlert },
  success: { box: "bg-success-wash ring-[#cfeadf] text-ink", Icon: CircleCheck },
};

const iconTone: Record<Tone, string> = {
  info: "text-blue-600",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl p-4 ring-1 ring-inset", box, className)}>
      <Icon className={cn("mt-0.5 size-[18px] shrink-0", iconTone[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {children ? <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
