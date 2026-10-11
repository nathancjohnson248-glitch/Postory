"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { addDaysToKey, dateKey, timeKey, toZonedIso, zonedToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Pick a date and time in the user's timezone. The chosen wall-clock time is
 * converted to an absolute instant with an explicit offset before it leaves
 * the browser; the server validates it again.
 */
export function ScheduleDialog({
  open,
  onClose,
  onSubmit,
  timezone,
  title,
  initial,
  confirmLabel = "Schedule",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (isoWithOffset: string) => Promise<string | null>;
  timezone: string;
  title: string;
  initial?: string | null;
  confirmLabel?: string;
}) {
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now, timezone);
  const start = initial ? new Date(initial) : null;
  const [day, setDay] = useState(start ? dateKey(start, timezone) : addDaysToKey(today, 1));
  const [time, setTime] = useState(start ? timeKey(start, timezone) : "09:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quick = [
    { label: "Tomorrow, 9:00", day: addDaysToKey(today, 1), time: "09:00" },
    { label: "Tomorrow, 12:30", day: addDaysToKey(today, 1), time: "12:30" },
    { label: "In 2 days, 9:00", day: addDaysToKey(today, 2), time: "09:00" },
    { label: "Next week, 9:00", day: addDaysToKey(today, 7), time: "09:00" },
  ];

  function submit() {
    setError(null);
    if (!day || !time) {
      setError("Pick a date and time.");
      return;
    }
    const instant = zonedToUtc(day, time, timezone);
    if (instant.getTime() < Date.now() + 2 * 60 * 1000) {
      setError("Pick a time at least a couple of minutes from now.");
      return;
    }
    startTransition(async () => {
      const failure = await onSubmit(toZonedIso(instant, timezone));
      if (failure) setError(failure);
      else onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => !pending && onClose()}
      title={title}
      description={`Times are in ${timezone.replace(/_/g, " ")}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? <Notice tone="danger" title={error} /> : null}
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                setDay(q.day);
                setTime(q.time);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors",
                day === q.day && time === q.time ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line hover:ring-line-strong",
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="schedule-date">
            <Input id="schedule-date" type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Time" htmlFor="schedule-time">
            <Input id="schedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} step={300} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
