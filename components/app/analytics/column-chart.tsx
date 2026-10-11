"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Single-series column chart. One hue (no legend — the title names it),
 * columns capped at 24px with 4px rounded tops on a hairline baseline,
 * a per-column hover tooltip, and a table view for screen readers.
 */
export function ColumnChart({
  data,
  label,
  unit,
  height = 180,
  highlightLast = true,
}: {
  data: { label: string; value: number }[];
  label: string;
  unit: string;
  height?: number;
  highlightLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  return (
    <figure className="w-full">
      <div className="relative" style={{ height }}>
        {/* Gridlines */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-8 border-t border-line" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden>
            <span className="absolute -left-8 -translate-y-1/2 text-[11px] tabular-nums text-faint">{t}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end gap-0.5" role="img" aria-label={`${label}. ${data.map((d) => `${d.label}: ${d.value}`).join(", ")}`}>
          {data.map((d, i) => {
            const isLast = highlightLast && i === data.length - 1;
            return (
              <div
                key={d.label}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.label}: ${d.value} ${unit}`}
              >
                <div
                  className={cn("w-full max-w-6 rounded-t-[4px] transition-colors", isLast ? "bg-blue-500" : "bg-blue-300", hover === i && "bg-blue-600")}
                  style={{ height: d.value ? `${(d.value / top) * 100}%` : 0 }}
                />
                {hover === i ? (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-lift">
                    <span className="font-semibold tabular-nums">{d.value}</span> {unit}
                    <span className="text-white/60"> · {d.label}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-8 mt-2 flex gap-0.5" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label} className={cn("flex-1 truncate text-center text-[11px] text-faint", i % 2 === 1 && data.length > 8 && "invisible")}>
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function niceTicks(max: number) {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step - 1 && ticks.length < 7; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
