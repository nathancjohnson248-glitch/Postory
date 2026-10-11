import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium tracking-[-0.01em] transition-[background-color,box-shadow,color,transform,opacity] duration-200 ease-[var(--ease-out-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.985]";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(12_12_14/0.2)] hover:bg-ink-soft",
  accent: "bg-blue-500 text-white shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_16px_-6px_rgb(47_91_255/0.6)] hover:bg-blue-600",
  secondary: "bg-surface text-ink shadow-hairline hover:bg-wash",
  ghost: "text-ink-soft hover:bg-wash hover:text-ink",
  danger: "bg-danger text-white hover:bg-[#a72a26]",
  link: "text-blue-600 underline-offset-4 hover:underline active:scale-100",
};

const sizes: Record<Size, string> = {
  sm: "h-8 rounded-[10px] px-3 text-[13px]",
  md: "h-10 rounded-xl px-4 text-sm",
  lg: "h-12 rounded-[14px] px-5 text-[15px]",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], variant === "link" ? "h-auto p-0" : sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant, size, loading, icon, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant, size, icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
