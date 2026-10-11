import type { ReactNode } from "react";

/** Ranked horizontal bars: label in ink, value at the tip, one hue. */
export function BarList({ items, unit }: { items: { key: string; label: ReactNode; value: number }[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] items-center gap-3">
          <span className="flex min-w-0 items-center gap-2 truncate text-[13.5px] text-ink-soft">{item.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-3 rounded-r-[4px] bg-blue-400" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} aria-hidden />
            <span className="text-[12.5px] font-medium tabular-nums text-ink" aria-label={`${item.value} ${unit}`}>
              {item.value}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
