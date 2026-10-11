"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp } from "lucide-react";

/** Home's quick entry point: hands the text to Create, where networks are chosen. */
export function QuickCreate() {
  const router = useRouter();
  const [text, setText] = useState("");
  return (
    <form
      className="rounded-3xl bg-ink p-5 text-white shadow-lift"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        router.push(`/app/create?text=${encodeURIComponent(text.trim())}`);
      }}
    >
      <label htmlFor="quick-create" className="font-display text-[26px] leading-tight">
        What happened today?
      </label>
      <div className="mt-4 flex items-end gap-2 rounded-2xl bg-white/[0.07] p-2 ring-1 ring-white/10 focus-within:ring-white/30">
        <textarea
          id="quick-create"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          rows={3}
          placeholder="We shipped dark mode this morning…"
          className="min-h-20 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14.5px] leading-relaxed text-white placeholder:text-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500 transition-all hover:bg-blue-400 disabled:opacity-30"
          aria-label="Continue to Create"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
    </form>
  );
}
