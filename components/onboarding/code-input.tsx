"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * One-time code entry. A single real input sits over the cells, so paste,
 * SMS/email autofill ("one-time-code") and mobile keyboards all behave
 * natively; the cells are only a picture of its value. Fills → submits.
 */
export function CodeInput({
  length,
  name = "code",
  invalid = false,
  disabled = false,
  autoSubmit = true,
  onComplete,
}: {
  length: number;
  name?: string;
  invalid?: boolean;
  disabled?: boolean;
  autoSubmit?: boolean;
  onComplete?: (value: string) => void;
}) {
  const reduce = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      className="relative"
      initial={{ x: 0 }}
      animate={invalid && !reduce ? { x: [0, -9, 8, -6, 4, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
    >
      <input
        ref={input}
        name={name}
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, length);
          setValue(next);
          if (next.length === length) {
            onComplete?.(next);
            if (autoSubmit) e.currentTarget.form?.requestSubmit();
          }
        }}
        onFocus={(e) => {
          setFocused(true);
          // Keep the caret at the end so typing always appends.
          const el = e.currentTarget;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        }}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        autoFocus
        disabled={disabled}
        spellCheck={false}
        aria-label={`${length}-digit code`}
        aria-invalid={invalid || undefined}
        className="absolute inset-0 z-10 h-full w-full cursor-text appearance-none bg-transparent text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent disabled:cursor-not-allowed"
      />
      <div aria-hidden className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const active = focused && (i === value.length || (value.length === length && i === length - 1));
          return (
            <div
              key={i}
              className={cn(
                "relative grid h-14 place-items-center rounded-xl bg-surface font-mono text-[24px] font-medium text-ink shadow-[0_1px_0_rgb(12_12_14/0.03)] ring-1 transition-[box-shadow,background-color] duration-200",
                active ? "ring-2 ring-blue-500" : char ? "ring-line-strong" : "ring-line",
                invalid && !active && "ring-danger/50 bg-danger-wash/40",
                disabled && "opacity-60",
                length > 6 ? "h-12 text-[20px]" : "",
              )}
            >
              <AnimatePresence initial={false}>
                {char ? (
                  <motion.span
                    key={`${i}-${char}`}
                    initial={reduce ? false : { opacity: 0, y: 8, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.08 } }}
                    transition={{ type: "spring", stiffness: 520, damping: 30 }}
                    className="absolute"
                  >
                    {char}
                  </motion.span>
                ) : null}
              </AnimatePresence>
              {active && !char ? <span className="h-6 w-px animate-caret bg-ink" /> : null}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
