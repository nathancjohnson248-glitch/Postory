import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Mark = "yes" | "no" | "partly";

const ROWS: { label: string; postory: Mark; scheduler: Mark; chatbot: Mark }[] = [
  { label: "Starts from what happened, in your words", postory: "yes", scheduler: "no", chatbot: "partly" },
  { label: "A native version for each network", postory: "yes", scheduler: "no", chatbot: "partly" },
  { label: "Checks numbers against what you told it", postory: "yes", scheduler: "no", chatbot: "no" },
  { label: "Remembers your business and voice", postory: "yes", scheduler: "no", chatbot: "partly" },
  { label: "Waits for your approval", postory: "yes", scheduler: "yes", chatbot: "no" },
  { label: "Schedules and publishes", postory: "yes", scheduler: "yes", chatbot: "no" },
  { label: "Images sized for each network", postory: "yes", scheduler: "no", chatbot: "partly" },
];

function Cell({ mark, strong }: { mark: Mark; strong?: boolean }) {
  if (mark === "yes")
    return (
      <span className={cn("mx-auto grid size-6 place-items-center rounded-full", strong ? "bg-blue-600 text-white" : "bg-wash text-ink-soft")}>
        <Check className="size-3.5" aria-label="Yes" />
      </span>
    );
  if (mark === "partly") return <span className="block text-center text-[12px] font-medium text-muted">Sort of</span>;
  return (
    <span className="mx-auto grid size-6 place-items-center text-faint">
      <Minus className="size-3.5" aria-label="No" />
    </span>
  );
}

/** Postory against the two things people use instead — by category, never by name. */
export function Compare() {
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-line">
      <table className="w-full table-fixed text-left text-[13.5px] sm:text-[14.5px]">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-[46%] px-4 py-4 font-medium text-muted sm:px-6">
              <span className="sr-only">Capability</span>
            </th>
            <th scope="col" className="bg-blue-50/60 px-2 py-4 text-center font-semibold text-ink">
              Postory
            </th>
            <th scope="col" className="px-2 py-4 text-center font-medium text-muted">
              A scheduler
            </th>
            <th scope="col" className="px-2 py-4 text-center font-medium text-muted">
              A chatbot
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="px-4 py-3.5 font-normal text-ink-soft sm:px-6">
                {r.label}
              </th>
              <td className="bg-blue-50/60 px-2 py-3.5">
                <Cell mark={r.postory} strong />
              </td>
              <td className="px-2 py-3.5">
                <Cell mark={r.scheduler} />
              </td>
              <td className="px-2 py-3.5">
                <Cell mark={r.chatbot} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
