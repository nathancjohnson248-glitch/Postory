import "server-only";

import type { Platform } from "@/lib/social/platforms";
import { generateStructured, LlmError } from "./llm";
import { findUnsupportedNumbers } from "./factuality";
import { ADAPT_SYSTEM, adaptUserPrompt, type BusinessContext } from "./prompts";
import { ModelAdaptation, ValidatedAdaptation } from "./types";

/** Revise one platform's post per an instruction. Other platforms are untouched by construction. */
export async function adaptPost(input: {
  platform: Platform;
  story: string;
  current: string;
  instruction: string;
  context: BusinessContext;
  corpus: string;
}) {
  const raw = await generateStructured({
    system: ADAPT_SYSTEM,
    turns: [{ role: "user", content: adaptUserPrompt(input) }],
    schema: ModelAdaptation,
    name: "post_edit",
  });
  const parsed = ValidatedAdaptation.safeParse(raw);
  if (!parsed.success) throw new LlmError("invalid_output", "The edit didn't come back in a usable form. Try again.");
  // The current post text counts as approved source material for the fact check.
  const unsupported = findUnsupportedNumbers(parsed.data.content, input.corpus, input.current);
  return {
    ...parsed.data,
    warnings: unsupported.length ? [`Check ${unsupported.join(", ")} — not found in your story or memory.`] : [],
  };
}
