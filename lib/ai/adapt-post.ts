import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import type { Platform } from "@/lib/social/platforms";
import { getOpenAI, models } from "./client";
import { findUnsupportedNumbers } from "./factuality";
import { GenerationError } from "./generate-posts";
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
  const openai = getOpenAI();
  let response;
  try {
    response = await openai.responses.parse({
      model: models.text(),
      input: [
        { role: "system", content: ADAPT_SYSTEM },
        { role: "user", content: adaptUserPrompt(input) },
      ],
      text: { format: zodTextFormat(ModelAdaptation, "post_edit") },
    });
  } catch (error) {
    throw new GenerationError("provider_error", error instanceof Error ? error.message : "OpenAI request failed.");
  }
  const parsed = ValidatedAdaptation.safeParse(response.output_parsed);
  if (!parsed.success) throw new GenerationError("invalid_output", "The edit didn't come back in a usable form. Try again.");
  // The current post text counts as approved source material for the fact check.
  const unsupported = findUnsupportedNumbers(parsed.data.content, input.corpus, input.current);
  return {
    ...parsed.data,
    warnings: unsupported.length ? [`Check ${unsupported.join(", ")} — not found in your story or memory.`] : [],
  };
}
