"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { addMemory } from "@/app/_actions/memory";

/** Questions the writer had. Answers become business memory, so future posts can use them. */
export function MissingInfo({ questions }: { questions: string[] }) {
  if (!questions.length) return null;
  return (
    <div className="rounded-3xl bg-blue-50/60 p-5 ring-1 ring-blue-100">
      <p className="text-[14px] font-semibold text-ink">Postory could say more if it knew:</p>
      <p className="mt-0.5 text-[13px] text-muted">Answers are saved to your business memory. They&apos;re never assumed.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {questions.map((q) => (
          <Question key={q} question={q} />
        ))}
      </ul>
    </div>
  );
}

function Question({ question }: { question: string }) {
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li>
      <p className="text-[13.5px] text-ink-soft">{question}</p>
      {saved ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-success">
          <Check className="size-3.5" /> Saved to memory
        </p>
      ) : (
        <form
          className="mt-1.5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!answer.trim()) return;
            start(async () => {
              const result = await addMemory({ category: "facts", key: question.slice(0, 100), value: answer.trim(), source: "story" });
              if (result.ok) setSaved(true);
              else toast.error(result.error.message);
            });
          }}
        >
          <label className="sr-only" htmlFor={`q-${question}`}>
            {question}
          </label>
          <input
            id={`q-${question}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer"
            className="h-9 min-w-0 flex-1 rounded-xl bg-surface px-3 text-[13.5px] shadow-hairline focus:outline-none focus:shadow-[0_0_0_1px_var(--color-blue-500)]"
          />
          <button
            type="submit"
            disabled={!answer.trim() || pending}
            className="flex h-9 items-center gap-1 rounded-xl bg-ink px-3 text-[13px] font-medium text-white disabled:opacity-30"
          >
            <Plus className="size-3.5" /> Save
          </button>
        </form>
      )}
    </li>
  );
}
