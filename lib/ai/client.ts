import "server-only";

import { llmProvider } from "./llm";

/** Whether any model provider (Gemini, or OpenAI as a fallback) is configured. */
export function aiAvailable() {
  return llmProvider() !== null;
}
